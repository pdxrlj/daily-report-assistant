use chrono::Timelike;
use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};
use std::path::Path;
use crate::errors::AppError;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct ActivityRecord {
    pub id: i64,
    pub timestamp: String,
    pub app_name: String,
    pub activity_type: String,
    pub description: String,
    pub keywords: Option<String>,
    pub importance_score: f64,
    pub image_hash: String,
    pub provider: String,
    pub created_at: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct HeatmapEntry {
    pub date: String,
    pub hour: i32,
    pub activity_count: i32,
    pub focus_duration_minutes: i32,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct AppUsageStat {
    pub app_name: String,
    pub date: String,
    pub usage_minutes: i32,
    pub activity_count: i32,
}

pub struct StorageEngine {
    pool: SqlitePool,
}

impl StorageEngine {
    pub async fn new(db_path: &Path) -> Result<Self, AppError> {
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect(&format!("sqlite:{}?mode=rwc", db_path.display()))
            .await?;

        let engine = Self { pool };
        engine.run_migrations().await?;
        Ok(engine)
    }

    async fn run_migrations(&self) -> Result<(), AppError> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS activities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                app_name TEXT NOT NULL,
                activity_type TEXT NOT NULL,
                description TEXT NOT NULL,
                keywords TEXT,
                importance_score REAL DEFAULT 0.5,
                image_hash TEXT DEFAULT '',
                provider TEXT DEFAULT 'ollama',
                created_at TEXT DEFAULT (datetime('now'))
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS heatmap_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                hour INTEGER NOT NULL,
                activity_count INTEGER DEFAULT 0,
                focus_duration_minutes INTEGER DEFAULT 0,
                UNIQUE(date, hour)
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS user_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT DEFAULT (datetime('now'))
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS app_usage_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                app_name TEXT NOT NULL,
                date TEXT NOT NULL,
                usage_minutes INTEGER DEFAULT 0,
                activity_count INTEGER DEFAULT 0,
                UNIQUE(app_name, date)
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp)")
            .execute(&self.pool)
            .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(date(timestamp))")
            .execute(&self.pool)
            .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_heatmap_date ON heatmap_data(date)")
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    pub async fn save_activity(&self, activity: &ActivityRecord) -> Result<i64, AppError> {
        let result = sqlx::query(
            r#"
            INSERT INTO activities (timestamp, app_name, activity_type, description, keywords, importance_score, image_hash, provider)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&activity.timestamp)
        .bind(&activity.app_name)
        .bind(&activity.activity_type)
        .bind(&activity.description)
        .bind(&activity.keywords)
        .bind(activity.importance_score)
        .bind(&activity.image_hash)
        .bind(&activity.provider)
        .execute(&self.pool)
        .await?;

        // 同步更新热力图与应用使用统计预计算表，保证主页/热力图页有真实数据
        if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(&activity.timestamp) {
            let date = dt.format("%Y-%m-%d").to_string();
            let hour = dt.hour() as i32;
            let _ = self.update_heatmap(&date, hour, 1).await;
            let _ = self.update_app_usage(&activity.app_name, &date, 0).await;
        }

        Ok(result.last_insert_rowid())
    }

    pub async fn get_today_activities(&self) -> Result<Vec<ActivityRecord>, AppError> {
        let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
        let records = sqlx::query_as::<_, ActivityRecord>(
            r#"
            SELECT * FROM activities
            WHERE date(timestamp) = ?
            ORDER BY timestamp ASC
            "#,
        )
        .bind(&today)
        .fetch_all(&self.pool)
        .await?;

        Ok(records)
    }

    pub async fn get_activities_by_date(&self, date: &str) -> Result<Vec<ActivityRecord>, AppError> {
        let records = sqlx::query_as::<_, ActivityRecord>(
            r#"
            SELECT * FROM activities
            WHERE date(timestamp) = ?
            ORDER BY timestamp ASC
            "#,
        )
        .bind(date)
        .fetch_all(&self.pool)
        .await?;

        Ok(records)
    }

    pub async fn get_activities_range(
        &self,
        start_date: &str,
        end_date: &str,
    ) -> Result<Vec<ActivityRecord>, AppError> {
        let records = sqlx::query_as::<_, ActivityRecord>(
            r#"
            SELECT * FROM activities
            WHERE date(timestamp) >= ? AND date(timestamp) <= ?
            ORDER BY timestamp ASC
            "#,
        )
        .bind(start_date)
        .bind(end_date)
        .fetch_all(&self.pool)
        .await?;

        Ok(records)
    }

    pub async fn update_heatmap(
        &self,
        date: &str,
        hour: i32,
        activity_count: i32,
    ) -> Result<(), AppError> {
        sqlx::query(
            r#"
            INSERT INTO heatmap_data (date, hour, activity_count)
            VALUES (?, ?, ?)
            ON CONFLICT(date, hour) DO UPDATE SET
                activity_count = activity_count + ?
            "#,
        )
        .bind(date)
        .bind(hour)
        .bind(activity_count)
        .bind(activity_count)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_heatmap_data(&self, date: &str) -> Result<Vec<HeatmapEntry>, AppError> {
        let entries = sqlx::query_as::<_, HeatmapEntry>(
            r#"
            SELECT date, hour, activity_count, focus_duration_minutes
            FROM heatmap_data
            WHERE date = ?
            ORDER BY hour ASC
            "#,
        )
        .bind(date)
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::from)?;

        Ok(entries)
    }

    pub async fn get_heatmap_range(&self, start_date: &str, end_date: &str) -> Result<Vec<HeatmapEntry>, AppError> {
        let entries = sqlx::query_as::<_, HeatmapEntry>(
            r#"
            SELECT date, hour, activity_count, focus_duration_minutes
            FROM heatmap_data
            WHERE date >= ? AND date <= ?
            ORDER BY date ASC, hour ASC
            "#,
        )
        .bind(start_date)
        .bind(end_date)
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::from)?;

        Ok(entries)
    }

    pub async fn get_setting(&self, key: &str) -> Result<Option<String>, AppError> {
        let row: Option<(String,)> = sqlx::query_as(
            r#"SELECT value FROM user_settings WHERE key = ?"#,
        )
        .bind(key)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|r| r.0))
    }

    pub async fn set_setting(&self, key: &str, value: &str) -> Result<(), AppError> {
        sqlx::query(
            r#"
            INSERT INTO user_settings (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')
            "#,
        )
        .bind(key)
        .bind(value)
        .bind(value)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn update_app_usage(
        &self,
        app_name: &str,
        date: &str,
        usage_minutes: i32,
    ) -> Result<(), AppError> {
        sqlx::query(
            r#"
            INSERT INTO app_usage_stats (app_name, date, usage_minutes, activity_count)
            VALUES (?, ?, ?, 1)
            ON CONFLICT(app_name, date) DO UPDATE SET
                usage_minutes = usage_minutes + ?,
                activity_count = activity_count + 1
            "#,
        )
        .bind(app_name)
        .bind(date)
        .bind(usage_minutes)
        .bind(usage_minutes)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_app_usage(&self, date: &str) -> Result<Vec<AppUsageStat>, AppError> {
        let stats = sqlx::query_as::<_, AppUsageStat>(
            r#"
            SELECT app_name, date, usage_minutes, activity_count
            FROM app_usage_stats
            WHERE date = ?
            ORDER BY usage_minutes DESC
            "#,
        )
        .bind(date)
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::from)?;

        Ok(stats)
    }
}
