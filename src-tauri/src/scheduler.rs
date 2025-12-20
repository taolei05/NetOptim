use crate::AppError;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use std::sync::LazyLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchedulerConfig {
    pub enabled: bool,
    pub interval_minutes: u32, // 检测间隔（分钟）
    pub auto_update: bool,     // 自动更新 hosts
    pub notify: bool,          // 发现更优 IP 时通知
}

impl Default for SchedulerConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            interval_minutes: 60,
            auto_update: false,
            notify: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchedulerState {
    pub config: SchedulerConfig,
    pub last_run: Option<chrono::DateTime<chrono::Utc>>,
    pub next_run: Option<chrono::DateTime<chrono::Utc>>,
    pub is_running: bool,
}

impl Default for SchedulerState {
    fn default() -> Self {
        Self {
            config: SchedulerConfig::default(),
            last_run: None,
            next_run: None,
            is_running: false,
        }
    }
}

// 全局调度器状态
static SCHEDULER_STATE: LazyLock<Arc<RwLock<SchedulerState>>> = LazyLock::new(|| {
    let config = load_scheduler_config();
    Arc::new(RwLock::new(SchedulerState {
        config,
        last_run: None,
        next_run: None,
        is_running: false,
    }))
});

// 用于取消定时任务的通知器
static SCHEDULER_CANCEL: LazyLock<Arc<tokio::sync::Notify>> = LazyLock::new(|| {
    Arc::new(tokio::sync::Notify::new())
});

fn get_scheduler_config_path() -> PathBuf {
    if let Some(config_dir) = dirs::config_dir() {
        let app_dir = config_dir.join("netoptim");
        if !app_dir.exists() {
            let _ = fs::create_dir_all(&app_dir);
        }
        app_dir.join("scheduler.json")
    } else {
        PathBuf::from("scheduler.json")
    }
}

pub fn load_scheduler_config() -> SchedulerConfig {
    let path = get_scheduler_config_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(config) = serde_json::from_str(&content) {
                return config;
            }
        }
    }
    SchedulerConfig::default()
}

pub fn save_scheduler_config(config: &SchedulerConfig) -> Result<(), AppError> {
    let path = get_scheduler_config_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let content = serde_json::to_string_pretty(config)
        .map_err(|e| AppError::Other(format!("序列化失败: {}", e)))?;
    fs::write(&path, content)?;
    
    // 更新调度器状态并重启调度器
    tokio::spawn(async move {
        update_scheduler_config_async().await;
    });
    
    Ok(())
}

async fn update_scheduler_config_async() {
    let config = load_scheduler_config();
    let mut state = SCHEDULER_STATE.write().await;
    let was_enabled = state.config.enabled;
    state.config = config.clone();
    
    // 如果配置改变，通知调度器重新启动
    if was_enabled != config.enabled || was_enabled {
        SCHEDULER_CANCEL.notify_one();
    }
}

/// 获取调度器状态
pub async fn get_scheduler_state() -> SchedulerState {
    SCHEDULER_STATE.read().await.clone()
}

/// 启动调度器（在应用启动时调用）
pub fn start_scheduler() {
    tauri::async_runtime::spawn(async {
        scheduler_loop().await;
    });
}

/// 调度器主循环
async fn scheduler_loop() {
    loop {
        let (enabled, interval_minutes) = {
            let state = SCHEDULER_STATE.read().await;
            (state.config.enabled, state.config.interval_minutes)
        };
        
        if !enabled {
            // 如果未启用，等待配置变更通知
            crate::logger::log_info("scheduler", "调度器已禁用，等待启用...");
            SCHEDULER_CANCEL.notified().await;
            continue;
        }
        
        // 计算下次运行时间
        let next_run = chrono::Utc::now() + chrono::Duration::minutes(interval_minutes as i64);
        {
            let mut state = SCHEDULER_STATE.write().await;
            state.next_run = Some(next_run);
        }
        
        crate::logger::log_info("scheduler", &format!("下次优化将在 {} 分钟后执行", interval_minutes));
        
        // 等待指定时间或被取消
        let sleep_duration = std::time::Duration::from_secs(interval_minutes as u64 * 60);
        tokio::select! {
            _ = tokio::time::sleep(sleep_duration) => {
                // 时间到，执行优化任务
                run_scheduled_optimization().await;
            }
            _ = SCHEDULER_CANCEL.notified() => {
                // 被取消，重新检查配置
                crate::logger::log_info("scheduler", "调度器配置已更新");
                continue;
            }
        }
    }
}

/// 执行定时优化任务
async fn run_scheduled_optimization() {
    let (auto_update, notify) = {
        let mut state = SCHEDULER_STATE.write().await;
        if state.is_running {
            crate::logger::log_warning("scheduler", "上一次优化任务仍在运行，跳过本次执行");
            return;
        }
        state.is_running = true;
        (state.config.auto_update, state.config.notify)
    };
    
    crate::logger::log_info("scheduler", "开始执行定时优化任务");
    
    // 加载预设域名
    let domains = crate::presets::load_presets();
    if domains.is_empty() {
        crate::logger::log_warning("scheduler", "没有预设域名，跳过优化");
        let mut state = SCHEDULER_STATE.write().await;
        state.is_running = false;
        state.last_run = Some(chrono::Utc::now());
        return;
    }
    
    let mut success_count = 0;
    let mut improved_domains: Vec<(String, String, u64)> = Vec::new(); // (domain, ip, latency)
    
    for domain in &domains {
        match resolve_and_optimize(&domain, auto_update).await {
            Ok(Some((ip, latency))) => {
                success_count += 1;
                improved_domains.push((domain.clone(), ip, latency));
            }
            Ok(None) => {
                success_count += 1;
            }
            Err(e) => {
                crate::logger::log_error("scheduler", &format!("优化 {} 失败: {}", domain, e), None);
            }
        }
    }
    
    // 更新状态
    {
        let mut state = SCHEDULER_STATE.write().await;
        state.is_running = false;
        state.last_run = Some(chrono::Utc::now());
    }
    
    crate::logger::log_info("scheduler", &format!(
        "定时优化完成: {}/{} 成功, {} 个域名有更优 IP",
        success_count, domains.len(), improved_domains.len()
    ));
    
    // 如果启用通知且有改进，记录详细信息
    if notify && !improved_domains.is_empty() {
        for (domain, ip, latency) in &improved_domains {
            crate::logger::log_info("scheduler", &format!(
                "域名 {} 已更新为 {} (延迟: {}ms)",
                domain, ip, latency
            ));
        }
    }
}

/// 解析并优化单个域名
async fn resolve_and_optimize(domain: &str, auto_write: bool) -> Result<Option<(String, u64)>, AppError> {
    // 获取当前 hosts 中的 IP
    let current_entries = crate::hosts::get_host_entries()?;
    let current_ip = current_entries.iter()
        .find(|e| e.domain == domain)
        .map(|e| e.ip.clone());
    
    // 解析域名获取所有 IP
    let ips = crate::dns::resolve_domain(domain).await?;
    if ips.is_empty() {
        return Ok(None);
    }
    
    // 过滤黑名单
    let blacklisted = crate::blacklist::get_blacklisted_ips();
    let filtered_ips: Vec<_> = ips.into_iter()
        .filter(|ip| !blacklisted.contains(&ip.to_string()))
        .collect();
    
    if filtered_ips.is_empty() {
        return Ok(None);
    }
    
    // Ping 测试
    let results = crate::ping::ping_ips_parallel(filtered_ips).await;
    
    // 找到最佳 IP
    let best = results.iter()
        .filter(|r| r.latency.is_some())
        .min_by_key(|r| r.latency.unwrap());
    
    let best = match best {
        Some(b) => b,
        None => return Ok(None),
    };
    
    // 检查是否比当前 IP 更好
    let should_update = if let Some(ref current) = current_ip {
        if current == &best.ip {
            false // 已经是最佳 IP
        } else {
            // 测试当前 IP 的延迟
            if let Some(current_result) = results.iter().find(|r| &r.ip == current) {
                match (current_result.latency, best.latency) {
                    (Some(current_lat), Some(best_lat)) => best_lat < current_lat,
                    (None, Some(_)) => true, // 当前超时，新的可用
                    _ => false,
                }
            } else {
                true // 当前 IP 不在解析结果中
            }
        }
    } else {
        true // 没有当前配置
    };
    
    if should_update && auto_write {
        crate::hosts::write_host_entry(domain, &best.ip)?;
        
        // 记录历史
        let _ = crate::history::add_history_entry(crate::history::HistoryEntry {
            id: uuid::Uuid::new_v4().to_string(),
            timestamp: chrono::Utc::now(),
            domain: domain.to_string(),
            ip: best.ip.clone(),
            latency: best.latency,
            action: "scheduled".to_string(),
        });
        
        return Ok(Some((best.ip.clone(), best.latency.unwrap_or(0))));
    }
    
    Ok(None)
}

/// 手动触发一次优化（用于测试）
#[allow(dead_code)]
pub async fn trigger_optimization() {
    run_scheduled_optimization().await;
}
