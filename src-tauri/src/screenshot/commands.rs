use base64::Engine;
use tauri::State;
use std::sync::Mutex;
use crate::screenshot::manager::ScreenshotManager;

pub struct ScreenshotManagerState(pub Mutex<ScreenshotManager>);

#[tauri::command]
pub fn capture_screen(
    state: State<'_, ScreenshotManagerState>,
) -> Result<serde_json::Value, String> {
    let manager = state.0.lock().map_err(|e| e.to_string())?;
    let (buffer, info) = manager.capture_screen().map_err(|e| e.to_string())?;

    let base64_data = base64::engine::general_purpose::STANDARD.encode(buffer.data());

    Ok(serde_json::json!({
        "info": {
            "id": info.id,
            "width": info.width,
            "height": info.height,
            "timestamp": info.timestamp,
            "hash": info.hash,
            "monitor_name": info.monitor_name,
        },
        "image_base64": base64_data,
    }))
}

#[tauri::command]
pub fn get_monitors(
    state: State<'_, ScreenshotManagerState>,
) -> Result<Vec<crate::screenshot::manager::MonitorInfo>, String> {
    let manager = state.0.lock().map_err(|e| e.to_string())?;
    manager.get_monitors_info().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn capture_all_screens(
    state: State<'_, ScreenshotManagerState>,
) -> Result<Vec<serde_json::Value>, String> {
    let manager = state.0.lock().map_err(|e| e.to_string())?;
    let results = manager.capture_all_monitors().map_err(|e| e.to_string())?;

    Ok(results
        .into_iter()
        .map(|(buffer, info)| {
            let base64_data = base64::engine::general_purpose::STANDARD.encode(buffer.data());
            serde_json::json!({
                "info": {
                    "id": info.id,
                    "width": info.width,
                    "height": info.height,
                    "timestamp": info.timestamp,
                    "hash": info.hash,
                    "monitor_name": info.monitor_name,
                },
                "image_base64": base64_data,
            })
        })
        .collect())
}
