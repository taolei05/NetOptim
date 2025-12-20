use crate::AppError;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use std::sync::RwLock;

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

// 缓存黑名单数据
lazy_static::lazy_static! {
    static ref BLACKLIST_CACHE: RwLock<Option<Blacklist>> = RwLock::new(None);
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

#[allow(dead_code)]
fn invalidate_cache() {
    if let Ok(mut cache) = BLACKLIST_CACHE.write() {
        *cache = None;
    }
}

pub fn load_blacklist() -> Blacklist {
    // 先检查缓存
    if let Ok(cache) = BLACKLIST_CACHE.read() {
        if let Some(ref blacklist) = *cache {
            return blacklist.clone();
        }
    }
    
    // 从文件加载
    let path = get_blacklist_path();
    let blacklist = if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            Blacklist::default()
        }
    } else {
        Blacklist::default()
    };
    
    // 更新缓存
    if let Ok(mut cache) = BLACKLIST_CACHE.write() {
        *cache = Some(blacklist.clone());
    }
    
    blacklist
}

pub fn save_blacklist(blacklist: &Blacklist) -> Result<(), AppError> {
    let path = get_blacklist_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let content = serde_json::to_string_pretty(blacklist)
        .map_err(|e| AppError::Other(format!("序列化失败: {}", e)))?;
    fs::write(&path, content)?;
    
    // 更新缓存
    if let Ok(mut cache) = BLACKLIST_CACHE.write() {
        *cache = Some(blacklist.clone());
    }
    
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

pub fn get_blacklisted_ips() -> HashSet<String> {
    let blacklist = load_blacklist();
    blacklist.entries.iter().map(|e| e.ip.clone()).collect()
}
