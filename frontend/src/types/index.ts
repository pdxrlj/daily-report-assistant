// 活动记录类型
export type Activity = {
  id: number;
  timestamp: string;
  appName: string;
  activityType: 'coding' | 'design' | 'communication' | 'reading' | 'writing' | 'meeting' | 'other';
  description: string;
  keywords: string[];
  importanceScore: number;
};

// 热力图数据
export type HeatmapData = {
  date: string;
  dayLabel: string;
  totalRecords: number;
  totalHours: number;
  hourlyData: number[]; // 24小时的数据
};

// 显示器信息
export type DisplayInfo = {
  id: number;
  name: string;
  width: number;
  height: number;
  scaleFactor: number;
  isPrimary: boolean;
  coordinate?: { x: number; y: number };
};

// 统计数据
export type WorkStatistics = {
  totalActivities: number;
  focusDuration: number;
  mainActivity: string;
  connectedDisplays: DisplayInfo[];
};

// 导航项
export type NavItem = {
  id: string;
  label: string;
  icon: string;
  badge?: number;
};

// 用户信息
export type UserInfo = {
  name: string;
  avatar?: string;
  plan: 'free' | 'pro' | 'enterprise';
};
