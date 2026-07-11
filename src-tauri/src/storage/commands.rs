use tauri::State;
use crate::storage::engine::ActivityRecord;
use crate::ai::commands::DBState;

#[tauri::command]
pub async fn get_today_activities(
    state: State<'_, DBState>,
) -> Result<Vec<ActivityRecord>, String> {
    state.0.get_today_activities().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_activities_by_date(
    date: String,
    state: State<'_, DBState>,
) -> Result<Vec<ActivityRecord>, String> {
    state.0.get_activities_by_date(&date).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_activities_range(
    start_date: String,
    end_date: String,
    state: State<'_, DBState>,
) -> Result<Vec<ActivityRecord>, String> {
    state.0.get_activities_range(&start_date, &end_date)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_heatmap_data(
    date: String,
    state: State<'_, DBState>,
) -> Result<Vec<crate::storage::engine::HeatmapEntry>, String> {
    state.0.get_heatmap_data(&date).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_heatmap_range(
    start_date: String,
    end_date: String,
    state: State<'_, DBState>,
) -> Result<Vec<crate::storage::engine::HeatmapEntry>, String> {
    state.0.get_heatmap_range(&start_date, &end_date)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_app_usage(
    date: String,
    state: State<'_, DBState>,
) -> Result<Vec<crate::storage::engine::AppUsageStat>, String> {
    state.0.get_app_usage(&date).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_setting(
    key: String,
    state: State<'_, DBState>,
) -> Result<Option<String>, String> {
    state.0.get_setting(&key).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_setting(
    key: String,
    value: String,
    state: State<'_, DBState>,
) -> Result<(), String> {
    state.0.set_setting(&key, &value).await.map_err(|e| e.to_string())
}
