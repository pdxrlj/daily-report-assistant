use serde::{Deserialize, Serialize};
use crate::errors::AppError;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AIProviderType {
    #[serde(rename = "ollama")]
    Ollama,
    #[serde(rename = "lmstudio")]
    LMStudio,
    #[serde(rename = "openai")]
    OpenAI,
}

impl std::fmt::Display for AIProviderType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AIProviderType::Ollama => write!(f, "ollama"),
            AIProviderType::LMStudio => write!(f, "lmstudio"),
            AIProviderType::OpenAI => write!(f, "openai"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIProviderConfig {
    pub provider_type: AIProviderType,
    pub base_url: String,
    pub model: String,
    pub api_key: Option<String>,
}

impl Default for AIProviderConfig {
    fn default() -> Self {
        Self {
            provider_type: AIProviderType::Ollama,
            base_url: "http://localhost:11434".to_string(),
            model: "gemma4-e2b".to_string(),
            api_key: None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AnalysisResult {
    pub id: String,
    pub timestamp: String,
    pub app_name: String,
    pub activity_type: String,
    pub description: String,
    pub keywords: Vec<String>,
    pub importance_score: f64,
    pub image_hash: String,
    pub provider: AIProviderType,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderStatus {
    pub available: bool,
    pub models: Vec<String>,
    pub version: Option<String>,
    pub error: Option<String>,
    pub latency_ms: u64,
}

#[async_trait::async_trait]
pub trait AIProvider: Send + Sync {
    fn provider_type(&self) -> &AIProviderType;
    async fn check_status(&self) -> Result<ProviderStatus, AppError>;
    async fn analyze_screenshot(
        &self,
        image_base64: &str,
        prompt: &str,
        model: &str,
    ) -> Result<String, AppError>;
    async fn list_models(&self) -> Result<Vec<ModelInfo>, AppError>;
    /// 纯文本对话（用于 Agent 问答，不带图像），model 可临时覆盖当前配置的模型
    async fn chat(&self, prompt: &str, model: &str) -> Result<String, AppError>;
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModelInfo {
    pub name: String,
    pub size: Option<String>,
    pub is_vision: bool,
}
