use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use thiserror::Error;

mod dns;
mod history;
mod hosts;
mod i18n;
mod ipinfo;
mod ping;
mod presets;
mod scheduler;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("DNS 解析失败: {0}")]
    DnsError(String),
    #[error("Ping 失败: {0}")]
    PingError(String),
    #[error("文件操作失败: {0}")]
    IoError(#[from] std::io::Error),
    #[error("权限不足: {0}")]
    PermissionError(String),
    #[error("{0}")]
    Other(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpResult {
    pub ip: String,
    pub latency: Option<u64>,
    pub location: Option<String>,
    pub is_cdn: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolveResult {
    pub domain: String,
    pub results: Vec<IpResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchResult {
    pub domain: String,
    pub best_ip: Option<String>,
    pub latency: Option<u64>,
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HostEntry {
    pub ip: String,
    pub domain: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectivityResult {
    pub reachable: bool,
    pub latency: Option<u64>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyCheckResult {
    pub needs_proxy: bool,
    pub message: String,
}

// ==================== 核心功能 ====================

/// 解析域名并测速（并行）
#[tauri::command]
async fn resolve_and_ping(domain: String, lang: Option<String>) -> Result<ResolveResult, AppError> {
    let ips = dns::resolve_domain(&domain).await?;

    if ips.is_empty() {
        return Err(AppError::DnsError("未找到任何 IP 地址".to_string()));
    }

    // 并行 Ping
    let mut results = ping::ping_ips_parallel(ips).await;

    // 检测 CDN 和获取地理位置
    let ip_strings: Vec<String> = results.iter().map(|r| r.ip.clone()).collect();
    let lang_str = lang.unwrap_or_else(|| "zh-CN".to_string());
    let locations = ipinfo::get_ip_locations_batch(&ip_strings, &lang_str).await;

    for result in &mut results {
        result.is_cdn = ipinfo::detect_cdn(&result.ip).is_some();
        result.location = locations.get(&result.ip).cloned();
    }

    Ok(ResolveResult { domain, results })
}

/// 批量优化所有预设域名
#[tauri::command]
async fn batch_optimize(auto_write: bool, lang: Option<String>) -> Result<Vec<BatchResult>, AppError> {
    let domains = presets::load_presets();
    let mut results = Vec::new();

    for domain in domains {
        let result = match resolve_and_ping(domain.clone(), lang.clone()).await {
            Ok(resolve_result) => {
                if let Some(best) = resolve_result.results.first() {
                    if auto_write {
                        if let Err(e) = hosts::write_host_entry(&domain, &best.ip) {
                            BatchResult {
                                domain,
                                best_ip: Some(best.ip.clone()),
                                latency: best.latency,
                                success: false,
                                error: Some(e.to_string()),
                            }
                        } else {
                            // 记录历史
                            let _ = history::add_history_entry(history::HistoryEntry {
                                id: uuid::Uuid::new_v4().to_string(),
                                timestamp: Utc::now(),
                                domain: domain.clone(),
                                ip: best.ip.clone(),
                                latency: best.latency,
                                action: "write".to_string(),
                            });

                            BatchResult {
                                domain,
                                best_ip: Some(best.ip.clone()),
                                latency: best.latency,
                                success: true,
                                error: None,
                            }
                        }
                    } else {
                        BatchResult {
                            domain,
                            best_ip: Some(best.ip.clone()),
                            latency: best.latency,
                            success: true,
                            error: None,
                        }
                    }
                } else {
                    BatchResult {
                        domain,
                        best_ip: None,
                        latency: None,
                        success: false,
                        error: Some("未找到可用 IP".to_string()),
                    }
                }
            }
            Err(e) => BatchResult {
                domain,
                best_ip: None,
                latency: None,
                success: false,
                error: Some(e.to_string()),
            },
        };
        results.push(result);
    }

    // 刷新 DNS
    if auto_write {
        let _ = hosts::flush_dns_cache();
    }

    Ok(results)
}

/// 写入 hosts 文件
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WriteResult {
    pub ip: String,
    pub domain: String,
}

#[tauri::command]
async fn write_to_hosts(domain: String, ip: String, latency: Option<u64>) -> Result<WriteResult, AppError> {
    hosts::write_host_entry(&domain, &ip)?;

    // 记录历史
    let _ = history::add_history_entry(history::HistoryEntry {
        id: uuid::Uuid::new_v4().to_string(),
        timestamp: Utc::now(),
        domain: domain.clone(),
        ip: ip.clone(),
        latency,
        action: "write".to_string(),
    });

    Ok(WriteResult { ip, domain })
}

/// 刷新 DNS 缓存
#[tauri::command]
async fn flush_dns() -> Result<(), AppError> {
    hosts::flush_dns_cache()?;
    Ok(())
}

/// 测试连通性
#[tauri::command]
async fn test_connectivity(domain: String) -> ConnectivityResult {
    match ping::test_connectivity(&domain).await {
        Ok((reachable, latency)) => ConnectivityResult {
            reachable,
            latency: Some(latency),
            error: None,
        },
        Err(e) => ConnectivityResult {
            reachable: false,
            latency: None,
            error: Some(e),
        },
    }
}

/// 检测是否需要代理
#[tauri::command]
async fn check_proxy_needed(domain: String) -> ProxyCheckResult {
    let (needs_proxy, message) = ipinfo::check_proxy_needed(&domain).await;
    ProxyCheckResult {
        needs_proxy,
        message,
    }
}

// ==================== 预设管理 ====================

#[tauri::command]
fn get_presets() -> Vec<String> {
    presets::load_presets()
}

#[tauri::command]
fn save_presets(domains: Vec<String>) -> Result<(), AppError> {
    presets::save_presets(&domains)?;
    Ok(())
}

/// 导出预设
#[tauri::command]
fn export_presets() -> Result<String, AppError> {
    let presets = presets::load_presets();
    serde_json::to_string_pretty(&presets).map_err(|e| AppError::Other(e.to_string()))
}

/// 导入预设
#[tauri::command]
fn import_presets(json: String, merge: bool) -> Result<Vec<String>, AppError> {
    let new_presets: Vec<String> =
        serde_json::from_str(&json).map_err(|e| AppError::Other(format!("JSON 解析失败: {}", e)))?;

    let final_presets = if merge {
        let mut existing = presets::load_presets();
        for p in new_presets {
            if !existing.contains(&p) {
                existing.push(p);
            }
        }
        existing
    } else {
        new_presets
    };

    presets::save_presets(&final_presets)?;
    Ok(final_presets)
}

// ==================== Hosts 管理 ====================
#[tauri::command]
fn check_admin() -> bool {
    hosts::is_admin()
}

/// 获取当前 hosts 文件中的条目
#[tauri::command]
fn get_hosts_entries() -> Result<Vec<HostEntry>, AppError> {
    hosts::get_host_entries()
}

/// 删除 hosts 条目
#[tauri::command]
fn remove_hosts_entry(domain: String) -> Result<(), AppError> {
    hosts::remove_host_entry(&domain)
}

/// 导出 hosts 配置
#[tauri::command]
fn export_hosts() -> Result<String, AppError> {
    let entries = hosts::get_host_entries()?;
    serde_json::to_string_pretty(&entries).map_err(|e| AppError::Other(e.to_string()))
}

/// 导入 hosts 配置
#[tauri::command]
fn import_hosts(json: String) -> Result<(), AppError> {
    let entries: Vec<HostEntry> =
        serde_json::from_str(&json).map_err(|e| AppError::Other(format!("JSON 解析失败: {}", e)))?;

    for entry in entries {
        hosts::write_host_entry(&entry.domain, &entry.ip)?;
    }

    hosts::flush_dns_cache()?;
    Ok(())
}

// ==================== 历史记录 ====================

#[tauri::command]
fn get_history() -> Vec<history::HistoryEntry> {
    history::load_history()
}

#[tauri::command]
fn clear_history() -> Result<(), AppError> {
    history::clear_history()
}

/// 回滚到历史记录
#[tauri::command]
fn rollback_history(entry_id: String) -> Result<(), AppError> {
    let history = history::load_history();
    if let Some(entry) = history.iter().find(|e| e.id == entry_id) {
        hosts::write_host_entry(&entry.domain, &entry.ip)?;

        // 记录回滚操作
        let _ = history::add_history_entry(history::HistoryEntry {
            id: uuid::Uuid::new_v4().to_string(),
            timestamp: Utc::now(),
            domain: entry.domain.clone(),
            ip: entry.ip.clone(),
            latency: entry.latency,
            action: "rollback".to_string(),
        });

        hosts::flush_dns_cache()?;
        Ok(())
    } else {
        Err(AppError::Other("未找到历史记录".to_string()))
    }
}

// ==================== 定时任务 ====================

#[tauri::command]
fn get_scheduler_config() -> scheduler::SchedulerConfig {
    scheduler::load_scheduler_config()
}

#[tauri::command]
fn save_scheduler_config(config: scheduler::SchedulerConfig) -> Result<(), AppError> {
    scheduler::save_scheduler_config(&config)
}

// ==================== 设置 ====================

#[tauri::command]
fn get_settings() -> i18n::AppSettings {
    i18n::load_settings()
}

#[tauri::command]
fn save_settings(settings: i18n::AppSettings) -> Result<(), AppError> {
    i18n::save_settings(&settings)
}

// ==================== IP 信息 ====================

#[tauri::command]
async fn get_ip_location(ip: String) -> Option<String> {
    ipinfo::get_ip_location(&ip).await
}

#[tauri::command]
fn detect_cdn(ip: String) -> Option<String> {
    ipinfo::detect_cdn(&ip)
}

// ==================== 应用入口 ====================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            // 创建系统托盘
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let show = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
            let optimize = MenuItem::with_id(app, "optimize", "一键优化", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&show, &optimize, &quit])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "optimize" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("trigger-batch-optimize", ());
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // 核心功能
            resolve_and_ping,
            batch_optimize,
            write_to_hosts,
            flush_dns,
            test_connectivity,
            check_proxy_needed,
            // 预设管理
            get_presets,
            save_presets,
            export_presets,
            import_presets,
            // Hosts 管理
            check_admin,
            get_hosts_entries,
            remove_hosts_entry,
            export_hosts,
            import_hosts,
            // 历史记录
            get_history,
            clear_history,
            rollback_history,
            // 定时任务
            get_scheduler_config,
            save_scheduler_config,
            // 设置
            get_settings,
            save_settings,
            // IP 信息
            get_ip_location,
            detect_cdn,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
