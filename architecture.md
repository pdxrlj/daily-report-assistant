# 小黑日报助手 - 技术架构设计文档

## 1. 整体架构概述

### 1.1 核心设计原则
- **隐私优先**：截图在AI分析完成后立即销毁，仅保留文字描述
- **本地运行**：所有数据处理在本地完成，不上传云端
- **跨平台支持**：支持Windows、macOS、Linux操作系统
- **轻量高效**：低资源占用，不影响系统性能
- **安全可靠**：数据加密存储，敏感信息自动过滤

### 1.2 架构图
```
┌─────────────────────────────────────────────────────────┐
│                    用户界面层 (Frontend)                   │
│  React/Vue + TypeScript + Tailwind CSS                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│  │今日工作 │ │生成报告 │ │工作时间线│ │设置中心 │      │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘      │
└─────────────────────┬───────────────────────────────────┘
                      │ IPC通信 (Tauri Commands)
┌─────────────────────▼───────────────────────────────────┐
│                   业务逻辑层 (Backend)                    │
│  Rust + Tauri 2.x                                       │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│  │截图管理 │ │AI分析  │ │数据存储 │ │报告生成│      │
│  │模块     │ │调度器   │ │引擎     │ │引擎     │      │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘      │
└─────────────────────┬───────────────────────────────────┘
                      │ 本地调用
┌─────────────────────▼───────────────────────────────────┐
│                  AI模型层 (Local AI)                      │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Gemma 4 E2B / Qwen-VL / Local VLM               │   │
│  │ - 截图内容理解                                   │   │
│  │ - 应用识别与分类                                 │   │
│  │ - 工作活动提取                                   │   │
│  │ - 敏感信息检测与过滤                             │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────────┘
                      │ 文件操作
┌─────────────────────▼───────────────────────────────────┐
│                  数据存储层 (Storage)                     │
│  SQLite + 本地文件系统                                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│  │活动记录 │ │用户设置 │ │应用配置 │ │日志系统│      │
│  │数据库   │ │数据库   │ │文件     │ │         │      │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘      │
└─────────────────────────────────────────────────────────┘
```

## 2. 技术栈选择

### 2.1 前端技术栈
| 技术 | 版本 | 用途 | 选择理由 |
|------|------|------|----------|
| **React** | 18.x | UI框架 | 生态成熟，组件丰富 |
| **TypeScript** | 5.x | 类型安全 | 提高代码质量，减少运行时错误 |
| **Tailwind CSS** | 3.x | 样式框架 | 原子化CSS，快速开发 |
| **Zustand** | 4.x | 状态管理 | 轻量级，TypeScript友好 |
| **Recharts** | 2.x | 图表库 | React生态，支持热力图 |
| **Framer Motion** | 10.x | 动画库 | 流畅的过渡动画 |

### 2.2 后端技术栈
| 技术 | 版本 | 用途 | 选择理由 |
|------|------|------|----------|
| **Tauri** | 2.x | 桌面框架 | 轻量级，安全性高，跨平台 |
| **Rust** | 1.75+ | 后端语言 | 内存安全，高性能 |
| **SQLite** | 3.x | 数据库 | 本地存储，无需服务器 |
| **sqlx** | 0.7.x | 数据库驱动 | 异步，编译时SQL检查 |
| **serde** | 1.x | 序列化 | 高性能JSON处理 |
| **tokio** | 1.x | 异步运行时 | 高效异步IO处理 |

### 2.3 AI模型层
| 模型 | 参数量 | 显存需求 | 特点 | 推荐场景 |
|------|--------|----------|------|----------|
| **Gemma 4 E2B** | 2B | 4GB | 多模态，支持截图分析 | 低配设备首选 |
| **Qwen-VL-7B** | 7B | 8GB | 中文理解强，视觉能力优秀 | 中文用户推荐 |
| **LLaVA-1.6-7B** | 7B | 8GB | 开源，社区活跃 | 通用场景 |
| **Phi-3 Vision** | 4B | 6GB | 微软出品，性能均衡 | 轻量级部署 |
| **Ollama** | - | - | 本地模型管理工具 | 统一模型管理 |

### 2.4 开发工具链
| 工具 | 用途 |
|------|------|
| **Vite** | 前端构建工具 |
| **ESLint** | 代码质量检查 |
| **Prettier** | 代码格式化 |
| **Vitest** | 单元测试 |
| **Playwright** | E2E测试 |
| **GitHub Actions** | CI/CD |

## 3. 核心模块设计

### 3.1 截图管理模块
```rust
// src-tauri/src/screenshot/manager.rs
pub struct ScreenshotManager {
    capture_interval: Duration,
    is_running: bool,
    buffer_pool: Arc<BufferPool>,
}

impl ScreenshotManager {
    /// 捕获屏幕截图（仅存储在内存中）
    pub async fn capture_screen(&self) -> Result<ScreenshotBuffer> {
        // 1. 捕获屏幕截图到内存缓冲区
        let buffer = self.buffer_pool.acquire();
        let screenshot = platform::capture_screen(&buffer).await?;
        
        // 2. 检测屏幕内容变化（避免重复分析）
        if !self.has_content_changed(&screenshot).await {
            self.buffer_pool.release(buffer);
            return Err(ScreenshotError::NoChange);
        }
        
        // 3. 敏感信息检测与模糊处理
        let filtered = self.filter_sensitive_info(&screenshot).await?;
        
        Ok(ScreenshotBuffer {
            data: filtered,
            timestamp: Utc::now(),
            dimensions: screenshot.dimensions,
        })
    }
    
    /// 立即销毁截图（安全擦除）
    pub fn destroy_screenshot(&self, buffer: &mut ScreenshotBuffer) {
        // 安全擦除内存数据
        buffer.data.zeroize();
        // 释放缓冲区回池
        self.buffer_pool.release(buffer.clone());
    }
}
```

### 3.2 AI分析调度器
```rust
// src-tauri/src/ai/scheduler.rs
pub struct AIScheduler {
    model: Arc<dyn VisionModel>,
    analysis_queue: Arc<SegQueue<AnalysisTask>>,
    result_sender: broadcast::Sender<AnalysisResult>,
}

impl AIScheduler {
    /// 分析截图内容
    pub async fn analyze_screenshot(&self, screenshot: ScreenshotBuffer) -> Result<AnalysisResult> {
        // 1. 发送到分析队列
        let task = AnalysisTask {
            id: Uuid::new_v4(),
            screenshot,
            created_at: Utc::now(),
        };
        
        // 2. 调用本地AI模型进行分析
        let result = self.model.analyze(&task.screenshot).await?;
        
        // 3. 立即销毁截图
        task.screenshot.lock().await.zeroize();
        
        // 4. 生成结构化数据
        let structured_data = self.parse_to_structured_data(&result).await?;
        
        // 5. 发送分析结果
        self.result_sender.send(structured_data.clone())?;
        
        Ok(structured_data)
    }
    
    /// 解析AI分析结果为结构化数据
    async fn parse_to_structured_data(&self, raw_result: &str) -> Result<StructuredData> {
        // 使用规则引擎 + LLM解析
        let parsed = serde_json::from_str::<RawAnalysisResult>(raw_result)?;
        
        Ok(StructuredData {
            app_name: parsed.app_name,
            activity_type: ActivityType::from_str(&parsed.activity_type)?,
            description: parsed.description,
            keywords: parsed.keywords,
            importance_score: parsed.importance_score,
            timestamp: Utc::now(),
        })
    }
}
```

### 3.3 数据存储引擎
```rust
// src-tauri/src/storage/engine.rs
pub struct StorageEngine {
    db: SqlitePool,
    encryption_key: Option<[u8; 32]>,
}

impl StorageEngine {
    /// 初始化数据库
    pub async fn new(db_path: &Path) -> Result<Self> {
        // 1. 创建数据库连接池
        let db = SqlitePool::connect(&db_path.to_string_lossy()).await?;
        
        // 2. 执行数据库迁移
        sqlx::migrate!().run(&db).await?;
        
        // 3. 加载或生成加密密钥
        let encryption_key = Self::load_or_generate_key(db_path)?;
        
        Ok(Self { db, encryption_key })
    }
    
    /// 保存分析结果（不存储截图）
    pub async fn save_activity(&self, activity: &ActivityRecord) -> Result<()> {
        sqlx::query!(
            r#"
            INSERT INTO activities (timestamp, app_name, activity_type, description, keywords, importance_score)
            VALUES (?, ?, ?, ?, ?, ?)
            "#,
            activity.timestamp,
            activity.app_name,
            activity.activity_type,
            activity.description,
            activity.keywords,
            activity.importance_score
        )
        .execute(&self.db)
        .await?;
        
        Ok(())
    }
    
    /// 获取今日活动记录
    pub async fn get_today_activities(&self) -> Result<Vec<ActivityRecord>> {
        let today = Utc::now().date_naive();
        
        let records = sqlx::query_as!(
            ActivityRecord,
            r#"
            SELECT * FROM activities 
            WHERE DATE(timestamp) = ?
            ORDER BY timestamp ASC
            "#,
            today
        )
        .fetch_all(&self.db)
        .await?;
        
        Ok(records)
    }
}
```

### 3.4 报告生成引擎
```rust
// src-tauri/src/report/generator.rs
pub struct ReportGenerator {
    storage: Arc<StorageEngine>,
    template_engine: TemplateEngine,
}

impl ReportGenerator {
    /// 生成日报
    pub async fn generate_daily_report(&self, date: NaiveDate) -> Result<DailyReport> {
        // 1. 获取指定日期的所有活动
        let activities = self.storage.get_activities_by_date(date).await?;
        
        // 2. 统计分析
        let stats = self.calculate_statistics(&activities).await?;
        
        // 3. 生成热力图数据
        let heatmap = self.generate_heatmap_data(&activities).await?;
        
        // 4. 生成时间段分析
        let time_segments = self.analyze_time_segments(&activities).await?;
        
        // 5. 生成报告
        let report = DailyReport {
            date,
            total_activities: activities.len(),
            focus_duration: stats.focus_duration,
            main_activities: stats.main_activities,
            heatmap,
            time_segments,
            generated_at: Utc::now(),
        };
        
        Ok(report)
    }
    
    /// 生成热力图数据
    async fn generate_heatmap_data(&self, activities: &[ActivityRecord]) -> Result<HeatmapData> {
        let mut hourly_counts = vec![0u32; 24];
        
        for activity in activities {
            let hour = activity.timestamp.hour() as usize;
            hourly_counts[hour] += 1;
        }
        
        Ok(HeatmapData {
            hourly_activity: hourly_counts,
            max_intensity: hourly_counts.iter().max().unwrap_or(&0).clone(),
        })
    }
}
```

## 4. 隐私保护机制

### 4.1 截图处理流程
```
用户触发截图
    ↓
内存中捕获屏幕内容
    ↓
敏感信息检测（信用卡、密码、身份证等）
    ↓
敏感区域模糊处理
    ↓
发送到本地AI模型分析
    ↓
AI返回结构化文本描述
    ↓
立即销毁截图内存（zeroize）
    ↓
仅保存文字描述到数据库
```

### 4.2 敏感信息过滤
```rust
// src-tauri/src/privacy/filter.rs
pub struct SensitiveInfoFilter {
    patterns: Vec<SensitivePattern>,
    ocr_engine: Arc<dyn OCREngine>,
}

impl SensitiveInfoFilter {
    /// 检测并过滤敏感信息
    pub async fn filter(&self, screenshot: &ScreenshotBuffer) -> Result<ScreenshotBuffer> {
        let mut filtered = screenshot.clone();
        
        // 1. 使用OCR识别文本
        let text_regions = self.ocr_engine.recognize(screenshot).await?;
        
        // 2. 检测敏感信息模式
        for region in text_regions {
            if self.is_sensitive(&region.text) {
                // 3. 模糊处理敏感区域
                filtered.blur_region(&region.bounding_box, BlurIntensity::High)?;
            }
        }
        
        // 4. 检测特定UI元素（密码输入框、信用卡输入框等）
        let sensitive_ui = self.detect_sensitive_ui_elements(screenshot).await?;
        for ui_element in sensitive_ui {
            filtered.blur_region(&ui_element.bounding_box, BlurIntensity::Medium)?;
        }
        
        Ok(filtered)
    }
    
    /// 检测是否包含敏感信息
    fn is_sensitive(&self, text: &str) -> bool {
        // 信用卡号模式
        let credit_card_pattern = Regex::new(r"\b(?:\d[ -]*?){13,16}\b").unwrap();
        // 密码模式
        let password_pattern = Regex::new(r"(?i)password|密码|passwd").unwrap();
        // 身份证号模式
        let id_card_pattern = Regex::new(r"\b\d{17}[\dXx]\b").unwrap();
        
        credit_card_pattern.is_match(text)
            || password_pattern.is_match(text)
            || id_card_pattern.is_match(text)
    }
}
```

### 4.3 内存安全擦除
```rust
// src-tauri/src/security/zeroize.rs
use zeroize::Zeroize;

#[derive(Clone)]
pub struct SecureBuffer {
    data: Vec<u8>,
}

impl SecureBuffer {
    /// 安全擦除内存数据
    pub fn zeroize(&mut self) {
        // 使用zeroize库安全擦除
        self.data.zeroize();
        // 确保编译器不会优化掉擦除操作
        std::sync::atomic::compiler_fence(std::sync::atomic::Ordering::SeqCst);
    }
}

impl Drop for SecureBuffer {
    fn drop(&mut self) {
        self.zeroize();
    }
}
```

## 5. 数据存储设计

### 5.1 数据库表结构
```sql
-- 活动记录表（核心表，不存储任何图片数据）
CREATE TABLE activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME NOT NULL,
    app_name TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    description TEXT NOT NULL,
    keywords TEXT,  -- JSON数组
    importance_score REAL DEFAULT 0.5,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 热力图数据表（预计算，提升查询性能）
CREATE TABLE heatmap_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL,
    hour INTEGER NOT NULL,
    activity_count INTEGER NOT NULL,
    focus_duration_minutes INTEGER DEFAULT 0,
    UNIQUE(date, hour)
);

-- 用户设置表
CREATE TABLE user_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 应用使用统计表
CREATE TABLE app_usage_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_name TEXT NOT NULL,
    date DATE NOT NULL,
    usage_minutes INTEGER DEFAULT 0,
    activity_count INTEGER DEFAULT 0,
    UNIQUE(app_name, date)
);

-- 创建索引
CREATE INDEX idx_activities_timestamp ON activities(timestamp);
CREATE INDEX idx_activities_app_name ON activities(app_name);
CREATE INDEX idx_activities_date ON activities(DATE(timestamp));
CREATE INDEX idx_heatmap_date ON heatmap_data(date);
CREATE INDEX idx_app_usage_date ON app_usage_stats(date);
```

### 5.2 本地配置文件
```json
// ~/.config/daily-report-assistant/config.json
{
  "version": "1.0.0",
  "privacy": {
    "screenshot_analysis_mode": "immediate_destroy",
    "sensitive_info_filter": true,
    "auto_blur_passwords": true,
    "data_retention_days": 90,
    "auto_delete_old_data": true
  },
  "ai_model": {
    "provider": "ollama",
    "model_name": "gemma4-e2b",
    "api_endpoint": "http://localhost:11434",
    "analysis_timeout_seconds": 30,
    "confidence_threshold": 0.7
  },
  "screenshot": {
    "capture_mode": "manual",
    "capture_interval_minutes": 5,
    "detect_content_change": true,
    "change_threshold": 0.1
  },
  "ui": {
    "theme": "system",
    "language": "zh-CN",
    "show_tray_icon": true,
    "start_minimized": false
  }
}
```

## 6. 界面模块设计

### 6.1 界面结构
```
┌─────────────────────────────────────────────────────────┐
│ 应用标题栏                                    _ □ ✕     │
├─────────────────────────────────────────────────────────┤
│ 侧边栏          │           主内容区域                  │
│ ┌─────────────┐ │ ┌─────────────────────────────────────┐│
│ │ 📊 今日工作 │ │ │ 从今天起，汇报自动化               ││
│ ├─────────────┤ │ │                                     ││
│ │ 📝 生成报告 │ │ │ 工作概览                           ││
│ ├─────────────┤ │ │ 146条记录 | 1.7h专注 | 设计        ││
│ │ ⏱️ 工作时间线│ │ │                                     ││
│ ├─────────────┤ │ │ 时段记录                           ││
│ │ 🔥 时段热力图│ │ │ 周日 [██] 8 21 55 13 37 60 9     ││
│ ├─────────────┤ │ │ 昨天 [████████] 58 86 31 59...   ││
│ │ 📱 应用记录 │ │ │ 今天 [███] 4 77 65              ││
│ ├─────────────┤ │ │                                     ││
│ │ 📚 历史报告 │ │ │ 已连接显示器                       ││
│ ├─────────────┤ │ │ 1. T270LG 2560×1440 100%        ││
│ │ 🤖 接入Agent│ │ │ 2. 内建视网膜 3024×1964 200%    ││
│ └─────────────┘ │ └─────────────────────────────────────┘│
├─────────────────────────────────────────────────────────┤
│ 状态栏: 最后同步: 2024-01-15 14:30 | 本地模型: Gemma4  │
└─────────────────────────────────────────────────────────┘
```

### 6.2 核心页面组件
```typescript
// src/components/TodayWork.tsx
interface TodayWorkProps {
  activities: Activity[];
  heatmapData: HeatmapData;
  statistics: WorkStatistics;
}

export const TodayWork: React.FC<TodayWorkProps> = ({
  activities,
  heatmapData,
  statistics
}) => {
  return (
    <div className="flex flex-col h-full">
      {/* 头部欢迎区域 */}
      <header className="p-6 border-b">
        <h1 className="text-2xl font-bold">从今天起，汇报自动化</h1>
        <p className="text-gray-600">
          截图、分析、生成、导出，全流程 AI 完成，让日报像呼吸一样自然。
        </p>
        <div className="flex gap-4 mt-4 text-sm text-gray-500">
          <span>✓ 截图分析后即刻销毁</span>
          <span>✓ 数据仅存本地，不上传云端</span>
          <span>✓ 你的工作内容只属于你</span>
        </div>
      </header>
      
      {/* 工作概览卡片 */}
      <div className="grid grid-cols-3 gap-4 p-6">
        <StatCard 
          title="记录条数" 
          value={statistics.totalActivities} 
        />
        <StatCard 
          title="专注时长" 
          value={`${statistics.focusDuration}h`} 
        />
        <StatCard 
          title="主要工作" 
          value={statistics.mainActivity} 
        />
      </div>
      
      {/* 时段记录热力图 */}
      <div className="p-6">
        <HeatmapChart data={heatmapData} />
      </div>
      
      {/* 显示器信息 */}
      <div className="p-6 border-t">
        <DisplayInfo displays={statistics.connectedDisplays} />
      </div>
    </div>
  );
};
```

## 7. AI模型集成方案

### 7.1 Ollama集成
```rust
// src-tauri/src/ai/ollama.rs
pub struct OllamaClient {
    base_url: String,
    client: reqwest::Client,
}

impl OllamaClient {
    /// 分析截图内容
    pub async fn analyze_screenshot(
        &self,
        image_data: &[u8],
        prompt: &str
    ) -> Result<String> {
        let request = OllamaRequest {
            model: "gemma4-e2b".to_string(),
            prompt: prompt.to_string(),
            images: vec![base64::encode(image_data)],
            stream: false,
        };
        
        let response = self.client
            .post(&format!("{}/api/generate", self.base_url))
            .json(&request)
            .send()
            .await?
            .json::<OllamaResponse>()
            .await?;
        
        Ok(response.response)
    }
    
    /// 生成分析提示词
    fn generate_analysis_prompt() -> String {
        r#"
        请分析这张截图，提取以下信息并以JSON格式返回：
        
        1. app_name: 应用程序名称
        2. activity_type: 活动类型（coding/design/communication/reading/other）
        3. description: 工作内容描述（50-100字）
        4. keywords: 关键词列表（最多5个）
        5. importance_score: 重要性评分（0-1）
        
        要求：
        - 描述要简洁明了
        - 关键词要准确反映工作内容
        - 重要性评分基于工作复杂度和专注程度
        
        JSON格式示例：
        {
            "app_name": "VS Code",
            "activity_type": "coding",
            "description": "正在开发React组件，实现用户登录功能",
            "keywords": ["React", "TypeScript", "登录", "组件"],
            "importance_score": 0.8
        }
        "#.to_string()
    }
}
```

### 7.2 模型管理
```rust
// src-tauri/src/ai/model_manager.rs
pub struct ModelManager {
    installed_models: Vec<ModelInfo>,
    active_model: Option<String>,
}

impl ModelManager {
    /// 安装模型
    pub async fn install_model(&mut self, model_name: &str) -> Result<()> {
        // 1. 检查系统资源
        self.check_system_requirements(model_name).await?;
        
        // 2. 下载模型
        self.download_model(model_name).await?;
        
        // 3. 验证模型完整性
        self.verify_model(model_name).await?;
        
        // 4. 更新已安装模型列表
        self.installed_models.push(ModelInfo {
            name: model_name.to_string(),
            size: self.get_model_size(model_name).await?,
            installed_at: Utc::now(),
        });
        
        Ok(())
    }
    
    /// 切换活跃模型
    pub fn set_active_model(&mut self, model_name: &str) -> Result<()> {
        if !self.installed_models.iter().any(|m| m.name == model_name) {
            return Err(AIError::ModelNotInstalled(model_name.to_string()));
        }
        
        self.active_model = Some(model_name.to_string());
        Ok(())
    }
    
    /// 检查系统是否满足模型要求
    async fn check_system_requirements(&self, model_name: &str) -> Result<()> {
        let requirements = match model_name {
            "gemma4-e2b" => SystemRequirements {
                min_ram_gb: 8,
                min_vram_gb: 4,
                recommended_vram_gb: 6,
            },
            "qwen-vl-7b" => SystemRequirements {
                min_ram_gb: 16,
                min_vram_gb: 8,
                recommended_vram_gb: 12,
            },
            _ => return Err(AIError::UnknownModel(model_name.to_string())),
        };
        
        let system_info = self.get_system_info().await?;
        
        if system_info.total_ram_gb < requirements.min_ram_gb {
            return Err(AIError::InsufficientRAM {
                required: requirements.min_ram_gb,
                available: system_info.total_ram_gb,
            });
        }
        
        Ok(())
    }
}
```

## 8. 性能优化策略

### 8.1 截图捕获优化
- **内容变化检测**：使用pHash算法检测屏幕内容变化，避免重复分析
- **智能采样**：根据应用类型调整采样频率（IDE高频，浏览器低频）
- **区域截图**：只截取活动窗口，减少处理数据量
- **内存池**：预分配内存缓冲区，避免频繁分配释放

### 8.2 AI分析优化
- **批量处理**：积攒多个截图批量分析，减少模型调用次数
- **缓存机制**：相同应用界面的分析结果缓存
- **异步处理**：分析过程完全异步，不阻塞UI
- **模型量化**：使用INT4/INT8量化模型，减少显存占用

### 8.3 数据库优化
- **索引优化**：为常用查询字段创建索引
- **预计算**：热力图数据预计算存储
- **连接池**：使用连接池管理数据库连接
- **批量插入**：活动记录批量插入

## 9. 部署与安装

### 9.1 安装包结构
```
daily-report-assistant/
├── src-tauri/           # Rust后端
│   ├── src/
│   │   ├── main.rs
│   │   ├── screenshot/  # 截图管理
│   │   ├── ai/          # AI模型集成
│   │   ├── storage/     # 数据存储
│   │   ├── privacy/     # 隐私保护
│   │   └── report/      # 报告生成
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                 # React前端
│   ├── components/
│   ├── pages/
│   ├── stores/
│   └── utils/
├── package.json
└── README.md
```

### 9.2 跨平台构建
```bash
# Windows
npm run tauri build -- --target x86_64-pc-windows-msvc

# macOS
npm run tauri build -- --target x86_64-apple-darwin
npm run tauri build -- --target aarch64-apple-darwin

# Linux
npm run tauri build -- --target x86_64-unknown-linux-gnu
```

## 10. 安全考虑

### 10.1 数据安全
- 所有数据本地存储，不上传云端
- 敏感信息（API密钥）使用系统密钥链存储
- 数据库文件加密存储
- 定期自动清理旧数据

### 10.2 运行安全
- Tauri沙箱隔离，限制系统访问
- 最小权限原则
- 输入验证和SQL注入防护
- 内存安全（Rust保证）

### 10.3 隐私合规
- 截图分析后立即销毁
- 不收集用户行为数据
- 本地AI模型，数据不离开设备
- 用户完全控制数据生命周期

## 11. 扩展功能

### 11.1 未来功能规划
- **多显示器支持**：同时分析多个显示器内容
- **语音日报**：语音输入生成日报
- **团队协作**：加密共享日报（端到端加密）
- **AI Agent集成**：智能任务管理
- **应用使用统计**：详细的应用使用分析
- **专注模式检测**：识别深度工作状态

### 11.2 插件系统
```rust
// 插件接口定义
pub trait Plugin: Send + Sync {
    fn name(&self) -> &str;
    fn version(&self) -> &str;
    fn initialize(&mut self, config: &PluginConfig) -> Result<()>;
    fn on_screenshot_captured(&self, screenshot: &ScreenshotBuffer) -> Result<()>;
    fn on_analysis_completed(&self, result: &AnalysisResult) -> Result<()>;
    fn cleanup(&mut self) -> Result<()>;
}
```

## 12. 总结

### 12.1 技术优势
1. **极致隐私**：截图即销毁，数据不出本地
2. **轻量高效**：Tauri比Electron体积小30倍，内存占用低10倍
3. **跨平台**：一套代码支持Windows、macOS、Linux
4. **本地AI**：支持多种开源视觉模型，无需联网
5. **安全可靠**：Rust内存安全，Tauri沙箱隔离

### 12.2 硬件要求
| 组件 | 最低配置 | 推荐配置 |
|------|----------|----------|
| CPU | 4核 | 8核 |
| RAM | 8GB | 16GB |
| 显存 | 4GB | 8GB |
| 存储 | 1GB | 5GB |

### 12.3 开发周期
- **Phase 1** (4周): 核心框架搭建，截图捕获与分析
- **Phase 2** (3周): 数据存储与热力图实现
- **Phase 3** (3周): 报告生成与UI完善
- **Phase 4** (2周): 测试、优化与发布

---

*文档版本: 1.0*  
*最后更新: 2024-01-15*  
*作者: 架构设计团队*