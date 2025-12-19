use crate::AppError;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const MAX_HISTORY: usize = 100;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub domain: String,
    pub ip: String,
    pub latency: Option<u64>,
    pub action: String, // "write" | "rollback"
}

fn get_history_path() -> PathBuf {
    if let Some(config_dir) = dirs::config_dir() {
        let app_dir = config_dir.join("netoptim");
        if !app_dir.exists() {
            let _ = fs::create_dir_all(&app_dir);
        }
        app_dir.join("history.json")
    } else {
        PathBuf::from("history.json")
    }
}

pub fn load_history() -> Vec<HistoryEntry> {
    let path = get_history_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(history) = serde_json::from_str(&content) {
                return history;
            }
        }
    }
    vec![]
}

pub fn save_history(history: &[HistoryEntry]) -> Result<(), AppError> {
    let path = get_history_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let content = serde_json::to_string_pretty(history)
        .map_err(|e| AppError::Other(format!("序列化失败: {}", e)))?;
    fs::write(&path, content)?;
    Ok(())
}

pub fn add_history_entry(entry: HistoryEntry) -> Result<(), AppError> {
    let mut history = load_history();
    history.insert(0, entry);

    // 限制历史记录数量
    if history.len() > MAX_HISTORY {
        history.truncate(MAX_HISTORY);
    }

    save_history(&history)
}

pub fn clear_history() -> Result<(), AppError> {
    save_history(&[])
}
