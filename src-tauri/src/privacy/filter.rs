use regex::Regex;

#[derive(Debug, Clone)]
pub struct SensitiveRegion {
    pub text: String,
    pub severity: Severity,
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub enum Severity {
    Low,
    Medium,
    High,
    Critical,
}

pub struct SensitiveInfoFilter {
    patterns: Vec<SensitivePattern>,
}

struct SensitivePattern {
    regex: Regex,
    severity: Severity,
}

impl SensitiveInfoFilter {
    pub fn new() -> Self {
        let patterns = vec![
            SensitivePattern {
                regex: Regex::new(r"\b(?:\d[ -]*?){13,16}\b").unwrap(),
                severity: Severity::Critical,
            },
            SensitivePattern {
                regex: Regex::new(r"(?i)password|密码|passwd|pwd|secret").unwrap(),
                severity: Severity::High,
            },
            SensitivePattern {
                regex: Regex::new(r"\b\d{17}[\dXx]\b").unwrap(),
                severity: Severity::Critical,
            },
            SensitivePattern {
                regex: Regex::new(r"\b1[3-9]\d{9}\b").unwrap(),
                severity: Severity::Medium,
            },
            SensitivePattern {
                regex: Regex::new(r"(?i)api[_-]?key|token|sk-[a-zA-Z0-9]+").unwrap(),
                severity: Severity::High,
            },
            SensitivePattern {
                regex: Regex::new(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b").unwrap(),
                severity: Severity::Low,
            },
        ];

        Self { patterns }
    }

    pub fn detect(&self, text: &str) -> Vec<SensitiveRegion> {
        let mut regions = Vec::new();

        for pattern in &self.patterns {
            for mat in pattern.regex.find_iter(text) {
                regions.push(SensitiveRegion {
                    text: mat.as_str().to_string(),
                    severity: pattern.severity.clone(),
                });
            }
        }

        regions.sort_by(|a, b| b.severity.cmp(&a.severity));
        regions
    }

    pub fn filter_text(&self, text: &str) -> String {
        let mut result = text.to_string();
        let regions = self.detect(text);

        for region in &regions {
            let replacement = match region.severity {
                Severity::Critical => "[已过滤-敏感信息]",
                Severity::High => "[已过滤]",
                Severity::Medium => "[已过滤]",
                Severity::Low => "[邮箱]",
            };
            result = result.replace(&region.text, replacement);
        }

        result
    }
}
