use tauri::{State, AppHandle};
use crate::report::generator::{DailyReport, ReportGenerator};

pub struct ReportState(pub ReportGenerator);

#[tauri::command]
pub async fn generate_daily_report(
    date: Option<String>,
    report_state: State<'_, ReportState>,
) -> Result<DailyReport, String> {
    let date = date.unwrap_or_else(|| chrono::Utc::now().format("%Y-%m-%d").to_string());
    report_state.0.generate_daily_report(&date).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn generate_report_range(
    start_date: String,
    end_date: String,
    report_state: State<'_, ReportState>,
) -> Result<Vec<DailyReport>, String> {
    let start = chrono::NaiveDate::parse_from_str(&start_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid start date: {}", e))?;
    let end = chrono::NaiveDate::parse_from_str(&end_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid end date: {}", e))?;

    let mut reports = Vec::new();
    let mut current = start;
    while current <= end {
        let report = report_state.0
            .generate_daily_report(&current.format("%Y-%m-%d").to_string())
            .await
            .map_err(|e| e.to_string())?;
        reports.push(report);
        current += chrono::Duration::days(1);
    }

    Ok(reports)
}

/// 弹出保存对话框，将文本内容写入用户选择的文件（用于报告导出）
#[tauri::command]
pub fn export_text_file(app: AppHandle, content: String, default_name: String, extension: String) -> Result<bool, String> {
    use tauri_plugin_dialog::DialogExt;
    let ext_lower = extension.to_lowercase();
    let ext_for_filter = if ext_lower.is_empty() { "txt".to_string() } else { ext_lower };
    let mut builder = app.dialog().file().set_file_name(&default_name);
    builder = builder.add_filter(&ext_for_filter.to_uppercase(), &[&ext_for_filter]);
    let path = builder.blocking_save_file();
    match path {
        Some(p) => {
            let path = p.into_path().map_err(|e| e.to_string())?;
            std::fs::write(&path, content).map_err(|e| e.to_string())?;
            Ok(true)
        }
        None => Ok(false),
    }
}
