# 项目长期记忆：daily-report-assistant（小黑日报助手）

## 项目概览
- **类型**：Tauri 2.x (Rust) + React 19 + TypeScript 桌面应用。
- **用途**：隐私优先的日报自动生成——本地截图 → 本地视觉模型（Ollama / LM Studio / OpenAI 兼容）→ 结构化活动记录 → SQLite → 日报/热力图/应用统计。
- **核心设计原则**：截图分析后立即销毁（SecureBuffer + zeroize），数据仅存本地不上云。

## 技术要点
- 后端入口 `src-tauri/src/lib.rs`（`run()`）；命令集中在各模块的 `commands.rs`，统一在 lib.rs `invoke_handler` 注册。
- AI 抽象：`ai::provider::AIProvider` trait，Ollama/LMStudio 实现；`AIScheduler` 持有当前 provider 与 `SensitiveInfoFilter`。
- 前端服务层 `frontend/src/services/*` 通过 `@tauri-apps/api/core` 的 `invoke` 调用后端；Tauri v2 自动将 camelCase 参数转为 snake_case（前端用 camelCase、后端用 snake_case，已验证一致）。
- 自动截屏：`hooks/useAutoCapture.ts` 调用后端 `capture_and_analyze`。

## 构建/验证命令
- 前端：`cd frontend && npm run build`（= `tsc -b && vite build`）。
- 后端：`cd src-tauri && cargo check` / `cargo build`。
- 本地启动：`npm run tauri dev`（需 Rust 工具链 + 系统 WebView）。

## 后端命令清单（lib.rs invoke_handler 注册）
截图：`capture_screen`、`get_monitors`、`capture_all_screens`
AI：`analyze_screenshot`、`save_analysis_result`、`capture_and_analyze`、`check_ai_status`、`update_ai_provider`、`agent_chat`
存储：`get_today_activities`、`get_activities_by_date`、`get_activities_range`、`get_heatmap_data`、`get_heatmap_range`、`get_app_usage`、`get_setting`、`set_setting`
报告：`generate_daily_report`、`generate_report_range`、`export_text_file`

## 关键数据流
- `save_activity` 保存活动时同步写 `heatmap_data` + `app_usage_stats` 预计算表（date+hour 来自 timestamp）。
- `capture_and_analyze` = 截图 + AI 分析（含隐私文本擦除）+ 入库，一步完成；前端主页/截图分析页均调它。
- `agent_chat` 命令注入今日活动上下文 → `AIScheduler::agent_chat` → provider.chat（Ollama /api/generate 或 LMStudio /v1/chat/completions）。
- `export_text_file` 用 tauri_plugin_dialog 弹保存框 + 写文件（capabilities 已含 dialog:default）。

## 约定与陷阱
- 后端 `analyze_screenshot` 命令返回结构化字段（app_name/activity_type/...），前端 `analyzeImage` 需将其重组为 `content` JSON 字符串再交给 `parseAnalysisResult`。
- 隐私过滤目前只做文本正则擦除；像素级 OCR 脱敏未实现（Cargo.toml 无 tesseract）。
