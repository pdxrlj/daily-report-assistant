# 截图分析流程详细设计

## 1. 截图捕获机制

### 1.1 捕获触发方式
```typescript
// src/types/screenshot.ts
export enum CaptureTrigger {
  Manual = 'manual',           // 用户手动触发
  Timer = 'timer',             // 定时捕获
  AppSwitch = 'app_switch',    // 应用切换时
  ContentChange = 'content_change', // 内容变化时
  Hotkey = 'hotkey',           // 快捷键触发
}

export interface CaptureConfig {
  trigger: CaptureTrigger;
  intervalMinutes?: number;    // 定时模式间隔
  contentChangeThreshold?: number; // 内容变化阈值
  hotkey?: string;            // 快捷键组合
  captureRegion?: Region;     // 截图区域
}
```

### 1.2 跨平台截图实现
```rust
// src-tauri/src/screenshot/platform.rs
#[cfg(target_os = "windows")]
pub mod windows {
    use windows::Win32::Graphics::Gdi::*;
    use windows::Win32::UI::WindowsAndMessaging::*;
    
    pub async fn capture_screen() -> Result<ScreenshotBuffer> {
        // 1. 获取屏幕尺寸
        let screen_width = GetSystemMetrics(SM_CXSCREEN);
        let screen_height = GetSystemMetrics(SM_CYSCREEN);
        
        // 2. 创建设备上下文
        let hdc_screen = GetDC(None);
        let hdc_mem = CreateCompatibleDC(hdc_screen);
        
        // 3. 创建位图
        let hbitmap = CreateCompatibleBitmap(hdc_screen, screen_width, screen_height);
        SelectObject(hdc_mem, hbitmap);
        
        // 4. 复制屏幕内容到内存
        BitBlt(hdc_mem, 0, 0, screen_width, screen_height, hdc_screen, 0, 0, SRCCOPY);
        
        // 5. 转换为字节数组
        let buffer = bitmap_to_bytes(hbitmap, screen_width, screen_height)?;
        
        // 6. 清理资源
        DeleteObject(hbitmap);
        DeleteDC(hdc_mem);
        ReleaseDC(None, hdc_screen);
        
        Ok(ScreenshotBuffer {
            data: buffer,
            width: screen_width as u32,
            height: screen_height as u32,
        })
    }
}

#[cfg(target_os = "macos")]
pub mod macos {
    use core_graphics::display::*;
    use core_graphics::image::*;
    
    pub async fn capture_screen() -> Result<ScreenshotBuffer> {
        // 1. 获取主显示器
        let main_display = CGDisplay::main();
        
        // 2. 捕获屏幕
        let image = CGDisplay::image_of_rect(main_display, main_display.bounds())?;
        
        // 3. 转换为字节数组
        let buffer = image_to_bytes(&image)?;
        
        Ok(ScreenshotBuffer {
            data: buffer,
            width: image.width() as u32,
            height: image.height() as u32,
        })
    }
}

#[cfg(target_os = "linux")]
pub mod linux {
    use xcb::x::*;
    
    pub async fn capture_screen() -> Result<ScreenshotBuffer> {
        // 1. 连接X服务器
        let (conn, screen_num) = xcb::Connection::connect()?;
        let screen = conn.get_setup().roots().nth(screen_num as usize).unwrap();
        
        // 2. 获取屏幕尺寸
        let width = screen.width_in_pixels();
        let height = screen.height_in_pixels();
        
        // 3. 捕获屏幕
        let image = get_image(
            &conn,
            ImageFormat::Z_PIXMAP,
            screen.root(),
            0, 0,
            width, height,
            !0,
        )?;
        
        // 4. 转换为字节数组
        let buffer = image.data().to_vec();
        
        Ok(ScreenshotBuffer {
            data: buffer,
            width: width as u32,
            height: height as u32,
        })
    }
}
```

## 2. 内容变化检测

### 2.1 pHash感知哈希算法
```rust
// src-tauri/src/screenshot/content_hash.rs
pub struct ContentHasher {
    hash_size: u32,
    low_frequency_ratio: f64,
}

impl ContentHasher {
    pub fn new() -> Self {
        Self {
            hash_size: 16,
            low_frequency_ratio: 0.3,
        }
    }
    
    /// 计算图片的感知哈希值
    pub fn compute_phash(&self, image_data: &[u8]) -> Result<ImageHash> {
        // 1. 缩小图片尺寸
        let resized = self.resize_image(image_data, self.hash_size + 1, self.hash_size)?;
        
        // 2. 转换为灰度图
        let grayscale = self.to_grayscale(&resized)?;
        
        // 3. 应用DCT变换
        let dct = self.apply_dct(&grayscale)?;
        
        // 4. 提取低频分量
        let low_frequency = self.extract_low_frequency(&dct);
        
        // 5. 计算哈希值
        let hash = self.compute_hash(&low_frequency);
        
        Ok(ImageHash(hash))
    }
    
    /// 比较两个哈希值的相似度
    pub fn compare_hashes(&self, hash1: &ImageHash, hash2: &ImageHash) -> f64 {
        let distance = self.hamming_distance(&hash1.0, &hash2.0);
        1.0 - (distance as f64 / (self.hash_size * self.hash_size) as f64)
    }
    
    /// 检测内容是否发生变化
    pub fn has_content_changed(
        &self,
        old_hash: &ImageHash,
        new_hash: &ImageHash,
        threshold: f64,
    ) -> bool {
        let similarity = self.compare_hashes(old_hash, new_hash);
        similarity < threshold
    }
}
```

### 2.2 智能采样策略
```rust
// src-tauri/src/screenshot/sampling.rs
pub struct SmartSampler {
    app_patterns: HashMap<String, SamplingPattern>,
    default_pattern: SamplingPattern,
}

pub struct SamplingPattern {
    base_interval: Duration,
    min_interval: Duration,
    max_interval: Duration,
    change_threshold: f64,
}

impl SmartSampler {
    pub fn new() -> Self {
        let mut app_patterns = HashMap::new();
        
        // IDE类应用：高频采样
        app_patterns.insert(
            "com.jetbrains.intellij".to_string(),
            SamplingPattern {
                base_interval: Duration::from_secs(10),
                min_interval: Duration::from_secs(5),
                max_interval: Duration::from_secs(30),
                change_threshold: 0.1,
            },
        );
        
        // 浏览器：中频采样
        app_patterns.insert(
            "com.google.Chrome".to_string(),
            SamplingPattern {
                base_interval: Duration::from_secs(30),
                min_interval: Duration::from_secs(15),
                max_interval: Duration::from_secs(60),
                change_threshold: 0.2,
            },
        );
        
        // 通讯应用：低频采样
        app_patterns.insert(
            "com.tencent.xinWeChat".to_string(),
            SamplingPattern {
                base_interval: Duration::from_secs(60),
                min_interval: Duration::from_secs(30),
                max_interval: Duration::from_secs(120),
                change_threshold: 0.3,
            },
        );
        
        Self {
            app_patterns,
            default_pattern: SamplingPattern {
                base_interval: Duration::from_secs(30),
                min_interval: Duration::from_secs(15),
                max_interval: Duration::from_secs(60),
                change_threshold: 0.2,
            },
        }
    }
    
    /// 根据当前应用调整采样频率
    pub fn adjust_sampling_rate(&self, current_app: &str, content_changed: bool) -> Duration {
        let pattern = self.app_patterns
            .get(current_app)
            .unwrap_or(&self.default_pattern);
        
        if content_changed {
            // 内容变化时，增加采样频率
            pattern.min_interval
        } else {
            // 内容稳定时，降低采样频率
            pattern.max_interval
        }
    }
}
```

## 3. 敏感信息过滤

### 3.1 OCR文本识别
```rust
// src-tauri/src/privacy/ocr.rs
pub struct OCREngine {
    engine: tesseract::Tesseract,
}

impl OCREngine {
    pub fn new() -> Result<Self> {
        let engine = tesseract::Tesseract::new(None, Some("eng+chi_sim"))
            .map_err(|e| PrivacyError::OCRError(e.to_string()))?;
        
        Ok(Self { engine })
    }
    
    /// 识别图片中的文本区域
    pub async fn recognize(&self, image: &ScreenshotBuffer) -> Result<Vec<TextRegion>> {
        // 1. 预处理图片
        let preprocessed = self.preprocess_image(image)?;
        
        // 2. 执行OCR识别
        let text = self.engine.set_image_from_bytes(&preprocessed)?
            .recognize()?;
        
        // 3. 提取文本区域
        let regions = self.extract_text_regions(&text)?;
        
        Ok(regions)
    }
    
    /// 预处理图片（二值化、去噪等）
    fn preprocess_image(&self, image: &ScreenshotBuffer) -> Result<Vec<u8>> {
        let mut img = image::load_from_memory(&image.data)?;
        
        // 1. 转换为灰度图
        img = img.grayscale();
        
        // 2. 二值化
        img = img.threshold(128);
        
        // 3. 去噪
        img = img.blur(1.0);
        
        // 4. 转换为字节数据
        let mut buffer = Vec::new();
        img.write_to(&mut buffer, image::ImageOutputFormat::Png)?;
        
        Ok(buffer)
    }
}
```

### 3.2 敏感信息检测
```rust
// src-tauri/src/privacy/detector.rs
pub struct SensitiveDetector {
    patterns: Vec<SensitivePattern>,
    ml_model: Option<MLDetector>,
}

pub struct SensitivePattern {
    name: String,
    regex: Regex,
    severity: Severity,
    action: FilterAction,
}

pub enum Severity {
    Low,
    Medium,
    High,
    Critical,
}

pub enum FilterAction {
    Blur,
    Redact,
    Remove,
}

impl SensitiveDetector {
    pub fn new() -> Self {
        let patterns = vec![
            // 信用卡号
            SensitivePattern {
                name: "credit_card".to_string(),
                regex: Regex::new(r"\b(?:\d[ -]*?){13,16}\b").unwrap(),
                severity: Severity::Critical,
                action: FilterAction::Blur,
            },
            // 密码字段
            SensitivePattern {
                name: "password_field".to_string(),
                regex: Regex::new(r"(?i)password|密码|passwd|pwd").unwrap(),
                severity: Severity::High,
                action: FilterAction::Blur,
            },
            // 身份证号
            SensitivePattern {
                name: "id_card".to_string(),
                regex: Regex::new(r"\b\d{17}[\dXx]\b").unwrap(),
                severity: Severity::Critical,
                action: FilterAction::Blur,
            },
            // 手机号
            SensitivePattern {
                name: "phone_number".to_string(),
                regex: Regex::new(r"\b1[3-9]\d{9}\b").unwrap(),
                severity: Severity::Medium,
                action: FilterAction::Blur,
            },
            // API密钥
            SensitivePattern {
                name: "api_key".to_string(),
                regex: Regex::new(r"(?i)api[_-]?key|token|secret").unwrap(),
                severity: Severity::High,
                action: FilterAction::Blur,
            },
        ];
        
        Self {
            patterns,
            ml_model: None,
        }
    }
    
    /// 检测敏感信息
    pub async fn detect(&self, text: &str) -> Result<Vec<SensitiveRegion>> {
        let mut regions = Vec::new();
        
        // 1. 基于正则表达式检测
        for pattern in &self.patterns {
            for mat in pattern.regex.find_iter(text) {
                regions.push(SensitiveRegion {
                    text: mat.as_str().to_string(),
                    pattern_name: pattern.name.clone(),
                    severity: pattern.severity.clone(),
                    action: pattern.action.clone(),
                    confidence: 0.9,
                });
            }
        }
        
        // 2. 使用机器学习模型检测（可选）
        if let Some(model) = &self.ml_model {
            let ml_regions = model.detect(text).await?;
            regions.extend(ml_regions);
        }
        
        // 3. 去重和排序
        regions.sort_by(|a, b| b.severity.cmp(&a.severity));
        regions.dedup_by_key(|r| r.text.clone());
        
        Ok(regions)
    }
}
```

### 3.3 模糊处理实现
```rust
// src-tauri/src/privacy/blurrer.rs
pub struct ImageBlurrer {
    blur_kernel_size: u32,
}

impl ImageBlurrer {
    pub fn new() -> Self {
        Self {
            blur_kernel_size: 15,
        }
    }
    
    /// 模糊指定区域
    pub fn blur_region(
        &self,
        image: &mut ScreenshotBuffer,
        region: &BoundingBox,
        intensity: BlurIntensity,
    ) -> Result<()> {
        // 1. 提取区域
        let mut sub_image = self.extract_region(image, region)?;
        
        // 2. 应用模糊效果
        match intensity {
            BlurIntensity::Low => {
                sub_image = sub_image.blur(3.0);
            }
            BlurIntensity::Medium => {
                sub_image = sub_image.blur(7.0);
            }
            BlurIntensity::High => {
                sub_image = sub_image.blur(15.0);
            }
            BlurIntensity::Pixelate => {
                sub_image = self.pixelate(&sub_image, 10)?;
            }
        }
        
        // 3. 将模糊后的区域写回原图
        self.paste_region(image, &sub_image, region)?;
        
        Ok(())
    }
    
    /// 像素化效果
    fn pixelate(&self, image: &DynamicImage, block_size: u32) -> Result<DynamicImage> {
        let (width, height) = image.dimensions();
        let mut pixelated = RgbImage::new(width, height);
        
        for y in (0..height).step_by(block_size as usize) {
            for x in (0..width).step_by(block_size as usize) {
                // 获取块内平均颜色
                let avg_color = self.get_block_average(image, x, y, block_size)?;
                
                // 填充整个块
                for dy in 0..block_size {
                    for dx in 0..block_size {
                        if x + dx < width && y + dy < height {
                            pixelated.put_pixel(x + dx, y + dy, avg_color);
                        }
                    }
                }
            }
        }
        
        Ok(DynamicImage::ImageRgb8(pixelated))
    }
}
```

## 4. AI分析提示词设计

### 4.1 通用分析提示词
```typescript
// src/ai/prompts.ts
export const ANALYSIS_PROMPT = `
你是一个专业的工作内容分析助手。请仔细分析这张截图，提取以下信息：

## 分析要求

1. **app_name**: 应用程序名称
   - 识别当前活动的应用程序
   - 包括完整的应用名称（如 "Visual Studio Code" 而不是 "VS"）

2. **activity_type**: 活动类型分类
   - coding: 编写代码、调试程序
   - design: UI设计、图形设计
   - communication: 邮件、即时通讯、会议
   - reading: 阅读文档、浏览网页
   - data_analysis: 数据处理、分析报表
   - writing: 撰写文档、编辑文本
   - meeting: 参加视频会议
   - other: 其他活动

3. **description**: 工作内容描述
   - 用简洁的中文描述正在进行的工作
   - 50-100字以内
   - 包含具体的任务和进度信息

4. **keywords**: 关键词列表
   - 提取3-5个最相关的关键词
   - 用于后续搜索和分类

5. **importance_score**: 重要性评分 (0.0-1.0)
   - 0.0-0.3: 低重要性（闲聊、浏览新闻等）
   - 0.3-0.6: 中等重要性（一般性工作）
   - 0.6-0.8: 高重要性（核心开发任务）
   - 0.8-1.0: 极高重要性（紧急任务、关键决策）

## 输出格式

请严格按照以下JSON格式返回：

{
    "app_name": "应用程序名称",
    "activity_type": "activity_type",
    "description": "工作内容描述",
    "keywords": ["关键词1", "关键词2", "关键词3"],
    "importance_score": 0.7
}

## 注意事项

- 不要猜测，只分析可见内容
- 如果无法确定，使用合理的默认值
- 保持描述客观、中立
- 不要包含任何个人隐私信息
`;
```

### 4.2 专用场景提示词
```typescript
// src/ai/prompts.ts
export const CODING_PROMPT = `
分析这个代码编辑器截图，提取以下信息：

1. **programming_language**: 编程语言
2. **framework**: 使用的框架/库
3. **task_type**: 任务类型（新功能开发/Bug修复/代码重构/代码审查）
4. **code_context**: 代码上下文描述
5. **complexity_score**: 复杂度评分 (0.0-1.0)

输出格式：
{
    "app_name": "代码编辑器名称",
    "activity_type": "coding",
    "description": "正在使用[语言]开发[功能]，涉及[具体技术点]",
    "keywords": ["语言", "框架", "模块名", "任务类型"],
    "importance_score": 0.7,
    "metadata": {
        "programming_language": "TypeScript",
        "framework": "React",
        "task_type": "新功能开发",
        "complexity_score": 0.6
    }
}
`;

export const MEETING_PROMPT = `
分析这个会议截图，提取以下信息：

1. **meeting_type**: 会议类型（周会/评审会/头脑风暴/一对一）
2. **participants**: 参与者数量（如可见）
3. **topic**: 会议主题
4. **duration_estimate**: 预估会议时长

输出格式：
{
    "app_name": "会议应用名称",
    "activity_type": "meeting",
    "description": "参加[会议类型]，主题：[主题]",
    "keywords": ["会议", "主题关键词", "参与者"],
    "importance_score": 0.6,
    "metadata": {
        "meeting_type": "周会",
        "topic": "项目进度同步",
        "duration_estimate": 60
    }
}
`;
```

## 5. 内存安全处理

### 5.1 安全缓冲区管理
```rust
// src-tauri/src/security/secure_buffer.rs
use zeroize::{Zeroize, ZeroizeOnDrop};
use std::sync::atomic::{AtomicUsize, Ordering};

#[derive(ZeroizeOnDrop)]
pub struct SecureBuffer {
    data: Vec<u8>,
    id: usize,
}

static BUFFER_COUNTER: AtomicUsize = AtomicUsize::new(0);

impl SecureBuffer {
    pub fn new(capacity: usize) -> Self {
        let id = BUFFER_COUNTER.fetch_add(1, Ordering::SeqCst);
        let mut data = Vec::with_capacity(capacity);
        data.resize(capacity, 0);
        
        Self { data, id }
    }
    
    /// 安全写入数据
    pub fn write(&mut self, offset: usize, data: &[u8]) -> Result<()> {
        if offset + data.len() > self.data.len() {
            return Err(SecurityError::BufferOverflow);
        }
        
        self.data[offset..offset + data.len()].copy_from_slice(data);
        Ok(())
    }
    
    /// 读取数据（返回副本，不暴露内部引用）
    pub fn read(&self, offset: usize, len: usize) -> Result<Vec<u8>> {
        if offset + len > self.data.len() {
            return Err(SecurityError::BufferOverflow);
        }
        
        Ok(self.data[offset..offset + len].to_vec())
    }
    
    /// 安全擦除数据
    pub fn secure_zeroize(&mut self) {
        // 使用zeroize安全擦除
        self.data.zeroize();
        
        // 额外的安全措施：内存屏障
        std::sync::atomic::compiler_fence(Ordering::SeqCst);
    }
    
    /// 获取缓冲区ID（用于日志记录）
    pub fn id(&self) -> usize {
        self.id
    }
}

impl Drop for SecureBuffer {
    fn drop(&mut self) {
        self.secure_zeroize();
    }
}

/// 安全缓冲区池
pub struct SecureBufferPool {
    buffers: Arc<Mutex<Vec<SecureBuffer>>>,
    max_size: usize,
}

impl SecureBufferPool {
    pub fn new(max_size: usize, buffer_capacity: usize) -> Self {
        let mut buffers = Vec::with_capacity(max_size);
        
        for _ in 0..max_size {
            buffers.push(SecureBuffer::new(buffer_capacity));
        }
        
        Self {
            buffers: Arc::new(Mutex::new(buffers)),
            max_size,
        }
    }
    
    /// 获取缓冲区
    pub async fn acquire(&self) -> Result<SecureBuffer> {
        let mut buffers = self.buffers.lock().await;
        
        if let Some(buffer) = buffers.pop() {
            Ok(buffer)
        } else {
            // 创建新缓冲区
            Ok(SecureBuffer::new(1920 * 1080 * 4)) // 1080p RGBA
        }
    }
    
    /// 释放缓冲区（安全擦除后返回池中）
    pub async fn release(&self, mut buffer: SecureBuffer) -> Result<()> {
        // 安全擦除数据
        buffer.secure_zeroize();
        
        let mut buffers = self.buffers.lock().await;
        
        if buffers.len() < self.max_size {
            buffers.push(buffer);
        }
        // 如果池已满，buffer会被drop，自动调用secure_zeroize
        
        Ok(())
    }
}
```

## 6. 工作流程图

### 6.1 完整流程
```
┌─────────────────────────────────────────────────────────────┐
│                    用户触发截图                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│  │ 手动触发 │  │ 定时触发 │  │ 快捷键  │  │ 应用切换│       │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘       │
│       └───────────┴───────────┴───────────┘                │
│                           │                                 │
└───────────────────────────┼─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   内存中捕获屏幕内容                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1. 分配安全缓冲区 (SecureBuffer)                    │   │
│  │ 2. 捕获屏幕到缓冲区                                 │   │
│  │ 3. 记录时间戳和元数据                               │   │
│  └─────────────────────────────────────────────────────┘   │
└───────────────────────────┼─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 内容变化检测 (pHash)                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1. 计算当前截图的pHash值                           │   │
│  │ 2. 与上次截图的pHash值比较                         │   │
│  │ 3. 如果相似度 > 阈值，跳过分析                     │   │
│  │ 4. 如果内容变化，继续分析                           │   │
│  └─────────────────────────────────────────────────────┘   │
└───────────────────────────┼─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 敏感信息检测与过滤                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1. OCR识别文本区域                                 │   │
│  │ 2. 正则匹配敏感信息（信用卡、密码、身份证等）     │   │
│  │ 3. ML模型检测敏感UI元素（可选）                    │   │
│  │ 4. 模糊处理敏感区域                                 │   │
│  └─────────────────────────────────────────────────────┘   │
└───────────────────────────┼─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 本地AI模型分析                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1. 准备分析提示词                                   │   │
│  │ 2. 将处理后的截图发送到本地VLM                     │   │
│  │ 3. 解析AI返回的结构化数据                         │   │
│  │ 4. 验证数据完整性和有效性                           │   │
│  └─────────────────────────────────────────────────────┘   │
└───────────────────────────┼─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 立即销毁截图                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1. 调用 secure_zeroize() 擦除内存数据              │   │
│  │ 2. 释放安全缓冲区回池                               │   │
│  │ 3. 清理所有临时文件（如有）                         │   │
│  │ 4. 内存屏障确保擦除完成                             │   │
│  └─────────────────────────────────────────────────────┘   │
└───────────────────────────┼─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 存储结构化数据                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1. 创建活动记录                                     │   │
│  │ 2. 插入activities表                                │   │
│  │ 3. 更新热力图数据                                   │   │
│  │ 4. 更新应用使用统计                                 │   │
│  │ 5. 发送分析完成事件                                 │   │
│  └─────────────────────────────────────────────────────┘   │
└───────────────────────────┼─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 更新UI界面                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1. 更新今日工作概览                                 │   │
│  │ 2. 更新时段记录热力图                               │   │
│  │ 3. 更新活动列表                                     │   │
│  │ 4. 显示分析结果通知                                 │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 7. 错误处理与恢复

### 7.1 错误类型定义
```rust
// src-tauri/src/errors.rs
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("截图捕获失败: {0}")]
    ScreenshotCapture(String),
    
    #[error("AI分析失败: {0}")]
    AIAnalysis(String),
    
    #[error("数据库错误: {0}")]
    Database(#[from] sqlx::Error),
    
    #[error("隐私过滤错误: {0}")]
    PrivacyFilter(String),
    
    #[error("模型加载失败: {0}")]
    ModelLoading(String),
    
    #[error("内存不足")]
    InsufficientMemory,
    
    #[error("用户取消操作")]
    UserCancelled,
}

impl AppError {
    pub fn is_recoverable(&self) -> bool {
        match self {
            Self::ScreenshotCapture(_) => true,
            Self::AIAnalysis(_) => true,
            Self::Database(_) => false,
            Self::PrivacyFilter(_) => true,
            Self::ModelLoading(_) => false,
            Self::InsufficientMemory => true,
            Self::UserCancelled => false,
        }
    }
    
    pub fn recovery_action(&self) -> Option<RecoveryAction> {
        match self {
            Self::ScreenshotCapture(_) => Some(RecoveryAction::Retry),
            Self::AIAnalysis(_) => Some(RecoveryAction::SkipAndContinue),
            Self::PrivacyFilter(_) => Some(RecoveryAction::UseOriginal),
            Self::InsufficientMemory => Some(RecoveryAction::ReduceQuality),
            _ => None,
        }
    }
}
```

### 7.2 重试机制
```rust
// src-tauri/src/retry.rs
pub struct RetryPolicy {
    max_retries: u32,
    base_delay: Duration,
    max_delay: Duration,
    backoff_factor: f64,
}

impl RetryPolicy {
    pub fn new() -> Self {
        Self {
            max_retries: 3,
            base_delay: Duration::from_millis(100),
            max_delay: Duration::from_secs(5),
            backoff_factor: 2.0,
        }
    }
    
    pub async fn execute<F, T, E>(&self, mut operation: F) -> Result<T, E>
    where
        F: FnMut() -> Pin<Box<dyn Future<Output = Result<T, E>> + Send>>,
        E: std::error::Error,
    {
        let mut retries = 0;
        let mut delay = self.base_delay;
        
        loop {
            match operation().await {
                Ok(result) => return Ok(result),
                Err(error) => {
                    retries += 1;
                    
                    if retries >= self.max_retries {
                        return Err(error);
                    }
                    
                    // 指数退避
                    tokio::time::sleep(delay).await;
                    delay = Duration::from_secs_f64(
                        (delay.as_secs_f64() * self.backoff_factor).min(self.max_delay.as_secs_f64())
                    );
                }
            }
        }
    }
}
```

---

*文档版本: 1.0*  
*最后更新: 2024-01-15*