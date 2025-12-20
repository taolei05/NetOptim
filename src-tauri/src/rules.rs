use crate::AppError;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleSource {
    pub id: String,
    pub name: String,
    pub url: String,
    pub enabled: bool,
    pub last_updated: Option<String>,
    pub entry_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RuleConfig {
    pub sources: Vec<RuleSource>,
    pub auto_update: bool,
    pub update_interval_hours: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedRule {
    pub ip: String,
    pub domain: String,
    pub source: String,
}

fn get_rules_config_path() -> PathBuf {
    if let Some(config_dir) = dirs::config_dir() {
        let app_dir = config_dir.join("netoptim");
        if !app_dir.exists() {
            let _ = fs::create_dir_all(&app_dir);
        }
        app_dir.join("rules.json")
    } else {
        PathBuf::from("rules.json")
    }
}

fn get_rules_cache_dir() -> PathBuf {
    if let Some(config_dir) = dirs::config_dir() {
        let cache_dir = config_dir.join("netoptim").join("rules_cache");
        if !cache_dir.exists() {
            let _ = fs::create_dir_all(&cache_dir);
        }
        cache_dir
    } else {
        PathBuf::from("rules_cache")
    }
}

pub fn load_rule_config() -> RuleConfig {
    let path = get_rules_config_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(config) = serde_json::from_str(&content) {
                return config;
            }
        }
    }
    RuleConfig {
        sources: vec![],
        auto_update: false,
        update_interval_hours: 24,
    }
}

pub fn save_rule_config(config: &RuleConfig) -> Result<(), AppError> {
    let path = get_rules_config_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let content = serde_json::to_string_pretty(config)
        .map_err(|e| AppError::Other(format!("序列化失败: {}", e)))?;
    fs::write(&path, content)?;
    Ok(())
}

/// 添加规则源
pub fn add_rule_source(name: &str, url: &str) -> Result<RuleSource, AppError> {
    let mut config = load_rule_config();
    
    // 检查是否已存在
    if config.sources.iter().any(|s| s.url == url) {
        return Err(AppError::Other("该规则源已存在".to_string()));
    }
    
    let source = RuleSource {
        id: uuid::Uuid::new_v4().to_string(),
        name: name.to_string(),
        url: url.to_string(),
        enabled: true,
        last_updated: None,
        entry_count: 0,
    };
    
    config.sources.push(source.clone());
    save_rule_config(&config)?;
    
    Ok(source)
}

/// 删除规则源
pub fn remove_rule_source(id: &str) -> Result<(), AppError> {
    let mut config = load_rule_config();
    config.sources.retain(|s| s.id != id);
    save_rule_config(&config)?;
    
    // 删除缓存文件
    let cache_path = get_rules_cache_dir().join(format!("{}.txt", id));
    let _ = fs::remove_file(cache_path);
    
    Ok(())
}

/// 启用/禁用规则源
pub fn toggle_rule_source(id: &str, enabled: bool) -> Result<(), AppError> {
    let mut config = load_rule_config();
    if let Some(source) = config.sources.iter_mut().find(|s| s.id == id) {
        source.enabled = enabled;
    }
    save_rule_config(&config)
}

/// 从 URL 获取规则
pub async fn fetch_rules(url: &str) -> Result<String, AppError> {
    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| AppError::Other(e.to_string()))?;
    
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| AppError::Other(format!("获取规则失败: {}", e)))?;
    
    if !response.status().is_success() {
        return Err(AppError::Other(format!("HTTP 错误: {}", response.status())));
    }
    
    response
        .text()
        .await
        .map_err(|e| AppError::Other(format!("读取响应失败: {}", e)))
}

/// 解析 hosts 格式的规则
pub fn parse_hosts_rules(content: &str, source: &str) -> Vec<ParsedRule> {
    let mut rules = Vec::new();
    
    for line in content.lines() {
        let line = line.trim();
        
        // 跳过空行和注释
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 2 {
            let ip = parts[0];
            
            // 验证 IP 格式
            if !is_valid_ip(ip) {
                continue;
            }
            
            // 跳过 localhost 相关
            if ip == "127.0.0.1" || ip == "0.0.0.0" || ip == "::1" {
                // 这些通常是广告屏蔽规则，跳过
                continue;
            }
            
            for domain in &parts[1..] {
                if is_valid_domain(domain) {
                    rules.push(ParsedRule {
                        ip: ip.to_string(),
                        domain: domain.to_string(),
                        source: source.to_string(),
                    });
                }
            }
        }
    }
    
    rules
}

fn is_valid_ip(ip: &str) -> bool {
    ip.parse::<std::net::IpAddr>().is_ok()
}

fn is_valid_domain(domain: &str) -> bool {
    !domain.is_empty() 
        && domain.contains('.') 
        && !domain.starts_with('.') 
        && !domain.ends_with('.')
        && domain.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '-' || c == '_')
}

/// 更新规则源
pub async fn update_rule_source(id: &str) -> Result<usize, AppError> {
    let mut config = load_rule_config();
    let source = config.sources.iter_mut().find(|s| s.id == id)
        .ok_or_else(|| AppError::Other("规则源不存在".to_string()))?;
    
    let content = fetch_rules(&source.url).await?;
    let rules = parse_hosts_rules(&content, &source.name);
    
    // 保存到缓存
    let cache_path = get_rules_cache_dir().join(format!("{}.txt", id));
    fs::write(&cache_path, &content)?;
    
    source.last_updated = Some(chrono::Utc::now().to_rfc3339());
    source.entry_count = rules.len();
    
    save_rule_config(&config)?;
    
    Ok(rules.len())
}

/// 更新所有启用的规则源
pub async fn update_all_rules() -> Result<HashMap<String, usize>, AppError> {
    let config = load_rule_config();
    let mut results = HashMap::new();
    
    for source in config.sources.iter().filter(|s| s.enabled) {
        match update_rule_source(&source.id).await {
            Ok(count) => {
                results.insert(source.name.clone(), count);
            }
            Err(e) => {
                results.insert(source.name.clone(), 0);
                eprintln!("更新规则源 {} 失败: {}", source.name, e);
            }
        }
    }
    
    Ok(results)
}

/// 获取所有已启用规则源的规则
pub fn get_all_rules() -> Vec<ParsedRule> {
    let config = load_rule_config();
    let mut all_rules = Vec::new();
    
    for source in config.sources.iter().filter(|s| s.enabled) {
        let cache_path = get_rules_cache_dir().join(format!("{}.txt", source.id));
        if let Ok(content) = fs::read_to_string(&cache_path) {
            let rules = parse_hosts_rules(&content, &source.name);
            all_rules.extend(rules);
        }
    }
    
    all_rules
}

/// 合并规则到 hosts（返回合并后的条目）
#[allow(dead_code)]
pub fn merge_rules_with_hosts(optimized: &[(String, String)]) -> Vec<(String, String)> {
    let mut result: HashMap<String, String> = HashMap::new();
    
    // 先添加第三方规则
    for rule in get_all_rules() {
        result.insert(rule.domain, rule.ip);
    }
    
    // 优选结果优先级更高，覆盖第三方规则
    for (domain, ip) in optimized {
        result.insert(domain.clone(), ip.clone());
    }
    
    result.into_iter().collect()
}
