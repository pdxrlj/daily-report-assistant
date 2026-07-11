import React, { useState, useEffect } from 'react';
import {
  FileText,
  Clock,
  BarChart2,
  AppWindow,
  History,
  Bot,
  Settings,
  HelpCircle,
  Bell,
} from 'lucide-react';
import { isTauri } from '../../src/services/env';

interface SidebarProps {
  activeMenu: string;
  onMenuChange: (menu: string) => void;
}

const menuItems = [
  { id: 'today', label: '今日工作', icon: FileText },
  { id: 'report', label: '生成报告', icon: FileText },
  { id: 'timeline', label: '工作时间线', icon: Clock },
  { id: 'heatmap', label: '时段热力图', icon: BarChart2 },
  { id: 'apps', label: '应用记录', icon: AppWindow },
  { id: 'history', label: '历史报告', icon: History },
  { id: 'agent', label: '接入 Agent', icon: Bot },
];

const moreItems = [
  { id: 'settings', label: '设置', icon: Settings },
  { id: 'help', label: '帮助', icon: HelpCircle },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeMenu, onMenuChange }) => {
  const [username, setUsername] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isTauri()) return;
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const name = await invoke<string>('get_current_user');
        if (!cancelled) setUsername(name);
      } catch {
        // 忽略：无法获取时保持默认空
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const initial = username ? username.trim().charAt(0).toUpperCase() : 'U';

  return (
    <div className="w-[200px] h-screen bg-white border-r border-gray-200 flex flex-col">
      {/* 应用名称 */}
      <div className="px-4 py-5 border-b border-gray-100">
        <h1 className="text-lg font-semibold text-gray-900">日报</h1>
      </div>

      {/* 主菜单 */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeMenu === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onMenuChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-gray-100 text-gray-900 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* 更多选项 */}
      <div className="px-2 py-2 border-t border-gray-100">
        <p className="px-3 py-2 text-xs text-gray-400 font-medium">更多</p>
        {moreItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeMenu === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onMenuChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-gray-100 text-gray-900 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* 用户信息 */}
      <div className="px-2 py-3 border-t border-gray-100">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-medium">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {username || '当前用户'}
            </p>
          </div>
          <button className="p-1 text-gray-400 hover:text-gray-600">
            <Bell className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
