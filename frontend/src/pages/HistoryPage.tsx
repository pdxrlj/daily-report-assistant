import React, { useState, useEffect, useCallback } from 'react';
import { History, Calendar, ChevronRight, FileText, Download, Clock, BarChart3, Loader2 } from 'lucide-react';

interface ReportSummary {
  date: string;
  totalActivities: number;
  focusHours: number;
  mainActivity: string;
  appCount: number;
}

interface DailyReport {
  date: string;
  total_activities: number;
  focus_duration_hours: number;
  main_activities: { activity_type: string; count: number; percentage: number }[];
  app_breakdown: { app_name: string; count: number; percentage: number }[];
  time_segments: { label: string; activity_count: number; description: string }[];
  heatmap: { hour: number; count: number }[];
  generated_at: string;
}

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  coding: '编程', design: '设计', communication: '沟通',
  reading: '阅读', data_analysis: '数据分析', writing: '写作',
  meeting: '会议', other: '其他',
};

function toSummary(r: DailyReport): ReportSummary {
  const mainType = r.main_activities[0]?.activity_type || 'other';
  return {
    date: r.date,
    totalActivities: r.total_activities,
    focusHours: r.focus_duration_hours,
    mainActivity: ACTIVITY_TYPE_LABELS[mainType] || mainType,
    appCount: r.app_breakdown.length,
  };
}

export const HistoryPage: React.FC = () => {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [showMock, setShowMock] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [detail, setDetail] = useState<DailyReport | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setShowMock(false);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const end = new Date();
      const start = new Date(Date.now() - 29 * 86400000);
      const fmt = (d: Date) => d.toISOString().split('T')[0];
      const range = await invoke<DailyReport[]>('generate_report_range', {
        startDate: fmt(start),
        endDate: fmt(end),
      });
      const summaries = range
        .filter((r) => r.total_activities > 0)
        .map(toSummary)
        .sort((a, b) => (a.date < b.date ? 1 : -1));
      setReports(summaries);
    } catch {
      setShowMock(true);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const openReport = useCallback(async (date: string) => {
    if (selectedDate === date) {
      setSelectedDate(null);
      setDetail(null);
      return;
    }
    setSelectedDate(date);
    setDetail(null);
    setLoadingDetail(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const r = await invoke<DailyReport>('generate_daily_report', { date });
      setDetail(r);
    } catch {
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }, [selectedDate]);

  const exportMarkdown = useCallback(async (date: string) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const r = await invoke<DailyReport>('generate_daily_report', { date });
      const lines: string[] = [];
      lines.push(`# 工作日报 ${r.date}`);
      lines.push(`> 生成时间：${new Date(r.generated_at).toLocaleString()}`);
      lines.push(`- 总活动数：${r.total_activities}`);
      lines.push(`- 专注时长：${r.focus_duration_hours}h`);
      lines.push('');
      lines.push('## 活动类型分布');
      for (const a of r.main_activities) lines.push(`- ${ACTIVITY_TYPE_LABELS[a.activity_type] || a.activity_type}：${a.count} 次 (${a.percentage.toFixed(0)}%)`);
      lines.push('');
      lines.push('## 应用使用分布');
      for (const a of r.app_breakdown) lines.push(`- ${a.app_name}：${a.count} 次 (${a.percentage.toFixed(0)}%)`);
      lines.push('');
      lines.push('## 时段分析');
      for (const s of r.time_segments) lines.push(`- ${s.label}：${s.activity_count} 项活动（${s.description}）`);
      await invoke('export_text_file', { content: lines.join('\n'), defaultName: `日报-${r.date}.md`, extension: 'md' });
    } catch (e: any) {
      alert('导出失败：' + (e?.message || e));
    }
  }, []);

  const dailyAvg = reports.length > 0 ? +(reports.reduce((s, r) => s + r.focusHours, 0) / reports.length).toFixed(1) : 0;
  const totalActivities = reports.reduce((s, r) => s + r.totalActivities, 0);

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto px-8 py-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
              <History className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">历史报告</h1>
              <p className="text-sm text-gray-500">查看和管理历史日报（近 30 天）</p>
            </div>
          </div>
          <button onClick={loadHistory} disabled={loading} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
          </button>
        </div>

        {showMock && (
          <div className="text-xs text-yellow-600 bg-yellow-50 px-3 py-2 rounded-lg mb-4">
            演示模式 (Tauri 未连接) — 暂无历史数据
          </div>
        )}

        {/* Overview Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: '报告总数', value: reports.length, icon: FileText },
            { label: '总活动数', value: totalActivities, icon: BarChart3 },
            { label: '日均专注', value: `${dailyAvg}h`, icon: Clock },
            { label: '覆盖天数', value: reports.length, icon: Calendar },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Report List */}
        <div className="bg-white rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">日报列表</h3>
          </div>
          {reports.length === 0 ? (
            <div className="p-12 text-center">
              <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">暂无历史报告</p>
              <p className="text-sm text-gray-400 mt-1">开始截图分析后将在这里累积</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {reports.map((report) => (
                <div
                  key={report.date}
                  onClick={() => openReport(report.date)}
                  className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                    selectedDate === report.date ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-gray-500" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {new Date(report.date).toLocaleDateString('zh-CN', {
                            year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
                          })}
                        </p>
                        <p className="text-sm text-gray-500">
                          {report.totalActivities} 条记录 · {report.focusHours}h 专注 · 主要: {report.mainActivity}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); exportMarkdown(report.date); }}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                        title="导出 Markdown"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${selectedDate === report.date ? 'rotate-90' : ''}`} />
                    </div>
                  </div>

                  {selectedDate === report.date && (
                    <div className="mt-4 ml-16 p-4 bg-white border border-gray-200 rounded-xl">
                      {loadingDetail ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Loader2 className="w-4 h-4 animate-spin" /> 加载报告中...
                        </div>
                      ) : detail ? (
                        <>
                          <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="text-center">
                              <p className="text-lg font-bold text-gray-900">{detail.total_activities}</p>
                              <p className="text-xs text-gray-500">活动数</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-gray-900">{detail.focus_duration_hours}h</p>
                              <p className="text-xs text-gray-500">专注时长</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-gray-900">{detail.app_breakdown.length}</p>
                              <p className="text-xs text-gray-500">应用数</p>
                            </div>
                          </div>
                          {detail.main_activities.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs text-gray-500 mb-1">活动类型</p>
                              <div className="flex flex-wrap gap-2">
                                {detail.main_activities.map((a) => (
                                  <span key={a.activity_type} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                                    {ACTIVITY_TYPE_LABELS[a.activity_type] || a.activity_type} {a.count}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); window.print(); }}
                              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
                            >
                              <FileText className="w-4 h-4" />
                              导出 PDF
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); exportMarkdown(report.date); }}
                              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                            >
                              <Download className="w-4 h-4" />
                              导出 Markdown
                            </button>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-gray-400">报告加载失败</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
