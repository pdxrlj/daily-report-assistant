use std::collections::HashMap;
use chrono::{DateTime, Timelike};
use crate::errors::AppError;
use crate::storage::engine::{ActivityRecord, StorageEngine};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DailyReport {
    pub date: String,
    pub total_activities: usize,
    pub focus_duration_hours: f64,
    pub main_activities: Vec<ActivitySummary>,
    pub heatmap: Vec<HourlyHeatmap>,
    pub app_breakdown: Vec<AppBreakdown>,
    pub time_segments: Vec<TimeSegment>,
    pub activities: Vec<ActivityItem>,
    pub generated_at: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ActivityItem {
    pub time: String,
    pub app_name: String,
    pub activity_type: String,
    pub description: String,
    pub keywords: Vec<String>,
    pub importance_score: f64,
}

fn parse_keywords(raw: &Option<String>) -> Vec<String> {
    match raw {
        Some(s) if !s.is_empty() => serde_json::from_str::<Vec<String>>(s).unwrap_or_default(),
        _ => vec![],
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ActivitySummary {
    pub activity_type: String,
    pub count: usize,
    pub percentage: f64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct HourlyHeatmap {
    pub hour: i32,
    pub count: usize,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AppBreakdown {
    pub app_name: String,
    pub count: usize,
    pub percentage: f64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TimeSegment {
    pub label: String,
    pub start_hour: i32,
    pub end_hour: i32,
    pub activity_count: usize,
    pub description: String,
}

pub struct ReportGenerator {
    storage: std::sync::Arc<StorageEngine>,
}

impl ReportGenerator {
    pub fn new(storage: std::sync::Arc<StorageEngine>) -> Self {
        Self { storage }
    }

    pub async fn generate_daily_report(&self, date: &str) -> Result<DailyReport, AppError> {
        let activities = self.storage.get_activities_by_date(date).await?;
        Ok(self.build_report(activities, date.to_string()))
    }

    /// 按精确时间范围（开始时间~结束时间）生成聚合报告。
    /// `start_time` / `end_time` 需为 RFC3339 字符串（UTC）。
    pub async fn generate_report_timerange(
        &self,
        start_time: &str,
        end_time: &str,
    ) -> Result<DailyReport, AppError> {
        let activities = self
            .storage
            .get_activities_by_time_range(start_time, end_time)
            .await?;

        let fmt_local = |s: &str| -> String {
            chrono::DateTime::parse_from_rfc3339(s)
                .map(|t| t.with_timezone(&chrono::Local).format("%Y-%m-%d %H:%M").to_string())
                .unwrap_or_else(|_| s.to_string())
        };
        let label = format!("{} ~ {}", fmt_local(start_time), fmt_local(end_time));

        Ok(self.build_report(activities, label))
    }

    fn build_report(&self, activities: Vec<ActivityRecord>, date_label: String) -> DailyReport {
        let total = activities.len();

        let activities_detail: Vec<ActivityItem> = activities
            .iter()
            .map(|a| {
                let time = DateTime::parse_from_rfc3339(&a.timestamp)
                    .map(|t| t.with_timezone(&chrono::Local).format("%H:%M").to_string())
                    .unwrap_or_else(|_| a.timestamp.clone());
                ActivityItem {
                    time,
                    app_name: a.app_name.clone(),
                    activity_type: a.activity_type.clone(),
                    description: a.description.clone(),
                    keywords: parse_keywords(&a.keywords),
                    importance_score: a.importance_score,
                }
            })
            .collect();

        if total == 0 {
            return DailyReport {
                date: date_label,
                total_activities: 0,
                focus_duration_hours: 0.0,
                main_activities: vec![],
                heatmap: vec![],
                app_breakdown: vec![],
                time_segments: vec![],
                activities: vec![],
                generated_at: chrono::Utc::now().to_rfc3339(),
            };
        }

        let heatmap = self.calculate_heatmap(&activities);
        let app_breakdown = self.calculate_app_breakdown(&activities);
        let activity_summary = self.summarize_activities(&activities);
        let focus_hours = self.calculate_focus_duration(&activities);
        let time_segments = self.analyze_time_segments(&activities);

        DailyReport {
            date: date_label,
            total_activities: total,
            focus_duration_hours: focus_hours,
            main_activities: activity_summary,
            heatmap,
            app_breakdown,
            time_segments,
            activities: activities_detail,
            generated_at: chrono::Utc::now().to_rfc3339(),
        }
    }

    fn calculate_heatmap(&self, activities: &[ActivityRecord]) -> Vec<HourlyHeatmap> {
        let mut hourly = HashMap::new();
        for activity in activities {
            if let Ok(ts) = chrono::DateTime::parse_from_rfc3339(&activity.timestamp) {
                let hour = ts.with_timezone(&chrono::Local).hour() as i32;
                *hourly.entry(hour).or_insert(0) += 1;
            }
        }

        (0..24)
            .map(|h| HourlyHeatmap {
                hour: h,
                count: hourly.get(&h).copied().unwrap_or(0),
            })
            .collect()
    }

    fn calculate_app_breakdown(&self, activities: &[ActivityRecord]) -> Vec<AppBreakdown> {
        let mut app_counts: HashMap<String, usize> = HashMap::new();
        for activity in activities {
            let key = if activity.app_name.is_empty() { "未知" } else { &activity.app_name };
            *app_counts.entry(key.to_string()).or_insert(0) += 1;
        }

        let total = activities.len() as f64;
        let mut breakdown: Vec<AppBreakdown> = app_counts
            .into_iter()
            .map(|(app_name, count)| AppBreakdown {
                app_name,
                count,
                percentage: count as f64 / total * 100.0,
            })
            .collect();

        breakdown.sort_by(|a, b| b.count.cmp(&a.count));
        breakdown
    }

    fn summarize_activities(&self, activities: &[ActivityRecord]) -> Vec<ActivitySummary> {
        let mut type_counts: HashMap<String, usize> = HashMap::new();
        for activity in activities {
            let t = if activity.activity_type.is_empty() { "other" } else { &activity.activity_type };
            *type_counts.entry(t.to_string()).or_insert(0) += 1;
        }

        let total = activities.len() as f64;
        let mut summary: Vec<ActivitySummary> = type_counts
            .into_iter()
            .map(|(activity_type, count)| ActivitySummary {
                activity_type,
                count,
                percentage: count as f64 / total * 100.0,
            })
            .collect();

        summary.sort_by(|a, b| b.count.cmp(&a.count));
        summary
    }

    fn calculate_focus_duration(&self, activities: &[ActivityRecord]) -> f64 {
        if activities.len() < 2 {
            return activities.len() as f64 * 0.25;
        }

        let mut total_minutes = 0.0;
        let max_gap_minutes = 15.0;

        for i in 1..activities.len() {
            let prev = &activities[i - 1];
            let curr = &activities[i];

            if let (Ok(t1), Ok(t2)) = (
                chrono::DateTime::parse_from_rfc3339(&prev.timestamp),
                chrono::DateTime::parse_from_rfc3339(&curr.timestamp),
            ) {
                let gap = (t2 - t1).num_seconds() as f64 / 60.0;
                if gap <= max_gap_minutes {
                    total_minutes += gap.min(60.0);
                }
            }
        }

        (total_minutes / 60.0 * 10.0).round() / 10.0
    }

    fn analyze_time_segments(&self, activities: &[ActivityRecord]) -> Vec<TimeSegment> {
        if activities.is_empty() {
            return vec![];
        }

        let segments = vec![
            ("上午".to_string(), 6, 12, "上午工作时段"),
            ("下午".to_string(), 12, 18, "下午工作时段"),
            ("晚上".to_string(), 18, 24, "晚间工作时段"),
        ];

        segments
            .into_iter()
            .map(|(label, start, end, desc)| {
                let count = activities
                    .iter()
                    .filter(|a| {
                        chrono::DateTime::parse_from_rfc3339(&a.timestamp)
                            .map(|t| {
                                let h = t.with_timezone(&chrono::Local).hour() as i32;
                                h >= start && h < end
                            })
                            .unwrap_or(false)
                    })
                    .count();
                TimeSegment {
                    label,
                    start_hour: start,
                    end_hour: end,
                    activity_count: count,
                    description: desc.to_string(),
                }
            })
            .collect()
    }
}
