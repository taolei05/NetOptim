use crate::AppError;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

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
    Ok(())
}
