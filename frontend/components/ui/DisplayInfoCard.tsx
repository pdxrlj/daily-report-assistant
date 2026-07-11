import React from 'react';
import { Monitor } from 'lucide-react';
import { DisplayInfo } from '../../types';

interface DisplayInfoProps {
  displays: DisplayInfo[];
}

export const DisplayInfoCard: React.FC<DisplayInfoProps> = ({ displays }) => {
  return (
    <div className="bg-white rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Monitor className="w-5 h-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-900">已连接显示器</h3>
        </div>
        <span className="text-sm text-gray-500">{displays.length} 台</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {displays.map((display) => (
          <div
            key={display.id}
            className={`relative p-4 rounded-lg border-2 transition-all ${
              display.isPrimary
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 bg-gray-50 hover:border-gray-300'
            }`}
          >
            {/* 显示器编号 */}
            <div className="flex items-center gap-2 mb-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  display.isPrimary
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {display.id}
              </div>
              <span className="text-sm font-medium text-gray-900">{display.name}</span>
            </div>

            {/* 显示器参数 */}
            <div className="space-y-1 text-xs text-gray-600">
              <p>
                {display.width} × {display.height} · {display.scaleFactor}%
              </p>
              {display.isPrimary && (
                <p className="text-green-600 font-medium">主显示器</p>
              )}
              {display.coordinate && (
                <p className="text-gray-500">
                  坐标 {display.coordinate.x}, {display.coordinate.y}
                </p>
              )}
            </div>

            {/* 选中指示器 */}
            {display.isPrimary && (
              <div className="absolute top-2 right-2">
                <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
