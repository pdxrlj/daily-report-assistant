import React, { useEffect, useState, useCallback } from 'react';
import { Cat, Shield, HardDrive, Lock, Camera, Loader2 } from 'lucide-react';
import { HeatmapChart } from '../components/ui/HeatmapChart';
import { StatCard } from '../components/ui/StatCard';
import { DisplayInfoCard } from '../components/ui/DisplayInfoCard';
import { mockHeatmapData, mockStatistics, mockDisplays } from '../utils/mockData';
import { useSettingsStore } from '../stores/settingsStore';
import { checkProviderHealth } from '../services/aiProvider';
import { isTauri } from '../services/env';
import type { ProviderStatus } from '../types/ai';
import type { HeatmapData, DisplayInfo } from '../types';

interface RawActivity {
  id: number;
  timestamp: string;
  app_name: string;
  activity_type: string;
  description: string;
  keywords: string | null;
  importance_score: number;
  image_hash: string;
  provider: string;
  created_at: string;
}

interface RawHeatmapEntry {
  date: string;
  hour: number;
  activity_count: number;
  focus_duration_minutes: number;
}

interface RawMonitorInfo {
  id: number;
  name: string;
  width: number;
  height: number;
  scale_factor: number;
  is_primary: boolean;
  x: number;
  y: number;
}

const ACTIVITY_LABELS: Record<string, string> = {
  coding: '编程', design: '设计', communication: '沟通',
  reading: '阅读', data_analysis: '数据分析', writing: '写作',
  meeting: '会议', other: '其他',
};

const DAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function activitiesToHeatmap(entries: RawHeatmapEntry[]): HeatmapData[] {
  const grouped = new Map<string, { records: number; minutes: number; hourly: number[] }>();
  for (const e of entries) {
    if (!grouped.has(e.date)) {
      grouped.set(e.date, { records: 0, minutes: 0, hourly: Array(24).fill(0) });
    }
    const g = grouped.get(e.date)!;
    g.records += e.activity_count;
    g.minutes += e.focus_duration_minutes;
    g.hourly[e.hour] = e.activity_count;
  }
  const today = new Date();
  return Array.from(grouped.entries()).map(([date, g]) => {
    const d = new Date(date + 'T00:00:00');
    const diffDays = Math.round((today.getTime() - d.getTime()) / 86400000);
    const dayLabel = diffDays === 0 ? '今天' : diffDays === 1 ? '昨天' : diffDays === 2 ? '前天' : DAY_LABELS[d.getDay()];
    return {
      date,
      dayLabel,
      totalRecords: g.records,
      totalHours: Math.round((g.minutes / 60) * 10) / 10,
      hourlyData: g.hourly,
    };
  });
}

function activitiesToStats(activities: RawActivity[]) {
  const typeCount = new Map<string, number>();
  for (const a of activities) {
    typeCount.set(a.activity_type, (typeCount.get(a.activity_type) || 0) + 1);
  }
  let mainType = 'other';
  let maxCount = 0;
  for (const [t, c] of typeCount) {
    if (c > maxCount) { maxCount = c; mainType = t; }
  }
  return {
    total: activities.length,
    hours: Math.round(activities.length * 0.7 * 10) / 10,
    mainActivity: ACTIVITY_LABELS[mainType] || mainType,
  };
}

function monitorsToDisplays(monitors: RawMonitorInfo[]): DisplayInfo[] {
  return monitors.map((m) => ({
    id: m.id,
    name: m.name,
    width: m.width,
    height: m.height,
    scaleFactor: m.scale_factor,
    isPrimary: m.is_primary,
    coordinate: { x: m.x, y: m.y },
  }));
}

export const TodayWorkPage: React.FC = () => {
  const { getEffectiveConfig, getVisionConfig, aiProvider, detectedProviders, runDetection, autoCapture, setAutoCapture } = useSettingsStore();
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [heatmapData, setHeatmapData] = useState<HeatmapData[]>([]);
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [stats, setStats] = useState({ total: 0, hours: 0, mainActivity: '-' });
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  useEffect(() => {
    runDetection();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const today = new Date().toISOString().split('T')[0];

      const [activities, heatmapRaw, monitors] = await Promise.all([
        invoke<RawActivity[]>('get_today_activities'),
        invoke<RawHeatmapEntry[]>('get_heatmap_data', { date: today }),
        invoke<RawMonitorInfo[]>('get_monitors'),
      ]);

      setStats(activitiesToStats(activities));
      setHeatmapData(activitiesToHeatmap(heatmapRaw));
      setDisplays(monitorsToDisplays(monitors));
    } catch {
      setStats({ total: mockStatistics.totalActivities, hours: mockStatistics.focusDuration, mainActivity: mockStatistics.mainActivity });
      setHeatmapData(mockHeatmapData);
      setDisplays(mockDisplays);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 立即截取当前屏幕并分析，完成后刷新今日数据
  const handleQuickCapture = useCallback(async () => {
    setCapturing(true);
    setCaptureError(null);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const cfg = getVisionConfig();
      await invoke('capture_and_analyze', {
        model: cfg.defaultModel || null,
        providerType: cfg.type,
        baseUrl: cfg.baseUrl || null,
        apiKey: cfg.apiKey ?? null,
      });
      await loadData();
    } catch (err: any) {
      setCaptureError(typeof err === 'string' ? err : (err?.message || '截屏分析失败'));
    } finally {
      setCapturing(false);
    }
  }, [loadData]);

  useEffect(() => {
    const check = async () => {
      setChecking(true);
      try {
        const config = getEffectiveConfig();
        const status = await checkProviderHealth(config);
        setProviderStatus(status);
      } catch {
        setProviderStatus(null);
      } finally {
        setChecking(false);
      }
    };
    check();
  }, [aiProvider]);

  const visionCfg = getVisionConfig();
  const visionProviderName =
    visionCfg.type === 'ollama' ? 'Ollama'
    : visionCfg.type === 'lmstudio' ? 'LM Studio'
    : visionCfg.type === 'openai' ? 'OpenAI'
    : '未设置';

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto px-8 py-6">
        <div className="flex items-start gap-4 mb-8">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
            <Cat className="w-10 h-10 text-gray-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              从今天起，汇报自动化
            </h1>
            <p className="text-gray-600">
              截图、分析、生成、导出，全流程 AI 完成，让日报像呼吸一样自然。
            </p>
          </div>
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
            providerStatus?.available
              ? 'bg-green-50 text-green-700'
              : checking ? 'bg-gray-50 text-gray-500'
              : 'bg-yellow-50 text-yellow-700'
          }`}>
            {checking ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : providerStatus?.available ? (
              <Shield className="w-4 h-4" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">
              {checking ? '检测中...' : providerStatus?.available ? `${visionProviderName} 已连接` : 'AI 未就绪'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Shield className="w-4 h-4 text-gray-400" />
            <span>截图分析后即刻销毁</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <HardDrive className="w-4 h-4 text-gray-400" />
            <span>数据仅存本地，不上传云端</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Lock className="w-4 h-4 text-gray-400" />
            <span>你的工作内容只属于你</span>
          </div>
          {detectedProviders.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <Cat className="w-4 h-4" />
              <span>
                已检测到本地服务:
                {detectedProviders.map((t) => (t === 'ollama' ? ' Ollama' : ' LM Studio')).join(',')}
              </span>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
            <h2 className="text-lg font-semibold text-gray-900">工作概览</h2>
            {isTauri() && (
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoCapture}
                    onChange={(e) => setAutoCapture(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                  />
                  自动截屏
                </label>
                <button
                  onClick={handleQuickCapture}
                  disabled={capturing || loading || !providerStatus?.available}
                  title={!providerStatus?.available ? 'AI 服务未就绪，请先在设置中启动 Ollama / LM Studio' : '截取当前屏幕并分析'}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50 transition-colors"
                >
                  {capturing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  {capturing ? '分析中...' : '立即截图分析'}
                </button>
              </div>
            )}
          </div>
          {captureError && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-2">{captureError}</p>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              <p className="text-gray-600 mb-6">
                共记录 {stats.total} 段活动，累计专注约 {stats.hours} 小时。
              </p>
              <div className="grid grid-cols-3 gap-8">
                <StatCard label="记录条数" value={stats.total} />
                <StatCard label="专注时长" value={stats.hours} unit="h" />
                <StatCard label="主要工作" value={stats.mainActivity} />
              </div>
            </>
          )}
        </div>

        {heatmapData.length > 0 && (
          <div className="mb-6">
            <HeatmapChart data={heatmapData} />
          </div>
        )}

        <DisplayInfoCard displays={displays} />
      </div>
    </div>
  );
};
