use img_hash::{ImageHash, HasherConfig};
use crate::errors::AppError;

pub struct ContentHasher {
    hash_size: u32,
}

impl ContentHasher {
    pub fn new() -> Self {
        Self { hash_size: 16 }
    }

    /// 从 PNG 字节计算 pHash。
    /// img_hash 内部依赖 image 0.23（默认不含 PNG decoder），因此先用项目
    /// 的 image 0.25 解码 PNG，再手动构造 img_hash 版 DynamicImage。
    pub fn compute_phash(&self, png_data: &[u8]) -> Result<ImageHash, AppError> {
        // 用 image 0.25 解码 PNG（本项目 image crate 启用了 PNG feature）
        let decoded: image::DynamicImage = image::load_from_memory(png_data)
            .map_err(|e| AppError::ScreenshotCapture(e.to_string()))?;
        // 转为 RGBA8 像素，再构造 img_hash 版本的 RgbaImage
        let rgba8 = decoded.to_rgba8();
        let (w, h) = rgba8.dimensions();
        let raw_pixels = rgba8.as_raw().clone();
        let img_hash_rgba = img_hash::image::RgbaImage::from_raw(w, h, raw_pixels)
            .ok_or_else(|| AppError::ScreenshotCapture("无法构造 img_hash RgbaImage".to_string()))?;
        let dyn_img = img_hash::image::DynamicImage::ImageRgba8(img_hash_rgba);

        let hasher = HasherConfig::new()
            .hash_size(self.hash_size as u32, self.hash_size as u32)
            .to_hasher();
        Ok(hasher.hash_image(&dyn_img))
    }
}
