import React, { useState, useCallback } from 'react';
import {
  FileText,
  Download,
  Calendar,
  BarChart3,
  Clock,
  Loader2,
  Layers,
  AppWindow,
  PieChart,
  RefreshCw,
} from 'lucide-react';
import { mockActivities } from '../utils/mockData';
import { useSettingsStore } from '../stores/settingsStore';
import { useReportStore } from '../stores/reportStore';
import type { DailyReport } from '../stores/reportStore';

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  coding: '编程', design: '设计', communication: '沟通',
  reading: '阅读', data_analysis: '数据分析', writing: '写作',
  meeting: '会议', other: '其他',
};

const PROVIDER_LABELS: Record<string, string> = {
  ollama: 'Ollama',
  lmstudio: 'LM Studio',
  openai: 'OpenAI',
};

const PROVIDER_TAG_CLASS: Record<string, string> = {
  ollama: 'bg-green-100 text-green-700 border-green-200',
  lmstudio: 'bg-purple-100 text-purple-700 border-purple-200',
  openai: 'bg-orange-100 text-orange-700 border-orange-200',
};

export const ReportPage: React.FC = () => {
  const report = useReportStore((s) => s.report);
  const setReport = useReportStore((s) => s.setReport);
  const date = useReportStore((s) => s.date);
  const setDate = useReportStore((s) => s.setDate);
  const mode = useReportStore((s) => s.mode);
  const setMode = useReportStore((s) => s.setMode);
  const startTime = useReportStore((s) => s.startTime);
  const setStartTime = useReportStore((s) => s.setStartTime);
  const endTime = useReportStore((s) => s.endTime);
  const setEndTime = useReportStore((s) => s.setEndTime);
  const showMock = useReportStore((s) => s.showMock);
  const setShowMock = useReportStore((s) => s.setShowMock);
  const summary = useReportStore((s) => s.summary);
  const setSummary = useReportStore((s) => s.setSummary);
  const summaryError = useReportStore((s) => s.summaryError);
  const setSummaryError = useReportStore((s) => s.setSummaryError);

  const [loading, setLoading] = useState(false);
  const [summarizing, setSummarizing] = useState(false);

  const getChatConfig = useSettingsStore((s) => s.getChatConfig);
  const chatCfg = getChatConfig();

  const generateSummary = useCallback(async (r: DailyReport) => {
    setSummarizing(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const cfg = getChatConfig();
      const activitiesText = r.activities.length
        ? r.activities
            .map(
              (a) =>
                `- [${a.time}] ${ACTIVITY_TYPE_LABELS[a.activity_type] || a.activity_type} · ${a.app_name}：${a.description}`,
            )
            .join('\n')
        : '（无工作内容记录）';
      const prompt =
        '请根据以下今日工作记录，生成一段自然流畅的工作日报总结（中文，1 段话，150~250 字，' +
        '突出主要成果与产出，不要分点、不要使用 markdown 标题）：\n\n' +
        `日期：${r.date}\n总活动数：${r.total_activities}\n专注时长：${r.focus_duration_hours}h\n\n工作内容：\n${activitiesText}`;
      const res = await invoke<string>('agent_chat', {
        message: prompt,
        model: cfg.defaultModel || null,
        providerType: cfg.type,
        baseUrl: cfg.baseUrl || null,
        apiKey: cfg.apiKey ?? null,
      });
      setSummary(res);
    } catch (e: any) {
      setSummary(null);
      setSummaryError(typeof e === 'string' ? e : (e?.message || '生成失败，请重试'));
    } finally {
      setSummarizing(false);
    }
  }, [getChatConfig]);

  const generateReport = useCallback(async () => {
    setLoading(true);
    setShowMock(false);
    setSummary(null);
    setSummaryError(null);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result =
        mode === 'date'
          ? await invoke<DailyReport>('generate_daily_report', { date })
          : await invoke<DailyReport>('generate_report_timerange', {
              start_time: startTime,
              end_time: endTime,
            });
      setReport(result);
      // 生成 AI 段落总结（不阻塞报告展示）
      void generateSummary(result);
    } catch {
      // Fallback to mock if Tauri not available
      const rangeLabel =
        mode === 'range' ? `${startTime} ~ ${endTime}` : date;
      const mockReport: DailyReport = {
        date: rangeLabel,
        total_activities: mockActivities.length,
        focus_duration_hours: 1.7,
        main_activities: [
          { activity_type: 'coding', count: 2, percentage: 50 },
          { activity_type: 'design', count: 1, percentage: 25 },
          { activity_type: 'communication', count: 1, percentage: 25 },
        ],
        heatmap: Array.from({ length: 24 }, (_, i) => ({
          hour: i,
          count: [0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 77, 65, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0][i],
        })),
        app_breakdown: [
          { app_name: 'VS Code', count: 2, percentage: 50 },
          { app_name: 'Figma', count: 1, percentage: 25 },
          { app_name: '微信', count: 1, percentage: 25 },
        ],
        time_segments: [
          { label: '上午', activity_count: 4, description: '上午工作时段' },
          { label: '下午', activity_count: 0, description: '下午工作时段' },
          { label: '晚上', activity_count: 0, description: '晚间工作时段' },
        ],
        activities: [
          { time: '09:12', app_name: 'VS Code', activity_type: 'coding', description: '开发日报生成模块，完成工作内容明细的数据结构与接口联调', keywords: ['TypeScript', 'React', 'Tauri'], importance_score: 0.8 },
          { time: '10:35', app_name: 'Figma', activity_type: 'design', description: '调整分析结果卡片的布局与空状态高度', keywords: ['UI', '布局'], importance_score: 0.6 },
          { time: '14:08', app_name: '微信', activity_type: 'communication', description: '与产品沟通日报导出格式需求', keywords: ['需求', '沟通'], importance_score: 0.5 },
        ],
        generated_at: new Date().toISOString(),
      };
      setReport(mockReport);
      setShowMock(true);
      setSummary(
        '今日主要围绕日报生成模块展开开发工作：上午在 VS Code 中完成了工作内容明细的数据结构与接口联调，' +
          '并在 Figma 中优化了分析结果卡片的布局与空状态；下午与产品沟通了日报导出格式的需求。' +
          '整体节奏稳定，核心产出为前端报告模块的能力落地。',
      );
    } finally {
      setLoading(false);
    }
  }, [date, mode, startTime, endTime, generateSummary]);

  const buildMarkdown = (r: DailyReport): string => {
    const lines: string[] = [];
    lines.push(`# 工作日报 ${r.date}`);
    lines.push('');
    lines.push(`> 生成时间：${new Date(r.generated_at).toLocaleString()}`);
    lines.push('');
    if (summary) {
      lines.push('## AI 报告摘要');
      lines.push('');
      lines.push(summary);
      lines.push('');
    }
    lines.push(`- 总活动数：${r.total_activities}`);
    lines.push(`- 专注时长：${r.focus_duration_hours}h`);
    lines.push('');
    lines.push('## 工作内容明细');
    if (r.activities.length === 0) {
      lines.push('（暂无工作内容记录）');
    } else {
      for (const a of r.activities) {
        const kw = a.keywords.length ? ` 关键词：${a.keywords.join('、')}` : '';
        lines.push(`- [${a.time}] ${ACTIVITY_TYPE_LABELS[a.activity_type] || a.activity_type} · ${a.app_name}（重要性 ${a.importance_score.toFixed(1)}）：${a.description}${kw}`);
      }
    }
    lines.push('');
    lines.push('## 活动类型分布');
    for (const a of r.main_activities) {
      lines.push(`- ${ACTIVITY_TYPE_LABELS[a.activity_type] || a.activity_type}：${a.count} 次 (${a.percentage.toFixed(0)}%)`);
    }
    lines.push('');
    lines.push('## 应用使用分布');
    for (const a of r.app_breakdown) {
      lines.push(`- ${a.app_name}：${a.count} 次 (${a.percentage.toFixed(0)}%)`);
    }
    lines.push('');
    lines.push('## 时段分析');
    for (const s of r.time_segments) {
      lines.push(`- ${s.label}：${s.activity_count} 项活动（${s.description}）`);
    }
    lines.push('');
    lines.push('## 小时活动热力');
    lines.push('| 时段 | 记录数 |');
    lines.push('| --- | --- |');
    for (const h of r.heatmap) {
      lines.push(`| ${h.hour}:00 | ${h.count} |`);
    }
    return lines.join('\n');
  };

  const handleExportMarkdown = async () => {
    if (!report) return;
    const md = buildMarkdown(report);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('export_text_file', {
        content: md,
        defaultName: `日报-${report.date}.md`,
        extension: 'md',
      });
    } catch (e: any) {
      alert('导出失败：' + (e?.message || e));
    }
  };

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto px-8 py-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
            <FileText className="w-5 h-5 text-gray-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">生成报告</h1>
            <p className="text-sm text-gray-500">自动生成工作日报和周报</p>
          </div>
        </div>

        {/* Mode switch + time selection + Generate */}
        <div className="bg-white rounded-xl p-6 mb-6 flex flex-wrap items-center gap-4">
          <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => setMode('date')}
              className={`px-4 py-2 text-sm ${mode === 'date' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              按日期
            </button>
            <button
              onClick={() => setMode('range')}
              className={`px-4 py-2 text-sm border-l border-gray-300 ${mode === 'range' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              按时间范围
            </button>
          </div>

          {mode === 'date' ? (
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-500" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <Clock className="w-5 h-5 text-gray-500" />
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <span className="text-sm text-gray-400">至</span>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          )}

          <button
            onClick={generateReport}
            disabled={loading || (mode === 'range' && (!startTime || !endTime || startTime > endTime))}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
            {loading ? '生成中...' : (mode === 'range' ? '生成报告' : '生成日报')}
          </button>
          {mode === 'range' && startTime > endTime && (
            <span className="text-xs text-red-500">开始时间不能晚于结束时间</span>
          )}
          {showMock && (
            <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
              演示模式 (Tauri 未连接)
            </span>
          )}
        </div>

        {report && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: '总活动数', value: report.total_activities, icon: Layers, color: 'blue' },
                { label: '专注时长', value: `${report.focus_duration_hours}h`, icon: Clock, color: 'green' },
                { label: '应用数', value: report.app_breakdown.length, icon: AppWindow, color: 'purple' },
                { label: '时段数', value: report.time_segments.filter(s => s.activity_count > 0).length, icon: PieChart, color: 'orange' },
              ].map((card) => (
                <div key={card.label} className="bg-white rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <card.icon className={`w-4 h-4 text-${card.color}-500`} />
                    <span className="text-sm text-gray-500">{card.label}</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                </div>
              ))}
            </div>

            {/* AI Report Summary */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100 ai-summary">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900">AI 报告摘要</h3>
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                    {chatCfg.defaultModel || '默认模型'}
                  </span>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${PROVIDER_TAG_CLASS[chatCfg.type] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                    {PROVIDER_LABELS[chatCfg.type] || '未设置'}
                  </span>
                </div>
                <button
                  onClick={() => report && generateSummary(report)}
                  disabled={summarizing || !report}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-600 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${summarizing ? 'animate-spin' : ''}`} />
                  {summarizing ? '生成中...' : '重新生成'}
                </button>
              </div>
              {summarizing && !summary ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  AI 正在总结今日工作...
                </div>
              ) : summary ? (
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{summary}</p>
              ) : (
                <div>
                  <p className="text-sm text-gray-400">暂无摘要，点击「重新生成」让 AI 根据工作内容撰写一段话报告。</p>
                  {summaryError && (
                    <p className="text-xs text-red-500 mt-2">生成失败：{summaryError}</p>
                  )}
                </div>
              )}
            </div>

            {/* Work Content Detail */}
            <div className="bg-white rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {mode === 'range' ? '时间范围内的工作内容' : '今天干了什么'}
                </h3>
                {report.activities.length > 5 && (
                  <span className="text-xs text-gray-400">共 {report.activities.length} 条，滚动查看</span>
                )}
              </div>
              {report.activities.length === 0 ? (
                <p className="text-sm text-gray-400">暂无工作内容记录，先去截图分析添加几条吧。</p>
              ) : (
                <div className="space-y-4 max-h-[440px] overflow-y-auto pr-2">
                  {report.activities.map((act, i) => (
                    <div key={i} className="flex gap-4 pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                      <div className="w-14 shrink-0 text-sm font-medium text-gray-500 pt-0.5">
                        {act.time}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700">
                            {ACTIVITY_TYPE_LABELS[act.activity_type] || act.activity_type}
                          </span>
                          <span className="text-sm font-medium text-gray-900">{act.app_name}</span>
                          <span className="text-xs text-gray-400">重要性 {act.importance_score.toFixed(1)}</span>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">{act.description}</p>
                        {act.keywords.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {act.keywords.map((kw, j) => (
                              <span
                                key={j}
                                className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full"
                              >
                                {kw}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Activity Type Breakdown */}
            <div className="bg-white rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">活动类型分布</h3>
              <div className="space-y-3">
                {report.main_activities.map((act) => (
                  <div key={act.activity_type}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">{ACTIVITY_TYPE_LABELS[act.activity_type] || act.activity_type}</span>
                      <span className="text-gray-500">{act.count} 次 ({act.percentage.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${act.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* App Breakdown */}
            <div className="bg-white rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">应用使用分布</h3>
              <div className="grid grid-cols-2 gap-6">
                {report.app_breakdown.map((app) => (
                  <div key={app.app_name} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <AppWindow className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{app.app_name}</p>
                      <p className="text-sm text-gray-500">{app.count} 次 · {app.percentage.toFixed(0)}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Time Segments */}
            <div className="bg-white rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">时段分析</h3>
              <div className="grid grid-cols-3 gap-4">
                {report.time_segments.map((seg) => (
                  <div key={seg.label} className={`p-4 rounded-xl border-2 ${
                    seg.activity_count > 0 ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-gray-50'
                  }`}>
                    <p className="font-medium text-gray-900 mb-1">{seg.label}</p>
                    <p className="text-2xl font-bold text-gray-900 mb-1">{seg.activity_count}</p>
                    <p className="text-sm text-gray-500">项活动</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Export */}
            <div className="flex gap-3">
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                <Download className="w-4 h-4" />
                导出 PDF
              </button>
              <button
                onClick={handleExportMarkdown}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                <Download className="w-4 h-4" />
                导出 Markdown
              </button>
            </div>

            <p className="text-xs text-gray-400 text-right">
              报告生成时间: {new Date(report.generated_at).toLocaleString()}
            </p>
          </div>
        )}

        {!report && !loading && (
          <div className="bg-white rounded-xl p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">选择日期并生成报告</p>
            <p className="text-sm text-gray-400 mt-1">基于截图分析数据自动生成</p>
          </div>
        )}
      </div>
    </div>
  );
};
