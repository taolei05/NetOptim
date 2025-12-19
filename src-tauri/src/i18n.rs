use crate::AppError;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum Language {
    #[serde(rename = "zh-CN")]
    ZhCN,
    #[serde(rename = "en-US")]
    EnUS,
}

impl Default for Language {
    fn default() -> Self {
        // 尝试检测系统语言
        if let Ok(lang) = std::env::var("LANG") {
            if lang.starts_with("zh") {
                return Language::ZhCN;
            }
        }
        Language::ZhCN
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub language: Language,
    pub minimize_to_tray: bool,
    pub start_minimized: bool,
    pub check_updates: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            language: Language::default(),
            minimize_to_tray: true,
            start_minimized: false,
            check_updates: true,
        }
    }
}

fn get_settings_path() -> PathBuf {
    if let Some(config_dir) = dirs::config_dir() {
        let app_dir = config_dir.join("netoptim");
        if !app_dir.exists() {
            let _ = fs::create_dir_all(&app_dir);
        }
        app_dir.join("settings.json")
    } else {
        PathBuf::from("settings.json")
    }
}

pub fn load_settings() -> AppSettings {
    let path = get_settings_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(settings) = serde_json::from_str(&content) {
                return settings;
            }
        }
    }
    AppSettings::default()
}

pub fn save_settings(settings: &AppSettings) -> Result<(), AppError> {
    let path = get_settings_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let content = serde_json::to_string_pretty(settings)
        .map_err(|e| AppError::Other(format!("序列化失败: {}", e)))?;
    fs::write(&path, content)?;
    Ok(())
}
