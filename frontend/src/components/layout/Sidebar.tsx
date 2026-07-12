import React, { useState, useEffect } from 'react';
import {
  FileText,
  Clock,
  BarChart2,
  AppWindow,
  History,
  Bot,
  LayoutDashboard,
  Camera,
  Settings,
  HelpCircle,
  Bell,
  Sun,
  Moon,
} from 'lucide-react';
import { isTauri } from '../../services/env';
import { useSettingsStore } from '../../stores/settingsStore';

interface SidebarProps {
  activeMenu: string;
  onMenuChange: (menu: string) => void;
}

const menuItems = [
  { id: 'today', label: '今日工作', icon: LayoutDashboard },
  { id: 'analysis', label: '截图分析', icon: Camera },
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
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isTauri()) return;
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const name = await invoke<string>('get_current_user');
        if (!cancelled) setUsername(name);
      } catch {
        // 忽略：无法获取时保持默认
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const initial = username ? username.trim().charAt(0).toUpperCase() : 'U';

  const renderMenuItem = (item: { id: string; label: string; icon: React.FC<{ className?: string }> }) => {
    const Icon = item.icon;
    const isActive = activeMenu === item.id;
    return (
      <button
        key={item.id}
        onClick={() => onMenuChange(item.id)}
        style={{
          backgroundColor: isActive ? 'var(--sidebar-active)' : 'transparent',
          color: isActive ? 'var(--sidebar-text)' : 'var(--sidebar-text-muted)',
        }}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors hover:text-[var(--sidebar-text)]`}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)';
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <Icon className="w-4 h-4" />
        <span className={isActive ? 'font-medium' : ''}>{item.label}</span>
      </button>
    );
  };

  return (
    <div
      className="w-[200px] h-screen border-r flex flex-col"
      style={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--sidebar-border)' }}
    >
      {/* App Name + 主题切换 */}
      <div
        className="px-4 py-5 border-b flex items-center justify-between"
        style={{ borderColor: 'var(--sidebar-border)' }}
      >
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--sidebar-text)' }}>
            日报
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--sidebar-text-muted)' }}>
            v0.1.0
          </p>
        </div>
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? '切换到亮色' : '切换到暗色'}
          className="p-1.5 rounded-lg transition-colors hover:text-[var(--sidebar-text)]"
          style={{ color: 'var(--sidebar-text-muted)' }}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Menu */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">{menuItems.map(renderMenuItem)}</nav>

      {/* More */}
      <div className="px-2 py-2 border-t" style={{ borderColor: 'var(--sidebar-border)' }}>
        <p className="px-3 py-2 text-xs font-medium" style={{ color: 'var(--sidebar-text-muted)' }}>
          更多
        </p>
        {moreItems.map(renderMenuItem)}
      </div>

      {/* User */}
      <div className="px-2 py-3 border-t" style={{ borderColor: 'var(--sidebar-border)' }}>
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-medium">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--sidebar-text)' }}>
              {username || '当前用户'}
            </p>
          </div>
          <button
            className="p-1 transition-colors hover:text-[var(--sidebar-text)]"
            style={{ color: 'var(--sidebar-text-muted)' }}
          >
            <Bell className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
