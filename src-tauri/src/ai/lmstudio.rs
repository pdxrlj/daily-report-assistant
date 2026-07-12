use crate::ai::provider::{AIProvider, AIProviderConfig, AIProviderType, ProviderStatus, ModelInfo};
use crate::errors::AppError;

pub struct LMStudioClient {
    config: AIProviderConfig,
    client: reqwest::Client,
}

impl LMStudioClient {
    pub fn new(config: AIProviderConfig) -> Self {
        Self {
            config,
            client: reqwest::Client::new(),
        }
    }
}

#[async_trait::async_trait]
impl AIProvider for LMStudioClient {
    fn provider_type(&self) -> &AIProviderType {
        &self.config.provider_type
    }

    async fn check_status(&self) -> Result<ProviderStatus, AppError> {
        let start = std::time::Instant::now();
        let res = self.client
            .get(format!("{}/v1/models", self.config.base_url))
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await;

        match res {
            Ok(resp) if resp.status().is_success() => {
                let data: serde_json::Value = resp.json().await?;
                let models = data["data"]
                    .as_array()
                    .map(|arr| arr.iter().filter_map(|m| m["id"].as_str().map(String::from)).collect())
                    .unwrap_or_default();
                Ok(ProviderStatus {
                    available: true,
                    models,
                    version: None,
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
        let model = if !model.is_empty() {
            model.to_string()
        } else if self.config.model.is_empty() {
            self.pick_best_model().await.unwrap_or_default()
        } else {
            self.config.model.clone()
        };

        let body = serde_json::json!({
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        { "type": "text", "text": prompt },
                        { "type": "image_url", "image_url": { "url": format!("data:image/png;base64,{}", image_base64) } }
                    ]
                }
            ],
            "max_tokens": 1024,
            "stream": false,
            "chat_template_kwargs": { "enable_thinking": false }
        });

        let mut req = self.client
            .post(format!("{}/v1/chat/completions", self.config.base_url))
            .json(&body)
            .timeout(std::time::Duration::from_secs(60));

        if let Some(key) = &self.config.api_key {
            req = req.header("Authorization", format!("Bearer {}", key));
        }

        let res = req.send().await?;
        let status = res.status();
        if !status.is_success() {
            let text = res.text().await.unwrap_or_default();
            return Err(AppError::AIAnalysis(format!("LM Studio error ({}): {}", status, text)));
        }

        let data: serde_json::Value = res.json().await?;
        let message = &data["choices"][0]["message"];
        let content = message["content"].as_str().unwrap_or("").to_string();
        if content.trim().is_empty() {
            return Err(AppError::AIAnalysis("LM Studio返回内容为空".to_string()));
        }
        Ok(content)
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>, AppError> {
        let res = self.client
            .get(format!("{}/v1/models", self.config.base_url))
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await?;

        if !res.status().is_success() {
            return Ok(vec![]);
        }

        let data: serde_json::Value = res.json().await?;
        let models = data["data"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|m| {
                        m["id"].as_str().map(|id| ModelInfo {
                            name: id.to_string(),
                            size: None,
                            // OpenAI 兼容接口无标准能力探测，能力保持未知（不显示）
                            is_vision: None,
                            supports_tools: None,
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();

        Ok(models)
    }

    async fn chat(&self, prompt: &str, model: &str) -> Result<String, AppError> {
        let model = if model.is_empty() {
            if self.config.model.is_empty() {
                self.pick_best_model().await.unwrap_or_default()
            } else {
                self.config.model.clone()
            }
        } else {
            model.to_string()
        };
        let body = serde_json::json!({
            "model": model,
            "messages": [{ "role": "user", "content": prompt }],
            "max_tokens": 1024,
            "stream": false,
            "chat_template_kwargs": { "enable_thinking": false }
        });

        let mut req = self.client
            .post(format!("{}/v1/chat/completions", self.config.base_url))
            .json(&body)
            .timeout(std::time::Duration::from_secs(60));

        if let Some(key) = &self.config.api_key {
            req = req.header("Authorization", format!("Bearer {}", key));
        }

        let res = req.send().await?;
        let status = res.status();
        if !status.is_success() {
            let text = res.text().await.unwrap_or_default();
            return Err(AppError::AIAnalysis(format!("LM Studio chat error ({}): {}", status, text)));
        }

        let data: serde_json::Value = res.json().await?;
        let message = &data["choices"][0]["message"];
        let content = message["content"].as_str().unwrap_or("").to_string();
        if content.trim().is_empty() {
            return Err(AppError::AIAnalysis("LM Studio返回内容为空".to_string()));
        }
        Ok(content)
    }
}

impl LMStudioClient {
    async fn pick_best_model(&self) -> Option<String> {
        if let Ok(models) = self.list_models().await {
            // OpenAI 兼容接口无法可靠探测视觉能力，直接取第一个模型
            models.first().map(|m| m.name.clone())
        } else {
            None
        }
    }
}
