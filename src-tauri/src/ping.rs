use futures::future::join_all;
use rand::random;
use std::net::IpAddr;
use std::time::Duration;
use surge_ping::{Client, PingIdentifier, PingSequence};

use crate::IpResult;

/// Ping 一个 IP 地址，返回延迟（毫秒）
pub async fn ping_ip(ip: IpAddr) -> Option<u64> {
    let client = match Client::new(&Default::default()) {
        Ok(c) => c,
        Err(_) => return ping_fallback(ip).await,
    };

    let mut pinger = client.pinger(ip, PingIdentifier(random())).await;

    // Ping 3 次取平均值
    let mut total_ms: u64 = 0;
    let mut success_count = 0;

    for seq in 0..3u16 {
        match tokio::time::timeout(Duration::from_secs(2), pinger.ping(PingSequence(seq), &[]))
            .await
        {
            Ok(Ok((_, duration))) => {
                total_ms += duration.as_millis() as u64;
                success_count += 1;
            }
            _ => continue,
        }
    }

    if success_count > 0 {
        Some(total_ms / success_count)
    } else {
        ping_fallback(ip).await
    }
}

/// 并行 Ping 多个 IP
pub async fn ping_ips_parallel(ips: Vec<IpAddr>) -> Vec<IpResult> {
    let tasks: Vec<_> = ips
        .into_iter()
        .map(|ip| {
            tokio::spawn(async move {
                let latency = ping_ip(ip).await;
                IpResult {
                    ip: ip.to_string(),
                    latency,
                    location: None,
                    is_cdn: false,
                }
            })
        })
        .collect();

    let results = join_all(tasks).await;

    let mut ip_results: Vec<IpResult> = results.into_iter().filter_map(|r| r.ok()).collect();

    // 按延迟排序
    ip_results.sort_by(|a, b| match (a.latency, b.latency) {
        (Some(a), Some(b)) => a.cmp(&b),
        (Some(_), None) => std::cmp::Ordering::Less,
        (None, Some(_)) => std::cmp::Ordering::Greater,
        (None, None) => std::cmp::Ordering::Equal,
    });

    ip_results
}

/// 备用方案：使用系统 ping 命令
async fn ping_fallback(ip: IpAddr) -> Option<u64> {
    let ip_str = ip.to_string();

    tokio::task::spawn_blocking(move || {
        use std::process::Command;

        let output = if cfg!(target_os = "windows") {
            Command::new("ping")
                .args(["-n", "1", "-w", "2000", &ip_str])
                .output()
        } else {
            Command::new("ping")
                .args(["-c", "1", "-W", "2", &ip_str])
                .output()
        };

        let output = match output {
            Ok(o) => o,
            Err(_) => return None,
        };

        if !output.status.success() {
            return None;
        }

        let stdout = String::from_utf8_lossy(&output.stdout);

        if cfg!(target_os = "windows") {
            for line in stdout.lines() {
                if let Some(pos) = line.find("time=").or_else(|| line.find("时间=")) {
                    let start = pos + if line.contains("time=") { 5 } else { 7 };
                    let rest = &line[start..];
                    if let Some(end) = rest.find(|c: char| !c.is_ascii_digit()) {
                        if let Ok(ms) = rest[..end].parse::<u64>() {
                            return Some(ms);
                        }
                    }
                }
            }
        } else {
            for line in stdout.lines() {
                if let Some(pos) = line.find("time=") {
                    let start = pos + 5;
                    let rest = &line[start..];
                    if let Some(end) = rest.find(' ') {
                        if let Ok(ms) = rest[..end].parse::<f64>() {
                            return Some(ms.round() as u64);
                        }
                    }
                }
            }
        }

        None
    })
    .await
    .ok()
    .flatten()
}

/// 测试网站连通性
pub async fn test_connectivity(domain: &str) -> Result<(bool, u64), String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("https://{}", domain);
    let start = std::time::Instant::now();

    match client.head(&url).send().await {
        Ok(response) => {
            let elapsed = start.elapsed().as_millis() as u64;
            Ok((response.status().is_success() || response.status().is_redirection(), elapsed))
        }
        Err(_) => {
            // 尝试 HTTP
            let url = format!("http://{}", domain);
            let start = std::time::Instant::now();
            match client.head(&url).send().await {
                Ok(response) => {
                    let elapsed = start.elapsed().as_millis() as u64;
                    Ok((response.status().is_success() || response.status().is_redirection(), elapsed))
                }
                Err(e) => Err(e.to_string()),
            }
        }
    }
}
