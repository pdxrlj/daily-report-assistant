import React from 'react';
import type { HeatmapData } from '../../types';

interface HeatmapChartProps {
  data: HeatmapData[];
}

const timeLabels = ['0:00', '3:00', '6:00', '9:00', '12:00', '15:00', '18:00', '21:00'];

const getHeatmapColor = (value: number, maxValue: number): string => {
  if (value === 0) return 'bg-gray-100';
  const ratio = value / maxValue;
  if (ratio < 0.2) return 'bg-green-100';
  if (ratio < 0.4) return 'bg-green-200';
  if (ratio < 0.6) return 'bg-green-300';
  if (ratio < 0.8) return 'bg-green-400';
  return 'bg-green-500';
};

export const HeatmapChart: React.FC<HeatmapChartProps> = ({ data }) => {
  // 计算最大值用于颜色映射
  const maxValue = Math.max(...data.flatMap((d) => d.hourlyData));

  return (
    <div className="bg-white rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">时段记录</h3>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-gray-300 text-green-500 focus:ring-green-500" />
          展示前两日时段热力
        </label>
      </div>

      {/* 热力图 */}
      <div className="space-y-3">
        {data.map((row) => (
          <div key={row.date} className="flex items-center gap-3">
            {/* 日期标签 */}
            <div className="w-24 flex-shrink-0">
              <p className="text-sm font-medium text-gray-900">{row.dayLabel}</p>
              <p className="text-xs text-gray-500">{row.totalRecords}条 · {row.totalHours}h</p>
            </div>

            {/* 热力格子 */}
            <div className="flex-1 flex gap-1">
              {row.hourlyData.map((value, hourIndex) => (
                <div
                  key={hourIndex}
                  className={`heatmap-cell ${getHeatmapColor(value, maxValue)} flex items-center justify-center text-xs font-medium ${
                    value > 0 ? 'text-gray-700' : 'text-transparent'
                  }`}
                  title={`${hourIndex}:00 - ${value}条记录`}
                >
                  {value > 0 ? value : ''}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 时间轴标签 */}
      <div className="flex items-center mt-3 ml-[124px]">
        {timeLabels.map((label, index) => (
          <div
            key={index}
            className="text-xs text-gray-500"
            style={{ width: `${100 / timeLabels.length}%` }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* 图例 */}
      <div className="flex items-center justify-end gap-2 mt-4 text-xs text-gray-600">
        <span>少</span>
        <div className="flex gap-1">
          <div className="w-4 h-4 bg-gray-100 rounded-sm"></div>
          <div className="w-4 h-4 bg-green-100 rounded-sm"></div>
          <div className="w-4 h-4 bg-green-200 rounded-sm"></div>
          <div className="w-4 h-4 bg-green-300 rounded-sm"></div>
          <div className="w-4 h-4 bg-green-400 rounded-sm"></div>
          <div className="w-4 h-4 bg-green-500 rounded-sm"></div>
        </div>
        <span>多</span>
      </div>
    </div>
  );
};
