import React, { useState, useEffect } from 'react';
import { AppWindow, RefreshCw, Clock, BarChart3 } from 'lucide-react';
import { mockActivities } from '../utils/mockData';
import type { Activity } from '../types';

interface AppStat {
  appName: string;
  count: number;
  totalImportance: number;
  avgImportance: number;
  activities: Activity[];
}

export const AppRecordsPage: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'count' | 'name'>('count');
  const [showMock, setShowMock] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setShowMock(false);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<any[]>('get_today_activities');
      setActivities(result.map((r: any) => ({
        id: r.id,
        timestamp: r.timestamp,
        appName: r.app_name,
        activityType: r.activity_type,
        description: r.description,
        keywords: r.keywords ? JSON.parse(r.keywords) : [],
        importanceScore: r.importance_score,
      })));
    } catch {
      setActivities(mockActivities);
      setShowMock(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const appStats: AppStat[] = Object.values(
    activities.reduce<Record<string, AppStat>>((acc, act) => {
      if (!acc[act.appName]) {
        acc[act.appName] = { appName: act.appName, count: 0, totalImportance: 0, avgImportance: 0, activities: [] };
      }
      acc[act.appName].count++;
      acc[act.appName].totalImportance += act.importanceScore;
      acc[act.appName].activities.push(act);
      return acc;
    }, {})
  ).map((stat) => ({
    ...stat,
    avgImportance: +(stat.totalImportance / stat.count).toFixed(2),
  }));

  appStats.sort((a, b) => sortBy === 'count' ? b.count - a.count : a.appName.localeCompare(b.appName));

  const allTypes = [...new Set(activities.map(a => a.activityType))];
  const typeLabels: Record<string, string> = {
    coding: '编程', design: '设计', communication: '沟通',
    reading: '阅读', data_analysis: '数据分析', writing: '写作',
    meeting: '会议', other: '其他',
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto px-8 py-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
              <AppWindow className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">应用记录</h1>
              <p className="text-sm text-gray-500">按应用分类查看活动记录</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'count' | 'name')}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
            >
              <option value="count">按使用次数</option>
              <option value="name">按名称</option>
            </select>
            <button
              onClick={loadData}
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

        {/* Overview Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: '应用数', value: appStats.length, icon: AppWindow },
            { label: '总活动', value: activities.length, icon: BarChart3 },
            { label: '活动类型', value: allTypes.length, icon: BarChart3 },
            { label: '平均重要性', value: activities.length > 0 ? +(activities.reduce((s, a) => s + a.importanceScore, 0) / activities.length).toFixed(1) : 0, icon: Clock },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Type Distribution */}
        <div className="bg-white rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">活动类型分布</h3>
          <div className="flex flex-wrap gap-4">
            {allTypes.map((type) => {
              const count = activities.filter(a => a.activityType === type).length;
              const pct = activities.length > 0 ? (count / activities.length * 100).toFixed(0) : 0;
              return (
                <div key={type} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-900">{typeLabels[type] || type}</span>
                  <span className="text-xs text-gray-500">{count}次 ({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* App List */}
        {appStats.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <AppWindow className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">暂无应用记录</p>
          </div>
        ) : (
          <div className="space-y-4">
            {appStats.map((stat) => (
              <div key={stat.appName} className="bg-white rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                      {stat.appName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{stat.appName}</h3>
                      <p className="text-sm text-gray-500">
                        {stat.count} 次活动 · 平均重要性 {stat.avgImportance}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {[...new Set(stat.activities.map(a => a.activityType))].map((type) => (
                      <span key={type} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                        {typeLabels[type] || type}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Activity list for this app */}
                <div className="space-y-2">
                  {stat.activities.map((act, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm text-gray-700">{act.description}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(act.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                          {' · '}
                          {act.keywords.slice(0, 3).join(' · ')}
                        </p>
                      </div>
                      <div className={`text-xs font-medium px-2 py-1 rounded-full ml-4 ${
                        act.importanceScore >= 0.7 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {act.importanceScore.toFixed(1)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
