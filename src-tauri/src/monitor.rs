use crate::{ping, AppError};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

/// 单次监控记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorRecord {
    pub timestamp: DateTime<Utc>,
    pub latency: Option<u64>,
    pub status: MonitorStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum MonitorStatus {
    Good,      // 延迟正常
    Warning,   // 延迟升高
    Critical,  // 延迟过高或超时
    Timeout,   // 完全超时
}

/// 域名监控数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomainMonitor {
    pub domain: String,
    pub current_ip: String,
    pub baseline_latency: Option<u64>,  // 基准延迟
    pub records: Vec<MonitorRecord>,    // 最近的监控记录
    pub last_check: Option<DateTime<Utc>>,
    pub alert_triggered: bool,
}

/// 监控配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorConfig {
    pub enabled: bool,
    pub check_interval_seconds: u32,    // 检查间隔
    pub warning_threshold_percent: u32, // 延迟升高警告阈值（百分比）
    pub critical_threshold_ms: u64,     // 严重延迟阈值（毫秒）
    pub auto_reoptimize: bool,          // 自动重新优选
    pub max_records: usize,             // 保留的最大记录数
}

impl Default for MonitorConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            check_interval_seconds: 60,
            warning_threshold_percent: 50,
            critical_threshold_ms: 500,
            auto_reoptimize: false,
            max_records: 100,
        }
    }
}

/// 监控状态（内存中）
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MonitorState {
    pub domains: HashMap<String, DomainMonitor>,
    pub config: MonitorConfig,
}

// 全局监控状态
lazy_static::lazy_static! {
    static ref MONITOR_STATE: Arc<RwLock<MonitorState>> = Arc::new(RwLock::new(MonitorState::default()));
}

fn get_monitor_config_path() -> PathBuf {
    if let Some(config_dir) = dirs::config_dir() {
        let app_dir = config_dir.join("netoptim");
        if !app_dir.exists() {
            let _ = fs::create_dir_all(&app_dir);
        }
        app_dir.join("monitor.json")
    } else {
        PathBuf::from("monitor.json")
    }
}

pub fn load_monitor_config() -> MonitorConfig {
    let path = get_monitor_config_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(config) = serde_json::from_str(&content) {
                return config;
            }
        }
    }
    MonitorConfig::default()
}

pub fn save_monitor_config(config: &MonitorConfig) -> Result<(), AppError> {
    let path = get_monitor_config_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let content = serde_json::to_string_pretty(config)
        .map_err(|e| AppError::Other(format!("序列化失败: {}", e)))?;
    fs::write(&path, content)?;
    Ok(())
}

/// 添加域名到监控列表
pub async fn add_domain_to_monitor(domain: &str, ip: &str, baseline_latency: Option<u64>) {
    let mut state = MONITOR_STATE.write().await;
    state.domains.insert(
        domain.to_string(),
        DomainMonitor {
            domain: domain.to_string(),
            current_ip: ip.to_string(),
            baseline_latency,
            records: Vec::new(),
            last_check: None,
            alert_triggered: false,
        },
    );
}

/// 从监控列表移除域名
pub async fn remove_domain_from_monitor(domain: &str) {
    let mut state = MONITOR_STATE.write().await;
    state.domains.remove(domain);
}

/// 获取监控状态
pub async fn get_monitor_state() -> MonitorState {
    let state = MONITOR_STATE.read().await;
    state.clone()
}

/// 执行单次监控检查
pub async fn check_domain(domain: &str) -> Result<MonitorRecord, AppError> {
    let state = MONITOR_STATE.read().await;
    let monitor = state.domains.get(domain)
        .ok_or_else(|| AppError::Other("域名未在监控列表中".to_string()))?;
    
    let ip = monitor.current_ip.clone();
    let baseline = monitor.baseline_latency;
    let config = state.config.clone();
    drop(state);
    
    // Ping 测试
    let ip_addr: std::net::IpAddr = ip.parse()
        .map_err(|_| AppError::Other("无效的 IP 地址".to_string()))?;
    
    let latency = ping::ping_ip(ip_addr).await;
    
    // 判断状态
    let status = match latency {
        None => MonitorStatus::Timeout,
        Some(lat) => {
            if lat > config.critical_threshold_ms {
                MonitorStatus::Critical
            } else if let Some(base) = baseline {
                let threshold = base + (base * config.warning_threshold_percent as u64 / 100);
                if lat > threshold {
                    MonitorStatus::Warning
                } else {
                    MonitorStatus::Good
                }
            } else {
                MonitorStatus::Good
            }
        }
    };
    
    let record = MonitorRecord {
        timestamp: Utc::now(),
        latency,
        status: status.clone(),
    };
    
    // 更新状态
    let mut state = MONITOR_STATE.write().await;
    if let Some(monitor) = state.domains.get_mut(domain) {
        monitor.records.push(record.clone());
        monitor.last_check = Some(Utc::now());
        
        // 限制记录数量
        if monitor.records.len() > config.max_records {
            monitor.records.remove(0);
        }
        
        // 检查是否需要触发警报
        if status == MonitorStatus::Critical || status == MonitorStatus::Timeout {
            monitor.alert_triggered = true;
        }
    }
    
    Ok(record)
}

/// 检查所有监控的域名
pub async fn check_all_domains() -> Vec<(String, MonitorRecord)> {
    let state = MONITOR_STATE.read().await;
    let domains: Vec<String> = state.domains.keys().cloned().collect();
    drop(state);
    
    let mut results = Vec::new();
    for domain in domains {
        if let Ok(record) = check_domain(&domain).await {
            results.push((domain, record));
        }
    }
    results
}

/// 获取需要重新优选的域名（网络质量下降的）
pub async fn get_domains_needing_reoptimize() -> Vec<String> {
    let state = MONITOR_STATE.read().await;
    state.domains
        .iter()
        .filter(|(_, m)| m.alert_triggered)
        .map(|(d, _)| d.clone())
        .collect()
}

/// 重置警报状态
pub async fn reset_alert(domain: &str) {
    let mut state = MONITOR_STATE.write().await;
    if let Some(monitor) = state.domains.get_mut(domain) {
        monitor.alert_triggered = false;
    }
}

/// 更新监控配置
pub async fn update_monitor_config(config: MonitorConfig) -> Result<(), AppError> {
    save_monitor_config(&config)?;
    let mut state = MONITOR_STATE.write().await;
    state.config = config;
    Ok(())
}

/// 获取域名的监控历史
pub async fn get_domain_history(domain: &str) -> Option<Vec<MonitorRecord>> {
    let state = MONITOR_STATE.read().await;
    state.domains.get(domain).map(|m| m.records.clone())
}
