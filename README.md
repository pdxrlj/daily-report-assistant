# 日报助手 (Daily Report Assistant)

隐私优先的桌面应用：通过本地 AI 分析屏幕截图，自动生成工作日报。截图在分析完成后立即销毁，仅保留文字描述，数据不出本地。

- 前端：`React 19 + Vite + TypeScript + Tailwind CSS`（位于 `frontend/`）
- 后端：`Rust + Tauri 2`（位于 `src-tauri/`）
- 本地 AI：支持 Ollama / LM Studio 的视觉模型与对话模型

---

## 功能特性

- **截图分析**：截取屏幕，调用本地视觉模型识别应用、活动类型、工作内容
- **日报生成**：基于当日工作记录生成统计图表与「今天干了什么」明细
- **AI 报告摘要**：使用对话模型把当日工作汇总成一段自然语言报告
- **模型可配置**：分别设置「截图分析模型」（视觉）与「对话模型」（文本推理）
- **报告导出**：支持导出 Markdown 与打印为 PDF
- **隐私优先**：截图即销毁，数据仅存本地

---

## 环境准备

### 系统依赖

| 平台 | 要求 |
|------|------|
| Windows | Rust 工具链 + VS Build Tools + Node.js 18+ |
| macOS | Rust 工具链 + Xcode Command Line Tools + Node.js 18+ |
| Linux | `libwebkit2gtk-4.0-dev`、`libgtk-3-dev`、`libssl-dev` 等 + Node.js 18+ |

### 安装 Rust 与 Node.js

```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh   # macOS / Linux
winget install Rustlang.Rustup                                       # Windows

# Node.js（建议使用 nvm 或官方 LTS）
```

### 准备本地 AI（任选其一）

**Ollama**

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen2.5vl:7b     # 视觉模型，中文能力强
ollama pull qwen2.5:7b       # 对话模型（可选）
```

**LM Studio**

- 安装后启动本地服务（默认 `http://localhost:1234`）
- 在应用中加载一个视觉模型与一个对话模型

---

## 安装依赖

依赖安装与 Tauri 命令均在 `frontend/` 目录执行：

```bash
cd frontend
npm install
```

---

## 运行开发模式

```bash
cd frontend
npm run tauri dev
```

该命令会先启动 Vite 前端（`http://localhost:1420`），再启动 Tauri 桌面窗口。

> 仅调试前端 UI（不启动 Rust 后端）可用：`cd frontend && npm run dev`，此时报告页会以「演示模式」回退到示例数据。

---

## 编译 / 构建

```bash
cd frontend
npm run tauri build
```

产物在 `src-tauri/target/release/bundle/`（Windows 为 `.msi` / `.exe`，macOS 为 `.app` / `.dmg`，Linux 为 `.deb` / `AppImage`）。

其它脚本：

```bash
cd frontend
npm run dev        # 启动前端开发服务器
npm run build      # 仅构建前端 (tsc + vite build)
npm run lint       # oxlint 代码检查
npm run preview    # 预览前端构建产物
npm run tauri      # 直接调用 Tauri CLI
```

---

## 使用说明

1. **配置 AI 提供方**
   打开「设置」页：
   - 选择提供商（Ollama / LM Studio / OpenAI 兼容）
   - 填写服务地址（如 `http://localhost:11434`），点击「刷新列表」拉取可用模型
   - 分别设置 **截图分析模型**（建议视觉/VL 模型）与 **对话模型**（文本推理模型）
   - 也可手动输入模型名；不填则回退到提供商默认模型

2. **截图分析**
   打开「截图分析」页，点击截图按钮（或系统托盘触发的自动截图），应用会截取屏幕、调用视觉模型，并将结构化结果存入本地数据库。

3. **生成报告**
   打开「生成报告」页：
   - 选择日期，点击「生成日报」得到统计卡片、活动明细、类型/应用分布、时段分析
   - 「AI 报告摘要」会自动用**对话模型**生成一段话报告（卡片上有 tag 显示所用模型名，可「重新生成」）
   - 可「导出 Markdown」或「打印为 PDF」

4. **AI 对话助手**
   打开「助手」页，与本地对话模型问答（已注入当日工作上下文）。

---

## 项目结构

```
daily-report-assistant/
├── frontend/                     # React + Vite 前端
│   ├── src/
│   │   ├── pages/                # 页面：报告/分析/设置/助手
│   │   ├── stores/               # Zustand 状态（含设置 store）
│   │   ├── services/             # AI provider 封装
│   │   └── utils/                # 工具与示例数据
│   └── package.json
├── src-tauri/                    # Rust 后端
│   ├── src/
│   │   ├── ai/                   # AI provider / scheduler / ollama / lmstudio
│   │   ├── screenshot/           # 截图与内容哈希
│   │   ├── storage/              # 本地数据库
│   │   ├── report/               # 报告生成
│   │   └── security/             # 安全缓冲区
│   ├── Cargo.toml
│   └── tauri.conf.json
├── .gitignore
└── README.md
```

---

## 常见问题

**AI 服务连接失败**
确认 Ollama / LM Studio 正在运行，且「设置」中的服务地址与端口正确；可点击「检测」验证连接。

**显存不足**
换用更小的视觉模型（如 `qwen2.5vl:3b`），或在 LM Studio 中限制显存占用。

**截图无内容 / 权限问题**
- macOS：需在「系统设置 → 隐私与安全性」授予「屏幕录制」权限
- Windows / Linux：通常无需额外权限，确保应用在前台运行

**报告页显示「演示模式」**
表示前端未连接到 Tauri 后端（例如只用 `npm run dev`）。用 `npm run tauri dev` 启动即可连接真实数据。

---

## 相关文档

- `quickstart.md`：更详细的环境搭建与最小实现参考
- `architecture.md`：系统架构说明
- `screenshot-analysis-flow.md`：截图分析流程

---

*基于 Tauri 2 + React 19 构建，数据全部本地处理。*
