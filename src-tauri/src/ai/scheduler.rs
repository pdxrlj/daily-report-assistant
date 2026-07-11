use tokio::sync::{broadcast, Mutex};
use crate::ai::provider::{AIProvider, AIProviderConfig, AIProviderType, AnalysisResult, ProviderStatus};
use crate::ai::prompts::generate_analysis_prompt;
use crate::ai::ollama::OllamaClient;
use crate::ai::lmstudio::LMStudioClient;
use crate::errors::AppError;
use crate::privacy::filter::SensitiveInfoFilter;

pub struct AIScheduler {
    provider: Mutex<Box<dyn AIProvider>>,
    result_sender: broadcast::Sender<AnalysisResult>,
    filter: SensitiveInfoFilter,
}

impl AIScheduler {
    pub fn new(config: AIProviderConfig, result_sender: broadcast::Sender<AnalysisResult>) -> Self {
        let provider = Self::create_provider(config);
        Self {
            provider: Mutex::new(provider),
            result_sender,
            filter: SensitiveInfoFilter::new(),
        }
    }

    fn create_provider(config: AIProviderConfig) -> Box<dyn AIProvider> {
        match config.provider_type {
            AIProviderType::Ollama => Box::new(OllamaClient::new(config)),
            AIProviderType::LMStudio => Box::new(LMStudioClient::new(config)),
            AIProviderType::OpenAI => Box::new(LMStudioClient::new(config)),
        }
    }

    pub async fn update_provider(&self, config: AIProviderConfig) {
        let mut provider = self.provider.lock().await;
        *provider = Self::create_provider(config);
    }

    pub async fn analyze_screenshot(
        &self,
        image_base64: &str,
        image_hash: &str,
        model: &str,
    ) -> Result<AnalysisResult, AppError> {
        let prompt = generate_analysis_prompt();
        let provider_type = {
            let provider = self.provider.lock().await;
            provider.provider_type().clone()
        };
        let raw = {
            let provider = self.provider.lock().await;
            provider.analyze_screenshot(image_base64, &prompt, model).await?
        };
        let mut parsed = parse_analysis_result(&raw)?;

        // 隐私过滤：在结果保存/返回前擦除描述与关键词中的敏感文本（信用卡、密码、手机号等）
        parsed.description = self.filter.filter_text(&parsed.description);
        parsed.keywords = parsed
            .keywords
            .into_iter()
            .map(|k| self.filter.filter_text(&k))
            .collect();

        let result = AnalysisResult {
            id: uuid::Uuid::new_v4().to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            image_hash: image_hash.to_string(),
            provider: provider_type,
            ..parsed
        };

        let _ = self.result_sender.send(result.clone());
        Ok(result)
    }

    pub async fn check_status(&self) -> Result<ProviderStatus, AppError> {
        let provider = self.provider.lock().await;
        provider.check_status().await
    }

    /// Agent 纯文本对话（不带图像），由调用方注入工作上下文
    pub async fn agent_chat(&self, prompt: &str, model: &str) -> Result<String, AppError> {
        let provider = self.provider.lock().await;
        provider.chat(prompt, model).await
    }
}

pub fn parse_analysis_result(raw: &str) -> Result<AnalysisResult, AppError> {
    let cleaned = raw
        .replace("```json", "")
        .replace("```", "")
        .trim()
        .to_string();

    let parsed: serde_json::Value = serde_json::from_str(&cleaned)?;

    Ok(AnalysisResult {
        id: String::new(),
        timestamp: String::new(),
        app_name: parsed["app_name"].as_str().unwrap_or("").to_string(),
        activity_type: parsed["activity_type"].as_str().unwrap_or("other").to_string(),
        description: parsed["description"].as_str().unwrap_or("").to_string(),
        keywords: parsed["keywords"]
            .as_array()
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
            .unwrap_or_default(),
        importance_score: parsed["importance_score"].as_f64().unwrap_or(0.5),
        image_hash: String::new(),
        provider: AIProviderType::Ollama,
    })
}
