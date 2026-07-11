mod screenshot;
mod ai;
mod storage;
mod privacy;
mod report;
mod security;
mod errors;

use std::sync::{Arc, Mutex};
use tauri::{Manager, AppHandle};
use tokio::sync::broadcast;

use screenshot::manager::ScreenshotManager;
use screenshot::commands::ScreenshotManagerState;
use ai::scheduler::AIScheduler;
use ai::provider::{AIProviderConfig, AIProviderType, AnalysisResult};
use ai::commands::{AISchedulerState, DBState};
use storage::engine::StorageEngine;
use report::generator::ReportGenerator;
use report::commands::ReportState;

#[tauri::command]
fn get_current_user() -> String {
    std::env::var("USERNAME")
        .or_else(|_| std::env::var("USER"))
        .unwrap_or_else(|_| "User".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let app_dir = app.path().app_data_dir().expect("failed to get app data dir");
            std::fs::create_dir_all(&app_dir).ok();

            let rt = tokio::runtime::Runtime::new().expect("failed to create tokio runtime");

            let storage = rt.block_on(async {
                let db_path = app_dir.join("activities.db");
                Arc::new(
                    StorageEngine::new(&db_path)
                        .await
                        .expect("failed to initialize database"),
                )
            });

            let (result_tx, _) = broadcast::channel::<AnalysisResult>(100);
            let ai_config = load_ai_config(&storage, &rt);

            let scheduler = Arc::new(AIScheduler::new(ai_config, result_tx));

            let report_gen = ReportGenerator::new(storage.clone());

            app.manage(ScreenshotManagerState(Mutex::new(ScreenshotManager::new())));
            app.manage(AISchedulerState(scheduler));
            app.manage(DBState(storage));
            app.manage(ReportState(report_gen));

            setup_tray(app.handle())?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_current_user,
            screenshot::commands::capture_screen,
            screenshot::commands::get_monitors,
            screenshot::commands::capture_all_screens,
            ai::commands::analyze_screenshot,
            ai::commands::save_analysis_result,
            ai::commands::capture_and_analyze,
            ai::commands::check_ai_status,
            ai::commands::update_ai_provider,
            ai::commands::agent_chat,
            storage::commands::get_today_activities,
            storage::commands::get_activities_by_date,
            storage::commands::get_activities_range,
            storage::commands::get_heatmap_data,
            storage::commands::get_heatmap_range,
            storage::commands::get_app_usage,
            storage::commands::get_setting,
            storage::commands::set_setting,
            report::commands::generate_daily_report,
            report::commands::generate_report_range,
            report::commands::export_text_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent};

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("日报")
        .on_tray_icon_event(move |tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                if let Some(window) = tray.app_handle().get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}

fn load_ai_config(
    storage: &Arc<StorageEngine>,
    rt: &tokio::runtime::Runtime,
) -> AIProviderConfig {
    let provider = rt.block_on(async {
        storage
            .get_setting("ai_provider")
            .await
            .unwrap_or(None)
            .unwrap_or_else(|| "ollama".to_string())
    });

    let base_url = rt.block_on(async {
        storage
            .get_setting("ai_base_url")
            .await
            .unwrap_or(None)
            .unwrap_or_else(|| "http://localhost:11434".to_string())
    });

    let model = rt.block_on(async {
        storage
            .get_setting("ai_model")
            .await
            .unwrap_or(None)
            .unwrap_or_else(|| "gemma4-e2b".to_string())
    });

    let api_key = rt.block_on(async {
        storage
            .get_setting("ai_api_key")
            .await
            .unwrap_or(None)
    });

    let provider_type = match provider.as_str() {
        "lmstudio" => AIProviderType::LMStudio,
        "openai" => AIProviderType::OpenAI,
        _ => AIProviderType::Ollama,
    };

    AIProviderConfig {
        provider_type,
        base_url,
        model,
        api_key,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ai_config_default() {
        let config = AIProviderConfig::default();
        assert_eq!(config.provider_type, AIProviderType::Ollama);
        assert_eq!(config.base_url, "http://localhost:11434");
        assert_eq!(config.model, "gemma4-e2b");
    }
}
