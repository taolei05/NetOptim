use reqwest::Client;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::LazyLock;
use std::time::Duration;

// CDN 提供商的 IP 特征
static CDN_PATTERNS: LazyLock<HashMap<&'static str, Vec<&'static str>>> = LazyLock::new(|| {
    let mut m = HashMap::new();
    m.insert(
        "Cloudflare",
        vec![
            "104.16.", "104.17.", "104.18.", "104.19.", "104.20.", "104.21.", "104.22.", "104.23.",
            "104.24.", "104.25.", "104.26.", "104.27.", "172.64.", "172.65.", "172.66.", "172.67.",
            "162.158.", "162.159.", "141.101.", "108.162.", "190.93.", "188.114.", "197.234.",
            "198.41.", "199.27.",
        ],
    );
    m.insert(
        "Fastly",
        vec![
            "151.101.", "199.232.", "185.199.",
        ],
    );
    m.insert(
        "Akamai",
        vec![
            "23.32.", "23.33.", "23.34.", "23.35.", "23.36.", "23.37.", "23.38.", "23.39.",
            "23.40.", "23.41.", "23.42.", "23.43.", "23.44.", "23.45.", "23.46.", "23.47.",
            "23.48.", "23.49.", "23.50.", "23.51.", "23.52.", "23.53.", "23.54.", "23.55.",
            "23.56.", "23.57.", "23.58.", "23.59.", "23.60.", "23.61.", "23.62.", "23.63.",
            "23.64.", "23.65.", "23.66.", "23.67.", "23.192.", "23.193.", "23.194.", "23.195.",
            "23.196.", "23.197.", "23.198.", "23.199.", "23.200.", "23.201.", "23.202.", "23.203.",
            "23.204.", "23.205.", "23.206.", "23.207.", "23.208.", "23.209.", "23.210.", "23.211.",
            "23.212.", "23.213.", "23.214.", "23.215.", "23.216.", "23.217.", "23.218.", "23.219.",
            "23.220.", "23.221.", "23.222.", "23.223.",
        ],
    );
    m.insert(
        "Amazon CloudFront",
        vec![
            "13.32.", "13.33.", "13.35.", "13.224.", "13.225.", "13.226.", "13.227.", "13.249.",
            "52.84.", "52.85.", "52.222.", "54.182.", "54.192.", "54.230.", "54.239.", "54.240.",
            "99.84.", "99.86.", "143.204.", "204.246.", "205.251.",
        ],
    );
    m.insert(
        "Google",
        vec![
            "142.250.", "172.217.", "216.58.", "74.125.", "173.194.",
        ],
    );
    m.insert(
        "Microsoft Azure",
        vec![
            "13.107.", "52.96.", "52.97.", "52.98.", "52.99.", "52.100.", "52.101.", "52.102.",
            "52.103.", "52.104.", "52.105.", "52.106.", "52.107.", "52.108.", "52.109.", "52.110.",
            "52.111.", "52.112.", "52.113.", "52.114.", "52.115.", "52.116.", "52.117.", "52.118.",
            "52.119.", "52.120.", "52.121.", "52.122.", "52.123.", "52.124.", "52.125.", "52.126.",
            "52.127.",
        ],
    );
    m
});

#[derive(Deserialize)]
struct IpApiResponse {
    country: Option<String>,
    #[serde(rename = "regionName")]
    region_name: Option<String>,
    city: Option<String>,
    isp: Option<String>,
    org: Option<String>,
}

/// 检测 IP 是否属于 CDN
pub fn detect_cdn(ip: &str) -> Option<String> {
    for (cdn_name, prefixes) in CDN_PATTERNS.iter() {
        for prefix in prefixes {
            if ip.starts_with(prefix) {
                return Some(cdn_name.to_string());
            }
        }
    }
    None
}

/// 获取 IP 地理位置信息
pub async fn get_ip_location(ip: &str) -> Option<String> {
    get_ip_location_with_lang(ip, "zh-CN").await
}

/// 获取 IP 地理位置信息（指定语言）
pub async fn get_ip_location_with_lang(ip: &str, lang: &str) -> Option<String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .ok()?;

    // 使用 ip-api.com (免费，无需 API key)
    // lang: zh-CN, en, etc.
    let api_lang = if lang.starts_with("en") { "en" } else { "zh-CN" };
    let url = format!("http://ip-api.com/json/{}?lang={}", ip, api_lang);

    let response = client.get(&url).send().await.ok()?;
    let info: IpApiResponse = response.json().await.ok()?;

    let mut parts = Vec::new();
    if let Some(country) = info.country {
        parts.push(country);
    }
    if let Some(region) = info.region_name {
        if !parts.contains(&region) {
            parts.push(region);
        }
    }
    if let Some(city) = info.city {
        if !parts.contains(&city) {
            parts.push(city);
        }
    }

    // 添加 ISP/组织信息
    if let Some(org) = info.org.or(info.isp) {
        if !org.is_empty() && org.len() < 30 {
            parts.push(format!("({})", org));
        }
    }

    if parts.is_empty() {
        None
    } else {
        Some(parts.join(" "))
    }
}

/// 批量获取 IP 地理位置（带缓存）
pub async fn get_ip_locations_batch(ips: &[String], lang: &str) -> HashMap<String, String> {
    let mut results = HashMap::new();
    let lang = lang.to_string();

    // 并行获取，但限制并发数
    let semaphore = std::sync::Arc::new(tokio::sync::Semaphore::new(5));

    let tasks: Vec<_> = ips
        .iter()
        .map(|ip| {
            let ip = ip.clone();
            let sem = semaphore.clone();
            let lang = lang.clone();
            tokio::spawn(async move {
                let _permit = sem.acquire().await;
                let location = get_ip_location_with_lang(&ip, &lang).await;
                (ip, location)
            })
        })
        .collect();

    for task in tasks {
        match task.await {
            Ok((ip, Some(location))) => {
                results.insert(ip, location);
            }
            Ok((ip, None)) => {
                // IP 位置查询返回空，记录日志但不插入结果
                crate::logger::log_warning("ipinfo", &format!("无法获取 IP {} 的位置信息", ip));
            }
            Err(e) => {
                // 任务执行失败，记录错误日志
                crate::logger::log_error("ipinfo", &format!("批量获取 IP 位置时任务失败: {}", e), None);
            }
        }
    }

    results
}

/// 检测是否需要代理
pub async fn check_proxy_needed(domain: &str) -> (bool, String) {
    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .build();

    let client = match client {
        Ok(c) => c,
        Err(_) => return (false, "无法创建客户端".to_string()),
    };

    let url = format!("https://{}", domain);

    match client.head(&url).send().await {
        Ok(response) => {
            if response.status().is_success() || response.status().is_redirection() {
                (false, "可直接访问".to_string())
            } else {
                (true, format!("HTTP {}", response.status().as_u16()))
            }
        }
        Err(e) => {
            let err_str = e.to_string().to_lowercase();
            if err_str.contains("timeout") {
                (true, "连接超时，可能需要代理".to_string())
            } else if err_str.contains("connection refused") {
                (true, "连接被拒绝".to_string())
            } else if err_str.contains("reset") {
                (true, "连接被重置，可能被墙".to_string())
            } else {
                (true, format!("连接失败: {}", e))
            }
        }
    }
}
