use crate::AppError;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const MAX_BACKUPS: usize = 10;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HostsBackup {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    #[serde(skip_serializing, default)]
    #[allow(dead_code)]
    pub content: String, // 不再序列化到索引文件，只从备份文件读取
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BackupList {
    pub backups: Vec<HostsBackup>,
}

fn get_backup_dir() -> PathBuf {
    if let Some(config_dir) = dirs::config_dir() {
        let backup_dir = config_dir.join("netoptim").join("backups");
        if !backup_dir.exists() {
            let _ = fs::create_dir_all(&backup_dir);
        }
        backup_dir
    } else {
        PathBuf::from("backups")
    }
}

fn get_backup_index_path() -> PathBuf {
    get_backup_dir().join("index.json")
}

fn get_backup_file_path(id: &str) -> PathBuf {
    get_backup_dir().join(format!("{}.hosts", id))
}

pub fn load_backup_list() -> BackupList {
    let path = get_backup_index_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(list) = serde_json::from_str(&content) {
                return list;
            }
        }
    }
    BackupList::default()
}

fn save_backup_list(list: &BackupList) -> Result<(), AppError> {
    let path = get_backup_index_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let content = serde_json::to_string_pretty(list)
        .map_err(|e| AppError::Other(format!("序列化失败: {}", e)))?;
    fs::write(&path, content)?;
    Ok(())
}

/// 创建 hosts 文件备份
pub fn create_backup(description: Option<&str>) -> Result<HostsBackup, AppError> {
    // 读取当前 hosts 文件
    let hosts_path = if cfg!(target_os = "windows") {
        PathBuf::from(r"C:\Windows\System32\drivers\etc\hosts")
    } else {
        PathBuf::from("/etc/hosts")
    };
    
    let content = if hosts_path.exists() {
        fs::read_to_string(&hosts_path)?
    } else {
        String::new()
    };
    
    let backup = HostsBackup {
        id: uuid::Uuid::new_v4().to_string(),
        timestamp: Utc::now(),
        content: String::new(), // 内容存储在单独文件中，不再重复存储
        description: description.map(|s| s.to_string()),
    };
    
    // 保存备份文件
    let backup_path = get_backup_file_path(&backup.id);
    fs::write(&backup_path, &content)?;
    
    // 更新索引
    let mut list = load_backup_list();
    list.backups.insert(0, backup.clone());
    
    // 限制备份数量
    while list.backups.len() > MAX_BACKUPS {
        if let Some(old) = list.backups.pop() {
            let old_path = get_backup_file_path(&old.id);
            let _ = fs::remove_file(old_path);
        }
    }
    
    save_backup_list(&list)?;
    
    Ok(backup)
}

/// 恢复 hosts 文件
pub fn restore_backup(backup_id: &str) -> Result<(), AppError> {
    let backup_path = get_backup_file_path(backup_id);
    
    if !backup_path.exists() {
        return Err(AppError::Other("备份文件不存在".to_string()));
    }
    
    let content = fs::read_to_string(&backup_path)?;
    
    // 写入 hosts 文件
    let hosts_path = if cfg!(target_os = "windows") {
        PathBuf::from(r"C:\Windows\System32\drivers\etc\hosts")
    } else {
        PathBuf::from("/etc/hosts")
    };
    
    // 尝试直接写入
    if fs::write(&hosts_path, &content).is_ok() {
        return Ok(());
    }
    
    // 如果失败，在 macOS/Linux 上使用 sudo 方式写入
    #[cfg(not(target_os = "windows"))]
    {
        write_with_sudo(&hosts_path, &content)?;
        return Ok(());
    }
    
    #[cfg(target_os = "windows")]
    return Err(AppError::PermissionError(
        "请以管理员身份运行程序".to_string(),
    ));
}

#[cfg(not(target_os = "windows"))]
fn write_with_sudo(path: &PathBuf, content: &str) -> Result<(), AppError> {
    use std::process::Command;
    
    let temp_path = std::env::temp_dir().join("hosts_restore_temp");
    fs::write(&temp_path, content)?;
    
    let path_str = path.to_string_lossy();
    let temp_str = temp_path.to_string_lossy();
    
    #[cfg(target_os = "macos")]
    {
        let script = format!(
            r#"do shell script "cp '{}' '{}'" with prompt "NetOptim 需要管理员权限来恢复 hosts 文件" with administrator privileges"#,
            temp_str, path_str
        );
        
        let output = Command::new("osascript")
            .args(["-e", &script])
            .output()
            .map_err(|e| AppError::Other(format!("执行失败: {}", e)))?;
        
        let _ = fs::remove_file(&temp_path);
        
        if output.status.success() {
            return Ok(());
        }
        
        let err = String::from_utf8_lossy(&output.stderr);
        if err.contains("User canceled") || err.contains("canceled") {
            Err(AppError::PermissionError("用户取消了授权".to_string()))
        } else {
            Err(AppError::PermissionError(format!("恢复失败: {}", err)))
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        let output = Command::new("pkexec")
            .args(["cp", &temp_str, &path_str])
            .output()
            .map_err(|e| AppError::Other(format!("执行失败: {}", e)))?;
        
        let _ = fs::remove_file(&temp_path);
        
        if output.status.success() {
            Ok(())
        } else {
            Err(AppError::PermissionError(
                "请以管理员身份运行程序".to_string(),
            ))
        }
    }
}

/// 删除备份
pub fn delete_backup(backup_id: &str) -> Result<(), AppError> {
    let mut list = load_backup_list();
    list.backups.retain(|b| b.id != backup_id);
    save_backup_list(&list)?;
    
    let backup_path = get_backup_file_path(backup_id);
    if backup_path.exists() {
        fs::remove_file(backup_path)?;
    }
    
    Ok(())
}

/// 获取备份内容
pub fn get_backup_content(backup_id: &str) -> Result<String, AppError> {
    let backup_path = get_backup_file_path(backup_id);
    if !backup_path.exists() {
        return Err(AppError::Other("备份文件不存在".to_string()));
    }
    Ok(fs::read_to_string(&backup_path)?)
}
