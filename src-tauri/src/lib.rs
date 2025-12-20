use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use thiserror::Error;

mod backup;
mod blacklist;
mod diagnostic;
mod dns;
mod history;
mod hosts;
mod i18n;
mod ipinfo;
mod logger;
mod monitor;
mod ping;
mod presets;
mod rules;
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

    // 过滤黑名单 IP
    let blacklisted = blacklist::get_blacklisted_ips();
    let filtered_ips: Vec<_> = ips.into_iter()
        .filter(|ip| !blacklisted.contains(&ip.to_string()))
        .collect();

    if filtered_ips.is_empty() {
        return Err(AppError::DnsError("所有 IP 都在黑名单中".to_string()));
    }

    // 记录日志
    logger::log_info("dns", &format!("解析域名 {} 获取到 {} 个 IP", domain, filtered_ips.len()));

    // 并行 Ping
    let mut results = ping::ping_ips_parallel(filtered_ips).await;

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

#[tauri::command]
async fn get_scheduler_state() -> scheduler::SchedulerState {
    scheduler::get_scheduler_state().await
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

// ==================== IP 黑名单 ====================

#[tauri::command]
fn get_blacklist() -> blacklist::Blacklist {
    blacklist::load_blacklist()
}

#[tauri::command]
fn add_to_blacklist(ip: String, domain: Option<String>, reason: Option<String>) -> Result<(), AppError> {
    blacklist::add_to_blacklist(&ip, domain.as_deref(), reason.as_deref())
}

#[tauri::command]
fn remove_from_blacklist(ip: String) -> Result<(), AppError> {
    blacklist::remove_from_blacklist(&ip)
}

// ==================== 网络监控 ====================

#[tauri::command]
fn get_monitor_config() -> monitor::MonitorConfig {
    monitor::load_monitor_config()
}

#[tauri::command]
async fn save_monitor_config(config: monitor::MonitorConfig) -> Result<(), AppError> {
    monitor::update_monitor_config(config).await
}

#[tauri::command]
async fn add_to_monitor(domain: String, ip: String, baseline_latency: Option<u64>) {
    monitor::add_domain_to_monitor(&domain, &ip, baseline_latency).await
}

#[tauri::command]
async fn remove_from_monitor(domain: String) {
    monitor::remove_domain_from_monitor(&domain).await
}

#[tauri::command]
async fn get_monitor_state() -> monitor::MonitorState {
    monitor::get_monitor_state().await
}

#[tauri::command]
async fn check_monitored_domain(domain: String) -> Result<monitor::MonitorRecord, AppError> {
    monitor::check_domain(&domain).await
}

#[tauri::command]
async fn check_all_monitored_domains() -> Vec<(String, monitor::MonitorRecord)> {
    monitor::check_all_domains().await
}

// ==================== 备份恢复 ====================

#[tauri::command]
fn get_backups() -> backup::BackupList {
    backup::load_backup_list()
}

#[tauri::command]
fn create_backup(description: Option<String>) -> Result<backup::HostsBackup, AppError> {
    backup::create_backup(description.as_deref())
}

#[tauri::command]
fn restore_backup(backup_id: String) -> Result<(), AppError> {
    backup::restore_backup(&backup_id)
}

#[tauri::command]
fn delete_backup(backup_id: String) -> Result<(), AppError> {
    backup::delete_backup(&backup_id)
}

#[tauri::command]
fn get_backup_content(backup_id: String) -> Result<String, AppError> {
    backup::get_backup_content(&backup_id)
}

// ==================== 网络诊断 ====================

#[tauri::command]
async fn run_traceroute(target: String, max_hops: Option<u32>) -> Result<diagnostic::TracerouteResult, AppError> {
    diagnostic::traceroute(&target, max_hops.unwrap_or(15)).await
}

#[tauri::command]
async fn run_dns_query(domain: String, dns_server: Option<String>) -> Result<diagnostic::DnsQueryResult, AppError> {
    diagnostic::dns_query(&domain, dns_server.as_deref()).await
}

#[tauri::command]
async fn run_ping_diagnostic(target: String, count: Option<u32>) -> Result<diagnostic::PingDiagResult, AppError> {
    diagnostic::ping_diagnostic(&target, count.unwrap_or(4)).await
}

#[tauri::command]
async fn run_http_diagnostic(url: String) -> Result<diagnostic::HttpDiagResult, AppError> {
    diagnostic::http_diagnostic(&url).await
}

#[tauri::command]
async fn run_full_diagnostic(target: String) -> Result<diagnostic::NetworkDiagnostic, AppError> {
    diagnostic::full_diagnostic(&target).await
}

// ==================== 日志系统 ====================

#[tauri::command]
fn get_logs(lines: Option<usize>) -> Vec<String> {
    logger::read_logs(lines)
}

#[tauri::command]
fn clear_logs() {
    logger::clear_logs()
}

#[tauri::command]
fn get_log_files() -> Vec<(String, u64)> {
    logger::get_log_files()
}

// ==================== 规则管理 ====================

#[tauri::command]
fn get_rule_config() -> rules::RuleConfig {
    rules::load_rule_config()
}

#[tauri::command]
fn save_rule_config(config: rules::RuleConfig) -> Result<(), AppError> {
    rules::save_rule_config(&config)
}

#[tauri::command]
fn add_rule_source(name: String, url: String) -> Result<rules::RuleSource, AppError> {
    rules::add_rule_source(&name, &url)
}

#[tauri::command]
fn remove_rule_source(id: String) -> Result<(), AppError> {
    rules::remove_rule_source(&id)
}

#[tauri::command]
fn toggle_rule_source(id: String, enabled: bool) -> Result<(), AppError> {
    rules::toggle_rule_source(&id, enabled)
}

#[tauri::command]
async fn update_rule_source(id: String) -> Result<usize, AppError> {
    rules::update_rule_source(&id).await
}

#[tauri::command]
async fn update_all_rules() -> Result<std::collections::HashMap<String, usize>, AppError> {
    rules::update_all_rules().await
}

#[tauri::command]
fn get_all_rules() -> Vec<rules::ParsedRule> {
    rules::get_all_rules()
}

// ==================== 应用入口 ====================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            // 启动定时调度器
            scheduler::start_scheduler();
            // 启动网络监控循环
            monitor::start_monitor();
            // 启动规则自动更新
            rules::start_rules_updater();
            
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
            get_scheduler_state,
            // 设置
            get_settings,
            save_settings,
            // IP 信息
            get_ip_location,
            detect_cdn,
            // IP 黑名单
            get_blacklist,
            add_to_blacklist,
            remove_from_blacklist,
            // 网络监控
            get_monitor_config,
            save_monitor_config,
            add_to_monitor,
            remove_from_monitor,
            get_monitor_state,
            check_monitored_domain,
            check_all_monitored_domains,
            // 备份恢复
            get_backups,
            create_backup,
            restore_backup,
            delete_backup,
            get_backup_content,
            // 网络诊断
            run_traceroute,
            run_dns_query,
            run_ping_diagnostic,
            run_http_diagnostic,
            run_full_diagnostic,
            // 日志系统
            get_logs,
            clear_logs,
            get_log_files,
            // 规则管理
            get_rule_config,
            save_rule_config,
            add_rule_source,
            remove_rule_source,
            toggle_rule_source,
            update_rule_source,
            update_all_rules,
            get_all_rules,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
