use crate::AppError;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlacklistEntry {
    pub ip: String,
    pub domain: Option<String>,
    pub reason: Option<String>,
    pub added_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Blacklist {
    pub entries: Vec<BlacklistEntry>,
}

fn get_blacklist_path() -> PathBuf {
    if let Some(config_dir) = dirs::config_dir() {
        let app_dir = config_dir.join("netoptim");
        if !app_dir.exists() {
            let _ = fs::create_dir_all(&app_dir);
        }
        app_dir.join("blacklist.json")
    } else {
        PathBuf::from("blacklist.json")
    }
}

pub fn load_blacklist() -> Blacklist {
    let path = get_blacklist_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(blacklist) = serde_json::from_str(&content) {
                return blacklist;
            }
        }
    }
    Blacklist::default()
}

pub fn save_blacklist(blacklist: &Blacklist) -> Result<(), AppError> {
    let path = get_blacklist_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let content = serde_json::to_string_pretty(blacklist)
        .map_err(|e| AppError::Other(format!("序列化失败: {}", e)))?;
    fs::write(&path, content)?;
    Ok(())
}

pub fn add_to_blacklist(ip: &str, domain: Option<&str>, reason: Option<&str>) -> Result<(), AppError> {
    let mut blacklist = load_blacklist();
    
    // 检查是否已存在
    if blacklist.entries.iter().any(|e| e.ip == ip) {
        return Ok(());
    }
    
    blacklist.entries.push(BlacklistEntry {
        ip: ip.to_string(),
        domain: domain.map(|s| s.to_string()),
        reason: reason.map(|s| s.to_string()),
        added_at: chrono::Utc::now().to_rfc3339(),
    });
    
    save_blacklist(&blacklist)
}

pub fn remove_from_blacklist(ip: &str) -> Result<(), AppError> {
    let mut blacklist = load_blacklist();
    blacklist.entries.retain(|e| e.ip != ip);
    save_blacklist(&blacklist)
}

pub fn is_blacklisted(ip: &str) -> bool {
    let blacklist = load_blacklist();
    blacklist.entries.iter().any(|e| e.ip == ip)
}

pub fn get_blacklisted_ips() -> HashSet<String> {
    let blacklist = load_blacklist();
    blacklist.entries.iter().map(|e| e.ip.clone()).collect()
}

pub fn filter_blacklisted(ips: Vec<String>) -> Vec<String> {
    let blacklisted = get_blacklisted_ips();
    ips.into_iter().filter(|ip| !blacklisted.contains(ip)).collect()
}
