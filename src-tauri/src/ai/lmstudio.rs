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
            "stream": false
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
        data["choices"][0]["message"]["content"]
            .as_str()
            .map(String::from)
            .ok_or_else(|| AppError::AIAnalysis("LM Studio返回中没有content字段".to_string()))
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
                        let name = m["id"].as_str()?;
                        Some(ModelInfo {
                            name: name.to_string(),
                            size: None,
                            is_vision: name.to_lowercase().contains("vl")
                                || name.to_lowercase().contains("vision")
                                || name.to_lowercase().contains("e2b")
                                || name.to_lowercase().contains("multimodal")
                                || name.to_lowercase().contains("llava"),
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
            "stream": false
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
        data["choices"][0]["message"]["content"]
            .as_str()
            .map(String::from)
            .ok_or_else(|| AppError::AIAnalysis("LM Studio返回中没有content字段".to_string()))
    }
}

impl LMStudioClient {
    async fn pick_best_model(&self) -> Option<String> {
        if let Ok(models) = self.list_models().await {
            let vision = models.iter().find(|m| m.is_vision);
            if let Some(v) = vision {
                return Some(v.name.clone());
            }
            models.first().map(|m| m.name.clone())
        } else {
            None
        }
    }
}
