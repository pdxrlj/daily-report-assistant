import type { Activity, HeatmapData, DisplayInfo, WorkStatistics } from '../types';

// 模拟活动数据
export const mockActivities: Activity[] = [
  {
    id: 1,
    timestamp: '2024-01-15T09:52:00Z',
    appName: 'Figma',
    activityType: 'design',
    description: '正在设计新版用户界面，完成首页布局调整',
    keywords: ['UI设计', '首页', '布局'],
    importanceScore: 0.8,
  },
  {
    id: 2,
    timestamp: '2024-01-15T10:15:00Z',
    appName: 'Visual Studio Code',
    activityType: 'coding',
    description: '开发React组件，实现数据可视化模块',
    keywords: ['React', 'TypeScript', '图表'],
    importanceScore: 0.9,
  },
  {
    id: 3,
    timestamp: '2024-01-15T10:45:00Z',
    appName: '微信',
    activityType: 'communication',
    description: '与产品经理讨论需求细节',
    keywords: ['沟通', '需求', '产品'],
    importanceScore: 0.6,
  },
  {
    id: 4,
    timestamp: '2024-01-15T11:30:00Z',
    appName: 'Google Chrome',
    activityType: 'reading',
    description: '查阅技术文档，研究性能优化方案',
    keywords: ['文档', '性能', '优化'],
    importanceScore: 0.7,
  },
];

// 模拟热力图数据
export const mockHeatmapData: HeatmapData[] = [
  {
    date: '2024-01-14',
    dayLabel: '周日',
    totalRecords: 221,
    totalHours: 5.0,
    hourlyData: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  {
    date: '2024-01-15',
    dayLabel: '昨天',
    totalRecords: 576,
    totalHours: 8.8,
    hourlyData: [0, 0, 0, 0, 0, 0, 0, 0, 0, 58, 86, 31, 59, 66, 55, 93, 87, 6, 17, 18, 0, 0, 0, 0],
  },
  {
    date: '2024-01-16',
    dayLabel: '今天',
    totalRecords: 146,
    totalHours: 1.7,
    hourlyData: [0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 77, 65, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
];

// 模拟显示器数据
export const mockDisplays: DisplayInfo[] = [
  {
    id: 1,
    name: 'T270LG',
    width: 2560,
    height: 1440,
    scaleFactor: 100,
    isPrimary: true,
  },
  {
    id: 2,
    name: '内建视网膜显示器',
    width: 3024,
    height: 1964,
    scaleFactor: 200,
    isPrimary: false,
    coordinate: { x: 503, y: 1440 },
  },
];

// 模拟统计数据
export const mockStatistics: WorkStatistics = {
  totalActivities: 146,
  focusDuration: 1.7,
  mainActivity: '设计',
  connectedDisplays: mockDisplays,
};

// 模拟时间线数据
export const mockTimeline = [
  { time: '09:52', activity: '开始工作', app: 'Figma' },
  { time: '10:15', activity: '切换到编码', app: 'VS Code' },
  { time: '10:45', activity: '处理消息', app: '微信' },
  { time: '11:30', activity: '查阅文档', app: 'Chrome' },
];
