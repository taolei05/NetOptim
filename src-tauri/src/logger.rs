use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;

const MAX_LOG_SIZE: u64 = 5 * 1024 * 1024; // 5MB
const MAX_LOG_FILES: usize = 5;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LogLevel {
    Debug,
    Info,
    Warning,
    Error,
}

impl std::fmt::Display for LogLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LogLevel::Debug => write!(f, "DEBUG"),
            LogLevel::Info => write!(f, "INFO"),
            LogLevel::Warning => write!(f, "WARN"),
            LogLevel::Error => write!(f, "ERROR"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: DateTime<Utc>,
    pub level: LogLevel,
    pub module: String,
    pub message: String,
    pub details: Option<String>,
}

fn get_log_dir() -> PathBuf {
    if let Some(config_dir) = dirs::config_dir() {
        let log_dir = config_dir.join("netoptim").join("logs");
        if !log_dir.exists() {
            let _ = fs::create_dir_all(&log_dir);
        }
        log_dir
    } else {
        PathBuf::from("logs")
    }
}

fn get_current_log_path() -> PathBuf {
    get_log_dir().join("netoptim.log")
}

fn rotate_logs() {
    let log_path = get_current_log_path();
    
    if !log_path.exists() {
        return;
    }
    
    if let Ok(metadata) = fs::metadata(&log_path) {
        if metadata.len() < MAX_LOG_SIZE {
            return;
        }
    }
    
    // 轮转日志文件
    let log_dir = get_log_dir();
    
    // 删除最旧的日志
    let oldest = log_dir.join(format!("netoptim.{}.log", MAX_LOG_FILES));
    let _ = fs::remove_file(&oldest);
    
    // 重命名现有日志
    for i in (1..MAX_LOG_FILES).rev() {
        let old_name = log_dir.join(format!("netoptim.{}.log", i));
        let new_name = log_dir.join(format!("netoptim.{}.log", i + 1));
        let _ = fs::rename(&old_name, &new_name);
    }
    
    // 重命名当前日志
    let new_name = log_dir.join("netoptim.1.log");
    let _ = fs::rename(&log_path, &new_name);
}

pub fn log(level: LogLevel, module: &str, message: &str, details: Option<&str>) {
    rotate_logs();
    
    let entry = LogEntry {
        timestamp: Utc::now(),
        level: level.clone(),
        module: module.to_string(),
        message: message.to_string(),
        details: details.map(|s| s.to_string()),
    };
    
    let log_line = format!(
        "[{}] [{}] [{}] {}{}\n",
        entry.timestamp.format("%Y-%m-%d %H:%M:%S"),
        entry.level,
        entry.module,
        entry.message,
        entry.details.as_ref().map(|d| format!(" | {}", d)).unwrap_or_default()
    );
    
    let log_path = get_current_log_path();
    
    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
    {
        let _ = file.write_all(log_line.as_bytes());
    }
}

pub fn log_info(module: &str, message: &str) {
    log(LogLevel::Info, module, message, None);
}

#[allow(dead_code)]
pub fn log_error(module: &str, message: &str, details: Option<&str>) {
    log(LogLevel::Error, module, message, details);
}

#[allow(dead_code)]
pub fn log_warning(module: &str, message: &str) {
    log(LogLevel::Warning, module, message, None);
}

#[allow(dead_code)]
pub fn log_debug(module: &str, message: &str) {
    log(LogLevel::Debug, module, message, None);
}

/// 读取日志文件
pub fn read_logs(lines: Option<usize>) -> Vec<String> {
    let log_path = get_current_log_path();
    
    if !log_path.exists() {
        return vec![];
    }
    
    if let Ok(content) = fs::read_to_string(&log_path) {
        let all_lines: Vec<String> = content.lines().map(|s| s.to_string()).collect();
        
        if let Some(n) = lines {
            all_lines.into_iter().rev().take(n).collect::<Vec<_>>().into_iter().rev().collect()
        } else {
            all_lines
        }
    } else {
        vec![]
    }
}

/// 清空日志
pub fn clear_logs() {
    let log_dir = get_log_dir();
    
    if let Ok(entries) = fs::read_dir(&log_dir) {
        for entry in entries.flatten() {
            if entry.path().extension().map(|e| e == "log").unwrap_or(false) {
                let _ = fs::remove_file(entry.path());
            }
        }
    }
}

/// 获取日志文件列表
pub fn get_log_files() -> Vec<(String, u64)> {
    let log_dir = get_log_dir();
    let mut files = Vec::new();
    
    if let Ok(entries) = fs::read_dir(&log_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map(|e| e == "log").unwrap_or(false) {
                if let Ok(metadata) = fs::metadata(&path) {
                    files.push((
                        path.file_name().unwrap_or_default().to_string_lossy().to_string(),
                        metadata.len(),
                    ));
                }
            }
        }
    }
    
    files.sort_by(|a, b| a.0.cmp(&b.0));
    files
}
