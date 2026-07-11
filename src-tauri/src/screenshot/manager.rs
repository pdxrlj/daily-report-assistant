use chrono::Utc;
use xcap::Monitor;
use crate::errors::AppError;
use crate::security::SecureBuffer;
use crate::screenshot::content_hash::ContentHasher;

#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct ScreenshotInfo {
    pub id: String,
    pub width: u32,
    pub height: u32,
    pub timestamp: String,
    pub hash: String,
    pub monitor_name: String,
}

pub struct ScreenshotManager {
    hasher: ContentHasher,
}

impl ScreenshotManager {
    pub fn new() -> Self {
        Self {
            hasher: ContentHasher::new(),
        }
    }

    pub fn capture_screen(&self) -> Result<(SecureBuffer, ScreenshotInfo), AppError> {
        let monitors = Monitor::all()?;
        let primary = monitors.iter().find(|m| m.is_primary().unwrap_or(false)).unwrap_or(&monitors[0]);

        let img = primary.capture_image()?;
        let width = img.width();
        let height = img.height();
        let png = encode_png(img)?;

        let buffer = SecureBuffer::new(png.clone());
        let hash = self.hasher.compute_phash(&png)?.to_base64();

        let now = Utc::now();
        let info = ScreenshotInfo {
            id: uuid::Uuid::new_v4().to_string(),
            width,
            height,
            timestamp: now.to_rfc3339(),
            hash,
            monitor_name: primary.name()?,
        };

        Ok((buffer, info))
    }

    pub fn capture_all_monitors(&self) -> Result<Vec<(SecureBuffer, ScreenshotInfo)>, AppError> {
        let monitors = Monitor::all()?;
        let mut results = Vec::new();

        for monitor in &monitors {
            let img = monitor.capture_image()?;
            let width = img.width();
            let height = img.height();
            let png = encode_png(img)?;

            let buffer = SecureBuffer::new(png.clone());
            let hash = self.hasher.compute_phash(&png)?.to_base64();
            let now = Utc::now();

            results.push((
                buffer,
                ScreenshotInfo {
                    id: uuid::Uuid::new_v4().to_string(),
                    width,
                    height,
                    timestamp: now.to_rfc3339(),
                    hash,
                    monitor_name: monitor.name()?,
                },
            ));
        }

        Ok(results)
    }

    pub fn get_monitors_info(&self) -> Result<Vec<MonitorInfo>, AppError> {
        let monitors = Monitor::all()?;
        let mut result = Vec::new();
        for m in &monitors {
            result.push(MonitorInfo {
                id: m.id()?,
                name: m.name()?,
                width: m.width()?,
                height: m.height()?,
                scale_factor: (m.scale_factor()? * 100.0) as u32,
                is_primary: m.is_primary()?,
                x: m.x()?,
                y: m.y()?,
            });
        }
        Ok(result)
    }
}

#[derive(serde::Serialize, Clone)]
pub struct MonitorInfo {
    pub id: u32,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub scale_factor: u32,
    pub is_primary: bool,
    pub x: i32,
    pub y: i32,
}

/// 将截图编码为 PNG 字节。
/// 关键：xcap 返回的是 RgbaImage（裸像素），而 AI 视觉模型要求 base64(PNG/JPEG)，
/// img_hash::load_from_memory 也只认图片格式不认裸像素，因此必须先编码成 PNG。
fn encode_png(img: image::RgbaImage) -> Result<Vec<u8>, AppError> {
    let mut bytes = Vec::new();
    image::DynamicImage::ImageRgba8(img)
        .write_to(&mut std::io::Cursor::new(&mut bytes), image::ImageFormat::Png)?;
    Ok(bytes)
}
