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
            model: String::new(),
            api_key: None,
        }
    }
}

impl AIProviderConfig {
    /// 按来源构建配置：base_url 为空时使用该来源的默认地址，api_key 为空时回退到默认配置
    pub fn build_for(
        provider_type: AIProviderType,
        base_url: Option<String>,
        model: String,
        api_key: Option<String>,
    ) -> Self {
        let default = Self::default_for(provider_type.clone());
        Self {
            provider_type,
            base_url: base_url.filter(|u| !u.is_empty()).unwrap_or(default.base_url),
            model,
            api_key: api_key.filter(|k| !k.is_empty()).or(default.api_key),
        }
    }

    /// 返回指定来源的默认配置（用于获取默认 base_url / api_key）
    pub fn default_for(provider_type: AIProviderType) -> Self {
        match provider_type {
            AIProviderType::Ollama => Self {
                provider_type,
                base_url: "http://localhost:11434".to_string(),
                model: String::new(),
                api_key: None,
            },
            AIProviderType::LMStudio => Self {
                provider_type,
                base_url: "http://localhost:1234".to_string(),
                model: String::new(),
                api_key: None,
            },
            AIProviderType::OpenAI => Self {
                provider_type,
                base_url: "https://api.openai.com/v1".to_string(),
                model: String::new(),
                api_key: None,
            },
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
    #[allow(dead_code)]
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
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    pub name: String,
    pub size: Option<String>,
    /// None = 能力未知（不显示）；Ollama 通过 /api/show 探测，其他 provider 不探测
    pub is_vision: Option<bool>,
    pub supports_tools: Option<bool>,
}
