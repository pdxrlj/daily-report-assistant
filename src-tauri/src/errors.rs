use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("截图捕获失败: {0}")]
    ScreenshotCapture(String),

    #[error("AI分析失败: {0}")]
    AIAnalysis(String),

    #[error("数据库错误: {0}")]
    Database(#[from] sqlx::Error),

    #[error("IO错误: {0}")]
    Io(#[from] std::io::Error),

    #[error("序列化错误: {0}")]
    Serde(#[from] serde_json::Error),

    #[error("网络错误: {0}")]
    Network(String),

    #[error("参数错误: {0}")]
    InvalidArgument(String),
}

impl From<reqwest::Error> for AppError {
    fn from(e: reqwest::Error) -> Self {
        AppError::Network(e.to_string())
    }
}

impl From<image::ImageError> for AppError {
    fn from(e: image::ImageError) -> Self {
        AppError::ScreenshotCapture(e.to_string())
    }
}

impl From<xcap::XCapError> for AppError {
    fn from(e: xcap::XCapError) -> Self {
        AppError::ScreenshotCapture(e.to_string())
    }
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
