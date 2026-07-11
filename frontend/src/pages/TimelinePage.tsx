import React, { useState, useEffect } from 'react';
import { Clock, RefreshCw } from 'lucide-react';
import { mockActivities } from '../utils/mockData';
import type { Activity } from '../types';

const ACTIVITY_ICONS: Record<string, string> = {
  coding: '💻', design: '🎨', communication: '💬',
  reading: '📖', data_analysis: '📊', writing: '✍️',
  meeting: '📅', other: '📋',
};

const ACTIVITY_COLORS: Record<string, string> = {
  coding: 'border-l-blue-500 bg-blue-50',
  design: 'border-l-purple-500 bg-purple-50',
  communication: 'border-l-green-500 bg-green-50',
  reading: 'border-l-yellow-500 bg-yellow-50',
  data_analysis: 'border-l-orange-500 bg-orange-50',
  writing: 'border-l-pink-500 bg-pink-50',
  meeting: 'border-l-red-500 bg-red-50',
  other: 'border-l-gray-500 bg-gray-50',
};

export const TimelinePage: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [showMock, setShowMock] = useState(false);

  const loadActivities = async () => {
    setLoading(true);
    setShowMock(false);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<Activity[]>('get_today_activities');
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
    loadActivities();
  }, []);

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto px-8 py-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">工作时间线</h1>
              <p className="text-sm text-gray-500">今日工作活动时间线</p>
            </div>
          </div>
          <button
            onClick={loadActivities}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>

        {showMock && (
          <div className="text-xs text-yellow-600 bg-yellow-50 px-3 py-2 rounded-lg mb-4">
            演示模式 (Tauri 未连接) — 显示模拟数据
          </div>
        )}

        {activities.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">暂无活动记录</p>
            <p className="text-sm text-gray-400 mt-1">开始截图分析后将显示在这里</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[31px] top-0 bottom-0 w-0.5 bg-gray-200" />

            <div className="space-y-4">
              {activities
                .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                .map((activity, idx) => {
                  const time = new Date(activity.timestamp);
                  const timeStr = time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                  const colorClass = ACTIVITY_COLORS[activity.activityType] || ACTIVITY_COLORS.other;
                  const icon = ACTIVITY_ICONS[activity.activityType] || ACTIVITY_ICONS.other;

                  return (
                    <div key={activity.id || idx} className="flex gap-4">
                      {/* Time dot */}
                      <div className="relative flex-shrink-0">
                        <div className="w-[63px] text-right pr-4 pt-1">
                          <span className="text-sm text-gray-500 font-mono">{timeStr}</span>
                        </div>
                        <div className="absolute right-[-16px] top-[6px] w-3 h-3 rounded-full bg-white border-2 border-blue-500 z-10" />
                      </div>

                      {/* Activity card */}
                      <div className={`flex-1 ml-4 p-4 rounded-xl border-l-4 ${colorClass}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span>{icon}</span>
                          <span className="font-medium text-gray-900">{activity.appName}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-white/60 text-gray-500">
                            {activity.activityType}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{activity.description}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {activity.keywords.map((kw, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 bg-white/60 text-gray-500 rounded-full">
                              {kw}
                            </span>
                          ))}
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            activity.importanceScore >= 0.7 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            重要性 {activity.importanceScore.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
