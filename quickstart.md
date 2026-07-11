# 快速开始指南

## 1. 项目概述

**小黑日报助手**是一款隐私优先的桌面应用，通过本地AI分析屏幕截图，自动生成工作日报。截图在AI分析完成后立即销毁，仅保留文字描述，确保用户隐私安全。

### 核心特性
- ✅ **隐私优先**：截图即销毁，数据不出本地
- ✅ **本地AI**：支持Gemma 4、Qwen-VL等开源视觉模型
- ✅ **跨平台**：支持Windows、macOS、Linux
- ✅ **轻量高效**：Tauri框架，安装包<15MB
- ✅ **智能分析**：自动识别应用、活动类型、工作内容

## 2. 环境准备

### 2.1 系统要求
| 组件 | 最低配置 | 推荐配置 |
|------|----------|----------|
| 操作系统 | Windows 10/macOS 12/Ubuntu 20.04 | 最新版本 |
| CPU | 4核 | 8核 |
| RAM | 8GB | 16GB |
| 显存 | 4GB | 8GB |
| 存储空间 | 1GB | 5GB |

### 2.2 安装开发工具

#### Windows
```powershell
# 安装 Rust
winget install Rustlang.Rustup

# 安装 Node.js (推荐使用nvm)
winget install OpenJS.NodeJS.LTS

# 安装 Visual Studio Build Tools
winget install Microsoft.VisualStudio.2022.BuildTools
```

#### macOS
```bash
# 安装 Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装 Node.js
brew install node
```

#### Linux (Ubuntu/Debian)
```bash
# 安装系统依赖
sudo apt update
sudo apt install -y curl wget build-essential pkg-config libssl-dev libgtk-3-dev libwebkit2gtk-4.0-dev libayatana-appindicator3-dev librsvg2-dev

# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装 Node.js
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2.3 安装Ollama (本地AI模型)

```bash
# 安装Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 拉取Gemma 4 E2B模型 (推荐，仅需4GB显存)
ollama pull gemma4-e2b

# 或者拉取Qwen-VL-7B (中文更强，需要8GB显存)
ollama pull qwen-vl:7b

# 测试模型是否正常工作
ollama run gemma4-e2b "你好"
```

## 3. 项目初始化

### 3.1 克隆项目模板
```bash
# 创建项目目录
mkdir daily-report-assistant
cd daily-report-assistant

# 初始化Tauri项目
npm create tauri-app@latest . -- --template react-ts

# 安装前端依赖
npm install

# 安装Tauri CLI
npm install -D @tauri-apps/cli
```

### 3.2 项目结构
```
daily-report-assistant/
├── src-tauri/                    # Rust后端
│   ├── src/
│   │   ├── main.rs              # 主入口
│   │   ├── lib.rs               # 库入口
│   │   ├── screenshot/          # 截图模块
│   │   │   ├── mod.rs
│   │   │   ├── manager.rs       # 截图管理器
│   │   │   ├── platform.rs      # 跨平台实现
│   │   │   └── content_hash.rs  # 内容变化检测
│   │   ├── ai/                  # AI模块
│   │   │   ├── mod.rs
│   │   │   ├── ollama.rs        # Ollama客户端
│   │   │   ├── scheduler.rs     # 分析调度器
│   │   │   └── prompts.rs       # 提示词
│   │   ├── storage/             # 存储模块
│   │   │   ├── mod.rs
│   │   │   └── engine.rs        # 数据库引擎
│   │   ├── privacy/             # 隐私模块
│   │   │   ├── mod.rs
│   │   │   ├── filter.rs        # 敏感信息过滤
│   │   │   ├── ocr.rs           # OCR识别
│   │   │   └── blurrer.rs       # 模糊处理
│   │   ├── report/              # 报告模块
│   │   │   ├── mod.rs
│   │   │   └── generator.rs     # 报告生成器
│   │   └── security/            # 安全模块
│   │       ├── mod.rs
│   │       └── secure_buffer.rs # 安全缓冲区
│   ├── Cargo.toml               # Rust依赖
│   └── tauri.conf.json          # Tauri配置
├── src/                          # React前端
│   ├── components/              # 组件
│   │   ├── TodayWork.tsx        # 今日工作
│   │   ├── HeatmapChart.tsx     # 热力图
│   │   ├── ActivityList.tsx     # 活动列表
│   │   └── Settings.tsx         # 设置
│   ├── pages/                   # 页面
│   ├── stores/                  # 状态管理
│   ├── utils/                   # 工具函数
│   ├── App.tsx                  # 主组件
│   └── main.tsx                 # 入口
├── package.json                 # Node依赖
└── README.md
```

### 3.3 安装核心依赖

#### 前端依赖
```bash
# UI框架
npm install react react-dom
npm install -D @types/react @types/react-dom

# 样式
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# 状态管理
npm install zustand

# 图表库
npm install recharts

# 动画
npm install framer-motion

# 图标
npm install lucide-react
```

#### Rust依赖 (Cargo.toml)
```toml
[package]
name = "daily-report-assistant"
version = "0.1.0"
edition = "2021"

[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
sqlx = { version = "0.7", features = ["runtime-tokio", "sqlite"] }
reqwest = { version = "0.11", features = ["json"] }
base64 = "0.21"
zeroize = { version = "1", features = ["derive"] }
uuid = { version = "1", features = ["v4"] }
chrono = { version = "0.4", features = ["serde"] }
regex = "1"
thiserror = "1"
log = "0.4"
env_logger = "0.10"

# 图像处理
image = "0.24"

# OCR (可选)
tesseract = "0.12"

# 感知哈希
img_hash = "3"

[build-dependencies]
tauri-build = { version = "2", features = [] }
```

## 4. 核心代码实现

### 4.1 主入口 (src-tauri/src/main.rs)
```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use tokio::sync::broadcast;

mod screenshot;
mod ai;
mod storage;
mod privacy;
mod report;
mod security;

fn main() {
    env_logger::init();
    
    tauri::Builder::default()
        .setup(|app| {
            // 初始化数据库
            let app_dir = app.path().app_data_dir().expect("failed to get app dir");
            std::fs::create_dir_all(&app_dir).ok();
            
            let db_path = app_dir.join("activities.db");
            let rt = tokio::runtime::Runtime::new().unwrap();
            
            rt.block_on(async {
                storage::engine::StorageEngine::new(&db_path)
                    .await
                    .expect("failed to initialize database");
            });
            
            // 初始化AI模型管理器
            let (tx, _) = broadcast::channel(100);
            app.manage(tx);
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            screenshot::commands::capture_screen,
            ai::commands::analyze_screenshot,
            storage::commands::get_today_activities,
            report::commands::generate_daily_report,
            privacy::commands::get_privacy_settings,
            privacy::commands::update_privacy_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 4.2 截图捕获命令 (src-tauri/src/screenshot/commands.rs)
```rust
use tauri::command;
use crate::screenshot::manager::ScreenshotManager;
use crate::security::secure_buffer::SecureBuffer;

#[command]
pub async fn capture_screen() -> Result<ScreenshotInfo, String> {
    let manager = ScreenshotManager::new();
    
    // 捕获屏幕
    let mut screenshot = manager.capture_screen()
        .await
        .map_err(|e| e.to_string())?;
    
    // 获取截图信息
    let info = ScreenshotInfo {
        width: screenshot.width,
        height: screenshot.height,
        timestamp: screenshot.timestamp,
        hash: screenshot.content_hash.clone(),
    };
    
    // 立即销毁截图（如果不需要分析）
    // 注意：如果需要分析，应在分析完成后销毁
    
    Ok(info)
}

#[derive(serde::Serialize)]
pub struct ScreenshotInfo {
    pub width: u32,
    pub height: u32,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub hash: String,
}
```

### 4.3 AI分析命令 (src-tauri/src/ai/commands.rs)
```rust
use tauri::command;
use crate::ai::ollama::OllamaClient;
use crate::ai::scheduler::AIScheduler;
use crate::privacy::filter::SensitiveInfoFilter;

#[command]
pub async fn analyze_screenshot(screenshot_data: Vec<u8>) -> Result<AnalysisResult, String> {
    // 1. 创建敏感信息过滤器
    let filter = SensitiveInfoFilter::new()
        .map_err(|e| e.to_string())?;
    
    // 2. 过滤敏感信息
    let filtered_data = filter.filter(&screenshot_data)
        .await
        .map_err(|e| e.to_string())?;
    
    // 3. 调用AI模型分析
    let client = OllamaClient::new("http://localhost:11434");
    let prompt = OllamaClient::generate_analysis_prompt();
    
    let raw_result = client.analyze_screenshot(&filtered_data, &prompt)
        .await
        .map_err(|e| e.to_string())?;
    
    // 4. 解析结构化数据
    let result: AnalysisResult = serde_json::from_str(&raw_result)
        .map_err(|e| e.to_string())?;
    
    // 5. 截图数据在函数返回后自动被drop（内存释放）
    
    Ok(result)
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct AnalysisResult {
    pub app_name: String,
    pub activity_type: String,
    pub description: String,
    pub keywords: Vec<String>,
    pub importance_score: f64,
}
```

### 4.4 数据库命令 (src-tauri/src/storage/commands.rs)
```rust
use tauri::command;
use crate::storage::engine::StorageEngine;

#[command]
pub async fn get_today_activities() -> Result<Vec<ActivityRecord>, String> {
    let engine = StorageEngine::get_instance()
        .await
        .map_err(|e| e.to_string())?;
    
    let activities = engine.get_today_activities()
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(activities)
}

#[derive(serde::Serialize, sqlx::FromRow)]
pub struct ActivityRecord {
    pub id: i64,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub app_name: String,
    pub activity_type: String,
    pub description: String,
    pub keywords: Option<String>,
    pub importance_score: f64,
}
```

### 4.5 前端组件 (src/components/TodayWork.tsx)
```tsx
import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { HeatmapChart } from './HeatmapChart';
import { ActivityList } from './ActivityList';

interface Activity {
  id: number;
  timestamp: string;
  app_name: string;
  activity_type: string;
  description: string;
  keywords: string[];
  importance_score: number;
}

interface Statistics {
  totalActivities: number;
  focusDuration: number;
  mainActivity: string;
}

export const TodayWork: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [statistics, setStatistics] = useState<Statistics>({
    totalActivities: 0,
    focusDuration: 0,
    mainActivity: '无'
  });
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    loadTodayActivities();
  }, []);

  const loadTodayActivities = async () => {
    try {
      const result = await invoke<Activity[]>('get_today_activities');
      setActivities(result);
      
      // 计算统计信息
      const totalActivities = result.length;
      const focusDuration = calculateFocusDuration(result);
      const mainActivity = getMainActivity(result);
      
      setStatistics({ totalActivities, focusDuration, mainActivity });
    } catch (error) {
      console.error('加载活动记录失败:', error);
    }
  };

  const handleCapture = async () => {
    setIsCapturing(true);
    try {
      // 捕获屏幕
      const screenshotInfo = await invoke('capture_screen');
      
      // 分析截图
      const analysisResult = await invoke('analyze_screenshot', {
        screenshotData: [] // 实际数据应在捕获时获取
      });
      
      // 重新加载活动记录
      await loadTodayActivities();
    } catch (error) {
      console.error('截图分析失败:', error);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <header className="p-6 border-b">
        <h1 className="text-2xl font-bold">从今天起，汇报自动化</h1>
        <p className="text-gray-600 mt-2">
          截图、分析、生成、导出，全流程 AI 完成，让日报像呼吸一样自然。
        </p>
        <div className="flex gap-4 mt-4 text-sm text-gray-500">
          <span>✓ 截图分析后即刻销毁</span>
          <span>✓ 数据仅存本地，不上传云端</span>
          <span>✓ 你的工作内容只属于你</span>
        </div>
      </header>

      {/* 工作概览 */}
      <div className="grid grid-cols-3 gap-4 p-6">
        <div className="text-center">
          <div className="text-3xl font-bold">{statistics.totalActivities}</div>
          <div className="text-gray-500">记录条数</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold">{statistics.focusDuration}h</div>
          <div className="text-gray-500">专注时长</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold">{statistics.mainActivity}</div>
          <div className="text-gray-500">主要工作</div>
        </div>
      </div>

      {/* 热力图 */}
      <div className="p-6">
        <HeatmapChart activities={activities} />
      </div>

      {/* 活动列表 */}
      <div className="flex-1 overflow-auto p-6">
        <ActivityList activities={activities} />
      </div>

      {/* 截图按钮 */}
      <div className="p-6 border-t">
        <button
          onClick={handleCapture}
          disabled={isCapturing}
          className="w-full bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          {isCapturing ? '分析中...' : '立即截图分析'}
        </button>
      </div>
    </div>
  );
};

function calculateFocusDuration(activities: Activity[]): number {
  // 计算专注时长（简化版）
  return activities.length * 0.5; // 假设每个活动平均30分钟
}

function getMainActivity(activities: Activity[]): string {
  if (activities.length === 0) return '无';
  
  const typeCounts = activities.reduce((acc, activity) => {
    acc[activity.activity_type] = (acc[activity.activity_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const mainType = Object.entries(typeCounts)
    .sort(([,a], [,b]) => b - a)[0][0];
  
  const typeNames: Record<string, string> = {
    coding: '编程',
    design: '设计',
    communication: '沟通',
    reading: '阅读',
    writing: '写作',
    meeting: '会议',
    other: '其他'
  };
  
  return typeNames[mainType] || mainType;
}
```

## 5. 运行与测试

### 5.1 启动开发服务器
```bash
# 终端1：启动前端开发服务器
npm run dev

# 终端2：启动Tauri开发模式
npm run tauri dev
```

### 5.2 测试Ollama连接
```bash
# 确保Ollama正在运行
ollama serve

# 测试API连接
curl http://localhost:11434/api/tags

# 测试图像分析
curl http://localhost:11434/api/generate -d '{
  "model": "gemma4-e2b",
  "prompt": "描述这张图片",
  "images": ["base64编码的图片"]
}'
```

### 5.3 构建生产版本
```bash
# 构建所有平台
npm run tauri build

# 构建特定平台
npm run tauri build -- --target x86_64-pc-windows-msvc  # Windows
npm run tauri build -- --target x86_64-apple-darwin      # macOS
npm run tauri build -- --target x86_64-unknown-linux-gnu # Linux
```

## 6. 常见问题

### 6.1 Ollama连接失败
```bash
# 检查Ollama是否运行
ps aux | grep ollama

# 重启Ollama
pkill ollama
ollama serve

# 检查端口
netstat -tulpn | grep 11434
```

### 6.2 显存不足
```bash
# 使用更小的模型
ollama pull gemma4-e2b  # 仅需4GB显存

# 或者使用CPU模式（较慢）
OLLAMA_NUM_GPU=999 ollama run gemma4-e2b
```

### 6.3 截图权限问题
- **macOS**: 需要在系统偏好设置中授予屏幕录制权限
- **Windows**: 通常无需额外权限
- **Linux**: 需要X11或Wayland访问权限

## 7. 下一步

### 7.1 功能扩展
- [ ] 添加系统托盘图标
- [ ] 实现全局快捷键
- [ ] 添加自动截图功能
- [ ] 实现报告导出（PDF/Markdown）
- [ ] 添加多显示器支持

### 7.2 性能优化
- [ ] 实现增量截图（只截取变化区域）
- [ ] 优化AI模型推理速度
- [ ] 添加结果缓存机制
- [ ] 实现后台静默分析

### 7.3 用户体验
- [ ] 添加深色模式支持
- [ ] 实现多语言支持
- [ ] 添加自定义主题
- [ ] 实现数据导入/导出

## 8. 资源链接

- [Tauri官方文档](https://tauri.app/)
- [Ollama官方文档](https://ollama.com/)
- [Gemma 4模型](https://ollama.com/library/gemma4)
- [Qwen-VL模型](https://ollama.com/library/qwen-vl)
- [React文档](https://react.dev/)
- [Tailwind CSS文档](https://tailwindcss.com/)

---

*快速开始指南 v1.0*  
*最后更新: 2024-01-15*