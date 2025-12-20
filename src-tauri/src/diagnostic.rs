use crate::AppError;
use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TracerouteHop {
    pub hop: u32,
    pub ip: Option<String>,
    pub hostname: Option<String>,
    pub latency_ms: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TracerouteResult {
    pub target: String,
    pub hops: Vec<TracerouteHop>,
    pub completed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DnsQueryResult {
    pub domain: String,
    pub dns_server: Option<String>,
    pub records: Vec<DnsRecord>,
    pub query_time_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DnsRecord {
    pub record_type: String,
    pub value: String,
    pub ttl: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkDiagnostic {
    pub target: String,
    pub ping_result: Option<PingDiagResult>,
    pub dns_result: Option<DnsQueryResult>,
    pub traceroute_result: Option<TracerouteResult>,
    pub http_result: Option<HttpDiagResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PingDiagResult {
    pub packets_sent: u32,
    pub packets_received: u32,
    pub packet_loss_percent: f64,
    pub min_latency_ms: Option<f64>,
    pub avg_latency_ms: Option<f64>,
    pub max_latency_ms: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpDiagResult {
    pub url: String,
    pub status_code: Option<u16>,
    pub response_time_ms: u64,
    pub error: Option<String>,
}

/// 执行 traceroute
pub async fn traceroute(target: &str, max_hops: u32) -> Result<TracerouteResult, AppError> {
    let target = target.to_string();
    let max_hops = max_hops.min(30);
    
    tokio::task::spawn_blocking(move || {
        let output = if cfg!(target_os = "windows") {
            Command::new("tracert")
                .args(["-h", &max_hops.to_string(), "-w", "1000", &target])
                .output()
        } else {
            Command::new("traceroute")
                .args(["-m", &max_hops.to_string(), "-w", "1", &target])
                .output()
        };
        
        let output = output.map_err(|e| AppError::Other(format!("执行 traceroute 失败: {}", e)))?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        
        let mut hops = Vec::new();
        
        for line in stdout.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            
            // 解析跳数
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.is_empty() {
                continue;
            }
            
            if let Ok(hop_num) = parts[0].parse::<u32>() {
                // 查找 IP 地址
                let mut ip = None;
                let mut hostname = None;
                let mut latency = None;
                
                for part in &parts[1..] {
                    // IP 地址格式
                    if part.contains('.') && part.chars().all(|c| c.is_ascii_digit() || c == '.') {
                        ip = Some(part.to_string());
                    } else if part.starts_with('(') && part.ends_with(')') {
                        // (IP) 格式
                        let inner = &part[1..part.len()-1];
                        if inner.contains('.') {
                            ip = Some(inner.to_string());
                        }
                    } else if part.ends_with("ms") {
                        // 延迟
                        let num_str = part.trim_end_matches("ms");
                        if let Ok(lat) = num_str.parse::<f64>() {
                            latency = Some(lat);
                        }
                    } else if !part.starts_with('*') && part.len() > 3 {
                        // 可能是主机名
                        hostname = Some(part.to_string());
                    }
                }
                
                hops.push(TracerouteHop {
                    hop: hop_num,
                    ip,
                    hostname,
                    latency_ms: latency,
                });
            }
        }
        
        Ok(TracerouteResult {
            target,
            hops,
            completed: output.status.success(),
        })
    })
    .await
    .map_err(|e| AppError::Other(format!("任务执行失败: {}", e)))?
}

/// DNS 查询
pub async fn dns_query(domain: &str, dns_server: Option<&str>) -> Result<DnsQueryResult, AppError> {
    let domain = domain.to_string();
    let dns_server = dns_server.map(|s| s.to_string());
    
    tokio::task::spawn_blocking(move || {
        let mut args = vec![domain.clone()];
        
        if let Some(ref server) = dns_server {
            args.push(format!("@{}", server));
        }
        
        let output = if cfg!(target_os = "windows") {
            let mut cmd_args = vec![domain.clone()];
            if let Some(ref server) = dns_server {
                cmd_args.push(server.clone());
            }
            Command::new("nslookup")
                .args(&cmd_args)
                .output()
        } else {
            Command::new("dig")
                .args(&args)
                .output()
        };
        
        let output = output.map_err(|e| AppError::Other(format!("执行 DNS 查询失败: {}", e)))?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        
        let mut records = Vec::new();
        let mut query_time = None;
        
        if cfg!(target_os = "windows") {
            // 解析 nslookup 输出
            let mut in_answer = false;
            for line in stdout.lines() {
                if line.contains("Name:") {
                    in_answer = true;
                    continue;
                }
                if in_answer && line.contains("Address:") {
                    if let Some(ip) = line.split(':').nth(1) {
                        records.push(DnsRecord {
                            record_type: "A".to_string(),
                            value: ip.trim().to_string(),
                            ttl: None,
                        });
                    }
                }
            }
        } else {
            // 解析 dig 输出
            let mut in_answer = false;
            for line in stdout.lines() {
                if line.contains(";; ANSWER SECTION:") {
                    in_answer = true;
                    continue;
                }
                if in_answer && !line.starts_with(';') && !line.is_empty() {
                    if line.starts_with(";;") {
                        in_answer = false;
                        continue;
                    }
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 5 {
                        records.push(DnsRecord {
                            record_type: parts[3].to_string(),
                            value: parts[4].to_string(),
                            ttl: parts[1].parse().ok(),
                        });
                    }
                }
                if line.contains("Query time:") {
                    if let Some(time_str) = line.split_whitespace().nth(3) {
                        query_time = time_str.parse().ok();
                    }
                }
            }
        }
        
        Ok(DnsQueryResult {
            domain,
            dns_server,
            records,
            query_time_ms: query_time,
        })
    })
    .await
    .map_err(|e| AppError::Other(format!("任务执行失败: {}", e)))?
}

/// Ping 诊断（详细）
pub async fn ping_diagnostic(target: &str, count: u32) -> Result<PingDiagResult, AppError> {
    let target = target.to_string();
    let count = count.min(10);
    
    tokio::task::spawn_blocking(move || {
        let output = if cfg!(target_os = "windows") {
            Command::new("ping")
                .args(["-n", &count.to_string(), &target])
                .output()
        } else {
            Command::new("ping")
                .args(["-c", &count.to_string(), &target])
                .output()
        };
        
        let output = output.map_err(|e| AppError::Other(format!("执行 ping 失败: {}", e)))?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        
        let packets_sent = count;
        let mut packets_received = 0u32;
        let mut min_latency = None;
        let mut avg_latency = None;
        let mut max_latency = None;
        
        for line in stdout.lines() {
            let line_lower = line.to_lowercase();
            
            // 解析统计信息
            if line_lower.contains("packets") || line_lower.contains("数据包") {
                // 尝试解析收发包数
                let parts: Vec<&str> = line.split(',').collect();
                for part in parts {
                    if part.contains("received") || part.contains("已接收") {
                        if let Some(num) = part.split_whitespace().next() {
                            packets_received = num.parse().unwrap_or(0);
                        }
                    }
                }
            }
            
            // 解析延迟统计
            if line_lower.contains("min/avg/max") || line_lower.contains("最短") {
                // Unix 格式: min/avg/max/mdev = 1.234/2.345/3.456/0.123 ms
                if let Some(pos) = line.find('=') {
                    let stats = &line[pos + 1..];
                    let parts: Vec<&str> = stats.split('/').collect();
                    if parts.len() >= 3 {
                        min_latency = parts[0].trim().parse().ok();
                        avg_latency = parts[1].trim().parse().ok();
                        max_latency = parts[2].trim().split_whitespace().next()
                            .and_then(|s| s.parse().ok());
                    }
                }
            }
        }
        
        let packet_loss = if packets_sent > 0 {
            ((packets_sent - packets_received) as f64 / packets_sent as f64) * 100.0
        } else {
            100.0
        };
        
        Ok(PingDiagResult {
            packets_sent,
            packets_received,
            packet_loss_percent: packet_loss,
            min_latency_ms: min_latency,
            avg_latency_ms: avg_latency,
            max_latency_ms: max_latency,
        })
    })
    .await
    .map_err(|e| AppError::Other(format!("任务执行失败: {}", e)))?
}

/// HTTP 诊断
pub async fn http_diagnostic(url: &str) -> Result<HttpDiagResult, AppError> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| AppError::Other(e.to_string()))?;
    
    let start = std::time::Instant::now();
    
    match client.get(url).send().await {
        Ok(response) => {
            let elapsed = start.elapsed().as_millis() as u64;
            Ok(HttpDiagResult {
                url: url.to_string(),
                status_code: Some(response.status().as_u16()),
                response_time_ms: elapsed,
                error: None,
            })
        }
        Err(e) => {
            let elapsed = start.elapsed().as_millis() as u64;
            Ok(HttpDiagResult {
                url: url.to_string(),
                status_code: None,
                response_time_ms: elapsed,
                error: Some(e.to_string()),
            })
        }
    }
}

/// 完整网络诊断
pub async fn full_diagnostic(target: &str) -> Result<NetworkDiagnostic, AppError> {
    let ping_result = ping_diagnostic(target, 4).await.ok();
    let dns_result = dns_query(target, None).await.ok();
    let traceroute_result = traceroute(target, 15).await.ok();
    
    let url = if target.starts_with("http") {
        target.to_string()
    } else {
        format!("https://{}", target)
    };
    let http_result = http_diagnostic(&url).await.ok();
    
    Ok(NetworkDiagnostic {
        target: target.to_string(),
        ping_result,
        dns_result,
        traceroute_result,
        http_result,
    })
}
