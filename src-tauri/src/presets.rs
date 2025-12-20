use crate::AppError;
use std::fs;
use std::path::PathBuf;

/// 获取预设文件路径
fn get_presets_path() -> PathBuf {
    if let Some(config_dir) = dirs::config_dir() {
        let app_dir = config_dir.join("netoptim");
        if !app_dir.exists() {
            let _ = fs::create_dir_all(&app_dir);
        }
        app_dir.join("presets.json")
    } else {
        PathBuf::from("presets.json")
    }
}

/// 默认预设
fn default_presets() -> Vec<String> {
    vec![]
}

/// 加载预设列表
pub fn load_presets() -> Vec<String> {
    let path = get_presets_path();

    if path.exists() {
        match fs::read_to_string(&path) {
            Ok(content) => match serde_json::from_str(&content) {
                Ok(presets) => return presets,
                Err(e) => {
                    eprintln!("解析预设文件失败: {}", e);
                }
            },
            Err(e) => {
                eprintln!("读取预设文件失败: {}", e);
            }
        }
    }

    default_presets()
}

/// 保存预设列表
pub fn save_presets(presets: &[String]) -> Result<(), AppError> {
    let path = get_presets_path();

    // 确保目录存在
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let content = serde_json::to_string_pretty(presets)
        .map_err(|e| AppError::Other(format!("序列化失败: {}", e)))?;

    fs::write(&path, content)?;
    Ok(())
}
