use base64::Engine;
use tauri::State;
use std::sync::Arc;
use crate::ai::scheduler::AIScheduler;
use crate::ai::provider::{AIProviderConfig, AIProviderType};
use crate::ai::ollama::OllamaClient;
use crate::ai::lmstudio::LMStudioClient;
use crate::ai::provider::AIProvider;
use crate::storage::engine::StorageEngine;
use crate::screenshot::manager::ScreenshotInfo;

pub struct AISchedulerState(pub Arc<AIScheduler>);
pub struct DBState(pub Arc<StorageEngine>);

#[tauri::command]
pub async fn analyze_screenshot(
    image_base64: String,
    screenshot_info: ScreenshotInfo,
    model: Option<String>,
    ai_state: State<'_, AISchedulerState>,
) -> Result<serde_json::Value, String> {
    let model = model.unwrap_or_default();
    let result = ai_state.0
        .analyze_screenshot(&image_base64, &screenshot_info.hash, &model)
        .await
        .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "id": result.id,
        "timestamp": result.timestamp,
        "app_name": result.app_name,
        "activity_type": result.activity_type,
        "description": result.description,
        "keywords": result.keywords,
        "importance_score": result.importance_score,
        "image_hash": result.image_hash,
    }))
}

#[tauri::command]
pub async fn save_analysis_result(
    result: serde_json::Value,
    state: State<'_, DBState>,
) -> Result<i64, String> {
    let record = crate::storage::engine::ActivityRecord {
        id: 0,
        timestamp: result["timestamp"].as_str().unwrap_or("").to_string(),
        app_name: result["app_name"].as_str().unwrap_or("").to_string(),
        activity_type: result["activity_type"].as_str().unwrap_or("other").to_string(),
        description: result["description"].as_str().unwrap_or("").to_string(),
        keywords: result["keywords"]
            .as_array()
            .map(|arr| serde_json::to_string(arr).unwrap_or_default()),
        importance_score: result["importance_score"].as_f64().unwrap_or(0.5),
        image_hash: result["image_hash"].as_str().unwrap_or("").to_string(),
        provider: "ollama".to_string(),
        created_at: String::new(),
    };

    state.0.save_activity(&record).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn capture_and_analyze(
    model: Option<String>,
    ai_state: State<'_, AISchedulerState>,
    db_state: State<'_, DBState>,
) -> Result<serde_json::Value, String> {
    let model = model.unwrap_or_default();
    let manager = crate::screenshot::manager::ScreenshotManager::new();
    let (buffer, info) = manager.capture_screen().map_err(|e| e.to_string())?;
    let base64_data = base64::engine::general_purpose::STANDARD.encode(buffer.data());

    let result = ai_state.0
        .analyze_screenshot(&base64_data, &info.hash, &model)
        .await
        .map_err(|e| e.to_string())?;

    let record = crate::storage::engine::ActivityRecord {
        id: 0,
        timestamp: result.timestamp.clone(),
        app_name: result.app_name.clone(),
        activity_type: result.activity_type.clone(),
        description: result.description.clone(),
        keywords: Some(serde_json::to_string(&result.keywords).unwrap_or_default()),
        importance_score: result.importance_score,
        image_hash: result.image_hash.clone(),
        provider: result.provider.to_string(),
        created_at: String::new(),
    };

    db_state.0.save_activity(&record).await.map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "screenshot": {
            "id": info.id,
            "width": info.width,
            "height": info.height,
            "timestamp": info.timestamp,
            "monitor_name": info.monitor_name,
        },
        "analysis": {
            "id": result.id,
            "app_name": result.app_name,
            "activity_type": result.activity_type,
            "description": result.description,
            "keywords": result.keywords,
            "importance_score": result.importance_score,
        }
    }))
}

#[tauri::command]
pub async fn check_ai_status(
    provider_type: Option<String>,
    base_url: Option<String>,
    model: Option<String>,
    api_key: Option<String>,
    ai_state: State<'_, AISchedulerState>,
) -> Result<serde_json::Value, String> {
    let status = if let Some(pt) = provider_type {
        let provider_type_enum = match pt.as_str() {
            "ollama" => AIProviderType::Ollama,
            "lmstudio" => AIProviderType::LMStudio,
            "openai" => AIProviderType::OpenAI,
            _ => return Err(format!("Unknown provider type: {}", pt)),
        };
        let config = AIProviderConfig {
            provider_type: provider_type_enum.clone(),
            base_url: base_url.unwrap_or_else(|| "http://localhost:11434".to_string()),
            model: model.unwrap_or_default(),
            api_key,
        };
        let temp_provider: Box<dyn AIProvider> = match provider_type_enum {
            AIProviderType::Ollama => Box::new(OllamaClient::new(config)),
            AIProviderType::LMStudio => Box::new(LMStudioClient::new(config)),
            AIProviderType::OpenAI => Box::new(LMStudioClient::new(config)),
        };
        temp_provider.check_status().await.map_err(|e| e.to_string())?
    } else {
        ai_state.0.check_status().await.map_err(|e| e.to_string())?
    };
    Ok(serde_json::json!(status))
}

#[tauri::command]
pub async fn update_ai_provider(
    provider_type: String,
    base_url: String,
    model: String,
    api_key: Option<String>,
    ai_state: State<'_, AISchedulerState>,
) -> Result<String, String> {
    let provider = match provider_type.as_str() {
        "ollama" => crate::ai::provider::AIProviderType::Ollama,
        "lmstudio" => crate::ai::provider::AIProviderType::LMStudio,
        "openai" => crate::ai::provider::AIProviderType::OpenAI,
        _ => return Err(format!("Unknown provider: {}", provider_type)),
    };

    let config = AIProviderConfig {
        provider_type: provider,
        base_url,
        model,
        api_key,
    };

    ai_state.0.update_provider(config).await;
    Ok("ok".to_string())
}

/// Agent 对话：注入今日工作记录作为上下文，调用本地 LLM 回答
#[tauri::command]
pub async fn agent_chat(
    message: String,
    model: Option<String>,
    ai_state: State<'_, AISchedulerState>,
    db_state: State<'_, DBState>,
) -> Result<String, String> {
    let activities = db_state.0.get_today_activities().await.unwrap_or_default();

    let mut ctx = String::from("你是日报助手，请基于用户今日的工作记录回答问题。\n");
    if activities.is_empty() {
        ctx.push_str("今日暂无工作记录。\n");
    } else {
        ctx.push_str(&format!("今日共有 {} 条工作记录：\n", activities.len()));
        for (i, a) in activities.iter().enumerate() {
            let time = chrono::DateTime::parse_from_rfc3339(&a.timestamp)
                .map(|t| t.format("%H:%M").to_string())
                .unwrap_or_default();
            ctx.push_str(&format!(
                "{}. [{}][{}][{}] {} (重要性{:.1})\n",
                i + 1, time, a.app_name, a.activity_type, a.description, a.importance_score
            ));
        }
    }

    let prompt = format!("{}\n\n用户问题：{}", ctx, message);
    let model = model.unwrap_or_default();
    ai_state.0.agent_chat(&prompt, &model).await.map_err(|e| e.to_string())
}
