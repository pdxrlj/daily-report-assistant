import React, { useState } from 'react';
import { Monitor, CheckCircle2 } from 'lucide-react';
import type { DisplayInfo } from '../../types';

interface DisplayInfoProps {
  displays: DisplayInfo[];
}

export const DisplayInfoCard: React.FC<DisplayInfoProps> = ({ displays }) => {
  const [selectedId, setSelectedId] = useState<number | null>(
    displays.find((d) => d.isPrimary)?.id ?? displays[0]?.id ?? null,
  );

  return (
    <div className="bg-white rounded-xl p-6">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Monitor className="w-5 h-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-900">已连接显示器</h3>
        </div>
        <span className="text-sm text-gray-500">{displays.length} 台</span>
      </div>
      <p className="text-xs text-gray-500 mb-4">点击卡片选择用于截图的显示器</p>

      <div className="grid grid-cols-2 gap-4">
        {displays.map((display) => {
          const selected = display.id === selectedId;
          return (
            <div
              key={display.id}
              onClick={() => setSelectedId(display.id)}
              className={`relative p-4 rounded-lg border-2 transition-all cursor-pointer ${
                display.isPrimary
                  ? 'border-green-300 bg-green-50 hover:border-green-400'
                  : 'border-gray-200 bg-gray-50 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Monitor
                    className={`w-5 h-5 flex-shrink-0 ${
                      display.isPrimary ? 'text-green-600' : 'text-gray-400'
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{display.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">显示器 {display.id}</p>
                  </div>
                </div>
                {display.isPrimary ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/15 text-green-600 text-xs font-medium flex-shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    主显示器
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs flex-shrink-0">
                    副显示器
                  </span>
                )}
              </div>

              <div className="mt-3 space-y-1 text-xs text-gray-600">
                <p>
                  {display.width} × {display.height} · {display.scaleFactor}%
                </p>
                {display.coordinate && (
                  <p className="text-gray-500">
                    坐标 {display.coordinate.x}, {display.coordinate.y}
                  </p>
                )}
              </div>

              {selected && (
                <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 text-xs font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  已选中
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
