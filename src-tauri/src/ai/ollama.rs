use crate::ai::provider::{AIProvider, AIProviderConfig, AIProviderType, ProviderStatus, ModelInfo};
use crate::errors::AppError;

pub struct OllamaClient {
    config: AIProviderConfig,
    client: reqwest::Client,
}

impl OllamaClient {
    pub fn new(config: AIProviderConfig) -> Self {
        Self {
            config,
            client: reqwest::Client::new(),
        }
    }
}

#[async_trait::async_trait]
impl AIProvider for OllamaClient {
    fn provider_type(&self) -> &AIProviderType {
        &self.config.provider_type
    }

    async fn check_status(&self) -> Result<ProviderStatus, AppError> {
        let start = std::time::Instant::now();
        let res = self.client
            .get(format!("{}/api/tags", self.config.base_url))
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await;

        match res {
            Ok(resp) if resp.status().is_success() => {
                let data: serde_json::Value = resp.json().await?;
                let models = data["models"]
                    .as_array()
                    .map(|arr| arr.iter().filter_map(|m| m["name"].as_str().map(String::from)).collect())
                    .unwrap_or_default();
                Ok(ProviderStatus {
                    available: true,
                    models,
                    version: data["version"].as_str().map(String::from),
                    error: None,
                    latency_ms: start.elapsed().as_millis() as u64,
                })
            }
            Ok(resp) => Ok(ProviderStatus {
                available: false,
                models: vec![],
                version: None,
                error: Some(format!("HTTP {}", resp.status())),
                latency_ms: start.elapsed().as_millis() as u64,
            }),
            Err(e) => Ok(ProviderStatus {
                available: false,
                models: vec![],
                version: None,
                error: Some(e.to_string()),
                latency_ms: start.elapsed().as_millis() as u64,
            }),
        }
    }

    async fn analyze_screenshot(&self, image_base64: &str, prompt: &str, model: &str) -> Result<String, AppError> {
        let model = if model.is_empty() { self.config.model.clone() } else { model.to_string() };
        let body = serde_json::json!({
            "model": model,
            "prompt": prompt,
            "images": [image_base64],
            "stream": false,
        });

        let res = self.client
            .post(format!("{}/api/generate", self.config.base_url))
            .json(&body)
            .timeout(std::time::Duration::from_secs(60))
            .send()
            .await?;

        let status = res.status();
        if !status.is_success() {
            let text = res.text().await.unwrap_or_default();
            return Err(AppError::AIAnalysis(format!("Ollama error ({}): {}", status, text)));
        }

        let data: serde_json::Value = res.json().await?;
        data["response"]
            .as_str()
            .map(String::from)
            .ok_or_else(|| AppError::AIAnalysis("Ollama返回中没有response字段".to_string()))
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>, AppError> {
        let res = self.client
            .get(format!("{}/api/tags", self.config.base_url))
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await?;

        if !res.status().is_success() {
            return Ok(vec![]);
        }

        let data: serde_json::Value = res.json().await?;
        let models = data["models"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|m| {
                        let name = m["name"].as_str()?;
                        let size = m["size"].as_u64().map(|s| {
                            let gb = s as f64 / 1024.0 / 1024.0 / 1024.0;
                            if gb >= 1.0 {
                                format!("{:.1}GB", gb)
                            } else {
                                format!("{}MB", s / 1024 / 1024)
                            }
                        });
                        Some(ModelInfo {
                            name: name.to_string(),
                            size,
                            is_vision: name.to_lowercase().contains("vl")
                                || name.to_lowercase().contains("vision")
                                || name.to_lowercase().contains("e2b")
                                || name.to_lowercase().contains("multimodal"),
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();

        Ok(models)
    }

    async fn chat(&self, prompt: &str, model: &str) -> Result<String, AppError> {
        let model = if model.is_empty() { self.config.model.clone() } else { model.to_string() };
        let body = serde_json::json!({
            "model": model,
            "prompt": prompt,
            "stream": false,
        });

        let res = self.client
            .post(format!("{}/api/generate", self.config.base_url))
            .json(&body)
            .timeout(std::time::Duration::from_secs(60))
            .send()
            .await?;

        let status = res.status();
        if !status.is_success() {
            let text = res.text().await.unwrap_or_default();
            return Err(AppError::AIAnalysis(format!("Ollama chat error ({}): {}", status, text)));
        }

        let data: serde_json::Value = res.json().await?;
        data["response"]
            .as_str()
            .map(String::from)
            .ok_or_else(|| AppError::AIAnalysis("Ollama返回中没有response字段".to_string()))
    }
}
