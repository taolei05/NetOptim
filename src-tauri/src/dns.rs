use futures::future::join_all;
use reqwest::Client;
use serde::Deserialize;
use std::collections::HashSet;
use std::net::IpAddr;
use std::process::Command;
use std::time::Duration;

use crate::AppError;

// 常用的公共 DNS 服务器
const DNS_SERVERS: &[&str] = &[
    "8.8.8.8",        // Google
    "1.1.1.1",        // Cloudflare
    "223.5.5.5",      // 阿里 DNS
    "119.29.29.29",   // 腾讯 DNS
];

// DoH 服务器
const DOH_SERVERS: &[&str] = &[
    "https://dns.google/resolve",
    "https://cloudflare-dns.com/dns-query",
    "https://dns.alidns.com/resolve",
];

#[derive(Deserialize)]
struct DohResponse {
    #[serde(rename = "Answer")]
    answer: Option<Vec<DohAnswer>>,
}

#[derive(Deserialize)]
struct DohAnswer {
    #[serde(rename = "type")]
    record_type: u16,
    data: String,
}
// DNS 解析缓存
use std::sync::RwLock;
use std::time::Instant;

struct DnsCacheEntry {
    ips: Vec<IpAddr>,
    timestamp: Instant,
}

lazy_static::lazy_static! {
    static ref DNS_CACHE: RwLock<std::collections::HashMap<String, DnsCacheEntry>> = 
        RwLock::new(std::collections::HashMap::new());
}

// 缓存 TTL: 5 分钟
const DNS_CACHE_TTL_SECS: u64 = 300;

/// 从多个 DNS 服务器并行解析域名，收集所有不重复的 IP
pub async fn resolve_domain(domain: &str) -> Result<Vec<IpAddr>, AppError> {
    // 先检查缓存
    {
        let cache = DNS_CACHE.read().unwrap();
        if let Some(entry) = cache.get(domain) {
            if entry.timestamp.elapsed().as_secs() < DNS_CACHE_TTL_SECS {
                crate::logger::log_info("dns", &format!("使用缓存的 DNS 结果: {}", domain));
                return Ok(entry.ips.clone());
            }
        }
    }
    
    let mut all_ips: HashSet<IpAddr> = HashSet::new();

    // 并行执行所有解析任务
    let mut tasks = Vec::new();

    // 系统 DNS
    let d = domain.to_string();
    tasks.push(tokio::spawn(async move { resolve_with_system(&d).await }));

    // 传统 DNS 服务器
    for dns_server in DNS_SERVERS {
        let d = domain.to_string();
        let dns = dns_server.to_string();
        tasks.push(tokio::spawn(
            async move { resolve_with_nslookup(&d, &dns).await },
        ));
    }

    // DoH 服务器
    for doh_server in DOH_SERVERS {
        let d = domain.to_string();
        let server = doh_server.to_string();
        tasks.push(tokio::spawn(async move { resolve_with_doh(&d, &server).await }));
    }

    // 等待所有任务完成
    let results = join_all(tasks).await;

    for result in results {
        if let Ok(Ok(ips)) = result {
            all_ips.extend(ips);
        }
    }

    let ips: Vec<IpAddr> = all_ips.into_iter().collect();
    
    // 更新缓存
    if !ips.is_empty() {
        let mut cache = DNS_CACHE.write().unwrap();
        cache.insert(domain.to_string(), DnsCacheEntry {
            ips: ips.clone(),
            timestamp: Instant::now(),
        });
    }
    
    Ok(ips)
}

/// 使用系统 DNS 解析
async fn resolve_with_system(domain: &str) -> Result<Vec<IpAddr>, AppError> {
    let addrs = tokio::net::lookup_host(format!("{}:80", domain))
        .await
        .map_err(|e| AppError::DnsError(e.to_string()))?;

    Ok(addrs.map(|addr| addr.ip()).collect())
}

/// 使用 nslookup/dig 命令解析
async fn resolve_with_nslookup(domain: &str, dns_server: &str) -> Result<Vec<IpAddr>, AppError> {
    let domain = domain.to_string();
    let dns = dns_server.to_string();

    tokio::task::spawn_blocking(move || {
        let output = if cfg!(target_os = "windows") {
            Command::new("nslookup")
                .args([&domain, &dns])
                .output()
        } else {
            Command::new("dig")
                .args(["+short", &domain, &format!("@{}", dns)])
                .output()
        };

        let output = output.map_err(|e| AppError::DnsError(e.to_string()))?;
        let stdout = String::from_utf8_lossy(&output.stdout);

        let mut ips = Vec::new();

        if cfg!(target_os = "windows") {
            let mut in_answer = false;
            for line in stdout.lines() {
                if line.contains("Name:") {
                    in_answer = true;
                    continue;
                }
                if in_answer && line.contains("Address:") {
                    if let Some(ip_str) = line.split(':').nth(1) {
                        if let Ok(ip) = ip_str.trim().parse::<IpAddr>() {
                            ips.push(ip);
                        }
                    }
                }
            }
        } else {
            for line in stdout.lines() {
                let line = line.trim();
                if let Ok(ip) = line.parse::<IpAddr>() {
                    ips.push(ip);
                }
            }
        }

        Ok(ips)
    })
    .await
    .map_err(|e| AppError::DnsError(e.to_string()))?
}

/// 使用 DNS over HTTPS 解析（同时查询 IPv4 和 IPv6）
async fn resolve_with_doh(domain: &str, doh_server: &str) -> Result<Vec<IpAddr>, AppError> {
    let client = Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| AppError::DnsError(e.to_string()))?;

    let mut ips = Vec::new();

    // 查询 A 记录 (IPv4)
    let url_a = format!("{}?name={}&type=A", doh_server, domain);
    if let Ok(response) = client
        .get(&url_a)
        .header("Accept", "application/dns-json")
        .send()
        .await
    {
        if let Ok(doh_response) = response.json::<DohResponse>().await {
            if let Some(answers) = doh_response.answer {
                for answer in answers {
                    // type 1 = A record (IPv4)
                    if answer.record_type == 1 {
                        if let Ok(ip) = answer.data.parse::<IpAddr>() {
                            ips.push(ip);
                        }
                    }
                }
            }
        }
    }

    // 查询 AAAA 记录 (IPv6)
    let url_aaaa = format!("{}?name={}&type=AAAA", doh_server, domain);
    if let Ok(response) = client
        .get(&url_aaaa)
        .header("Accept", "application/dns-json")
        .send()
        .await
    {
        if let Ok(doh_response) = response.json::<DohResponse>().await {
            if let Some(answers) = doh_response.answer {
                for answer in answers {
                    // type 28 = AAAA record (IPv6)
                    if answer.record_type == 28 {
                        if let Ok(ip) = answer.data.parse::<IpAddr>() {
                            ips.push(ip);
                        }
                    }
                }
            }
        }
    }

    Ok(ips)
}
