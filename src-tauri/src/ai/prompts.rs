pub fn generate_analysis_prompt() -> String {
    r#"你是一个专业的工作内容分析助手。请仔细分析这张截图，提取以下信息并以JSON格式返回：

{
    "app_name": "应用程序名称",
    "activity_type": "编码类型: coding / design / communication / reading / data_analysis / writing / meeting / other",
    "description": "工作内容描述（50-100字中文）",
    "keywords": ["关键词1", "关键词2", "关键词3"],
    "importance_score": 0.0-1.0 之间的重要性评分
}

要求：
- app_name 是完整的应用程序名称，如 "Visual Studio Code"
- activity_type 从以下选择: coding, design, communication, reading, data_analysis, writing, meeting, other
- description 用简洁的中文描述正在进行的工作
- keywords 提取3-5个最相关的关键词
- importance_score 基于工作复杂度

只返回JSON，不要包含其他文字。"#.to_string()
}
