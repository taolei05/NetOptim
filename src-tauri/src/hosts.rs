use crate::AppError;
use std::fs;
use std::path::PathBuf;
use std::process::Command;

/// 获取 hosts 文件路径
fn get_hosts_path() -> PathBuf {
    if cfg!(target_os = "windows") {
        PathBuf::from(r"C:\Windows\System32\drivers\etc\hosts")
    } else {
        PathBuf::from("/etc/hosts")
    }
}

/// 检查是否有管理员/root 权限
/// macOS/Linux 返回 true，因为会在写入时请求权限
/// Windows 需要以管理员身份启动
pub fn is_admin() -> bool {
    #[cfg(target_os = "windows")]
    {
        is_elevated::is_elevated()
    }

    // macOS/Linux: 返回 true，写入时会自动请求权限
    #[cfg(not(target_os = "windows"))]
    {
        true
    }
}

/// 写入 hosts 条目
pub fn write_host_entry(domain: &str, ip: &str) -> Result<(), AppError> {
    let hosts_path = get_hosts_path();

    // 读取现有内容
    let content = if hosts_path.exists() {
        fs::read_to_string(&hosts_path)?
    } else {
        String::new()
    };

    // 过滤掉已存在的相同域名条目
    let mut new_lines: Vec<String> = Vec::new();
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            new_lines.push(line.to_string());
            continue;
        }

        let parts: Vec<&str> = trimmed.split_whitespace().collect();
        if parts.len() >= 2 {
            // 检查是否是同一个域名
            let existing_domain = parts.last().unwrap_or(&"");
            if *existing_domain != domain {
                new_lines.push(line.to_string());
            }
            // 如果是同一个域名，跳过（不添加到 new_lines）
        } else {
            new_lines.push(line.to_string());
        }
    }

    // 添加新条目
    new_lines.push(format!("{}\t{}", ip, domain));

    // 写入文件
    let new_content = new_lines.join("\n") + "\n";

    // 尝试直接写入
    if fs::write(&hosts_path, &new_content).is_ok() {
        return Ok(());
    }

    // 如果失败，在 macOS/Linux 上使用 sudo 方式写入
    #[cfg(not(target_os = "windows"))]
    {
        write_with_sudo(&hosts_path, &new_content)?;
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    return Err(AppError::PermissionError(
        "请以管理员身份运行程序".to_string(),
    ));
}

/// 使用管理员权限写入文件 (macOS/Linux)
#[cfg(not(target_os = "windows"))]
fn write_with_sudo(path: &PathBuf, content: &str) -> Result<(), AppError> {
    // 创建临时文件
    let temp_path = std::env::temp_dir().join("hosts_temp");
    fs::write(&temp_path, content)?;

    let path_str = path.to_string_lossy();
    let temp_str = temp_path.to_string_lossy();

    #[cfg(target_os = "macos")]
    {
        // macOS: 使用 osascript 请求管理员权限
        let script = format!(
            r#"do shell script "cp '{}' '{}'" with prompt "NetOptim 需要管理员权限来修改 hosts 文件" with administrator privileges"#,
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
            Err(AppError::PermissionError(format!("写入失败: {}", err)))
        }
    }

    #[cfg(target_os = "linux")]
    {
        // Linux: 尝试使用 pkexec
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

/// 刷新 DNS 缓存
pub fn flush_dns_cache() -> Result<(), AppError> {
    let result = if cfg!(target_os = "windows") {
        Command::new("ipconfig").arg("/flushdns").output()
    } else if cfg!(target_os = "macos") {
        // macOS 需要多个命令
        let _ = Command::new("dscacheutil").arg("-flushcache").output();
        Command::new("killall")
            .args(["-HUP", "mDNSResponder"])
            .output()
    } else {
        // Linux
        let _ = Command::new("systemd-resolve")
            .arg("--flush-caches")
            .output();
        Command::new("nscd").args(["-i", "hosts"]).output()
    };

    match result {
        Ok(output) if output.status.success() => Ok(()),
        Ok(_) => Ok(()), // 即使失败也不报错，因为某些系统可能没有这些命令
        Err(e) => Err(AppError::Other(format!("刷新 DNS 失败: {}", e))),
    }
}

/// 获取 hosts 文件中的所有条目
pub fn get_host_entries() -> Result<Vec<crate::HostEntry>, AppError> {
    let hosts_path = get_hosts_path();
    let content = if hosts_path.exists() {
        fs::read_to_string(&hosts_path)?
    } else {
        return Ok(vec![]);
    };

    let mut entries = Vec::new();
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        let parts: Vec<&str> = trimmed.split_whitespace().collect();
        if parts.len() >= 2 {
            let ip = parts[0].to_string();
            // 支持一行多个域名
            for domain in &parts[1..] {
                entries.push(crate::HostEntry {
                    ip: ip.clone(),
                    domain: domain.to_string(),
                });
            }
        }
    }

    Ok(entries)
}

/// 删除 hosts 条目
pub fn remove_host_entry(domain: &str) -> Result<(), AppError> {
    let hosts_path = get_hosts_path();
    let content = if hosts_path.exists() {
        fs::read_to_string(&hosts_path)?
    } else {
        return Ok(());
    };

    let mut new_lines: Vec<String> = Vec::new();
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            new_lines.push(line.to_string());
            continue;
        }

        let parts: Vec<&str> = trimmed.split_whitespace().collect();
        if parts.len() >= 2 {
            let existing_domain = parts.last().unwrap_or(&"");
            if *existing_domain != domain {
                new_lines.push(line.to_string());
            }
        } else {
            new_lines.push(line.to_string());
        }
    }

    let new_content = new_lines.join("\n") + "\n";

    // 尝试直接写入
    if fs::write(&hosts_path, &new_content).is_ok() {
        return Ok(());
    }

    #[cfg(not(target_os = "windows"))]
    {
        write_with_sudo(&hosts_path, &new_content)?;
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    return Err(AppError::PermissionError(
        "请以管理员身份运行程序".to_string(),
    ));
}
