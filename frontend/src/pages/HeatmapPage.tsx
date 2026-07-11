import React, { useState, useEffect } from 'react';
import { BarChart2, RefreshCw } from 'lucide-react';
import { mockHeatmapData } from '../utils/mockData';
import type { HeatmapData } from '../types';

export const HeatmapPage: React.FC = () => {
  const [data, setData] = useState<HeatmapData[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
  const [showMock, setShowMock] = useState(false);

  const loadHeatmap = async () => {
    setLoading(true);
    setShowMock(false);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const today = new Date().toISOString().split('T')[0];
      const startDate = viewMode === 'weekly'
        ? new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0]
        : today;
      const entries = await invoke<any[]>('get_heatmap_range', { startDate, endDate: today });

      // Group by date
      const grouped: Record<string, number[]> = {};
      const dayLabels: Record<string, string> = {};
      for (const e of entries) {
        if (!grouped[e.date]) {
          grouped[e.date] = new Array(24).fill(0);
          dayLabels[e.date] = new Date(e.date).toLocaleDateString('zh-CN', { weekday: 'short' });
        }
        grouped[e.date][e.hour] = e.activity_count;
      }

      const result: HeatmapData[] = Object.entries(grouped).map(([date, hourlyData]) => ({
        date,
        dayLabel: dayLabels[date],
        totalRecords: hourlyData.reduce((a, b) => a + b, 0),
        totalHours: hourlyData.filter(h => h > 0).length * 0.5,
        hourlyData,
      }));
      setData(result);
    } catch {
      if (viewMode === 'weekly') {
        const weekly: HeatmapData[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(Date.now() - i * 86400000);
          const dateStr = d.toISOString().split('T')[0];
          const dayLabel = d.toLocaleDateString('zh-CN', { weekday: 'short' });
          const mock = mockHeatmapData.find(m => m.date === dateStr);
          weekly.push(mock || {
            date: dateStr,
            dayLabel,
            totalRecords: Math.floor(Math.random() * 100),
            totalHours: +(Math.random() * 4 + 1).toFixed(1),
            hourlyData: Array.from({ length: 24 }, () => Math.floor(Math.random() * 40)),
          });
        }
        setData(weekly);
      } else {
        setData(mockHeatmapData);
      }
      setShowMock(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHeatmap();
  }, [viewMode]);

  const maxValue = Math.max(...data.flatMap((d) => d.hourlyData), 1);

  const getColor = (value: number) => {
    if (value === 0) return 'bg-gray-100';
    const ratio = value / maxValue;
    if (ratio < 0.2) return 'bg-green-100';
    if (ratio < 0.4) return 'bg-green-200';
    if (ratio < 0.6) return 'bg-green-300';
    if (ratio < 0.8) return 'bg-green-400';
    return 'bg-green-500';
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto px-8 py-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
              <BarChart2 className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">时段热力图</h1>
              <p className="text-sm text-gray-500">各时段工作密度分布</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-gray-100 rounded-lg p-1">
              {(['daily', 'weekly'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    viewMode === mode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  {mode === 'daily' ? '今日' : '近一周'}
                </button>
              ))}
            </div>
            <button
              onClick={loadHeatmap}
              disabled={loading}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {showMock && (
          <div className="text-xs text-yellow-600 bg-yellow-50 px-3 py-2 rounded-lg mb-4">
            演示模式 (Tauri 未连接)
          </div>
        )}

        <div className="bg-white rounded-xl p-6">
          {/* Heatmap Grid */}
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Hour headers */}
              <div className="flex mb-2 ml-24">
                {Array.from({ length: 24 }, (_, i) => (
                  <div key={i} className="flex-1 text-center text-xs text-gray-400">
                    {i}时
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                {data.map((row) => (
                  <div key={row.date} className="flex items-center gap-3">
                    <div className="w-24 flex-shrink-0">
                      <p className="text-sm font-medium text-gray-900">{row.dayLabel}</p>
                      <p className="text-xs text-gray-500">{row.totalRecords}条</p>
                    </div>
                    {row.hourlyData.map((value, hi) => (
                      <div
                        key={hi}
                        className={`flex-1 h-8 ${getColor(value)} flex items-center justify-center text-xs font-medium rounded ${
                          value > 0 ? 'text-gray-700' : 'text-transparent'
                        }`}
                        title={`${hi}:00 - ${value}条`}
                      >
                        {value > 0 ? value : ''}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span>少</span>
              {['bg-gray-100', 'bg-green-100', 'bg-green-200', 'bg-green-300', 'bg-green-400', 'bg-green-500'].map((c) => (
                <div key={c} className={`w-5 h-5 ${c} rounded`} />
              ))}
              <span>多</span>
            </div>
            <p className="text-xs text-gray-400">数字表示该时段的活动记录数</p>
          </div>
        </div>

        {/* Stats Summary */}
        {data.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mt-6">
            {[
              { label: '总记录数', value: data.reduce((s, d) => s + d.totalRecords, 0) },
              { label: '活跃天数', value: data.filter(d => d.totalRecords > 0).length },
              { label: '峰值时段', value: (() => {
                let maxH = 0, maxV = 0;
                data.forEach(d => d.hourlyData.forEach((v, h) => { if (v > maxV) { maxV = v; maxH = h; } }));
                return `${maxH}:00`;
              })() },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
