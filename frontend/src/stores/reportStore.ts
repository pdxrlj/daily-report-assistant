import { create } from 'zustand';

export interface DailyReport {
  date: string;
  total_activities: number;
  focus_duration_hours: number;
  main_activities: { activity_type: string; count: number; percentage: number }[];
  heatmap: { hour: number; count: number }[];
  app_breakdown: { app_name: string; count: number; percentage: number }[];
  time_segments: { label: string; activity_count: number; description: string }[];
  activities: {
    time: string;
    app_name: string;
    activity_type: string;
    description: string;
    keywords: string[];
    importance_score: number;
  }[];
  generated_at: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const startOfDay = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const endOfDay = () => {
  const d = new Date();
  d.setHours(23, 59, 0, 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

interface ReportState {
  report: DailyReport | null;
  summary: string | null;
  summaryError: string | null;
  showMock: boolean;
  date: string;
  mode: 'date' | 'range';
  startTime: string;
  endTime: string;
  setReport: (r: DailyReport | null) => void;
  setSummary: (s: string | null) => void;
  setSummaryError: (s: string | null) => void;
  setShowMock: (b: boolean) => void;
  setDate: (d: string) => void;
  setMode: (m: 'date' | 'range') => void;
  setStartTime: (s: string) => void;
  setEndTime: (s: string) => void;
}

// 报告状态提升到全局 store，避免切换页面时组件卸载导致已生成内容丢失。
export const useReportStore = create<ReportState>((set) => ({
  report: null,
  summary: null,
  summaryError: null,
  showMock: false,
  date: todayLocal(),
  mode: 'date',
  startTime: startOfDay(),
  endTime: endOfDay(),
  setReport: (r) => set({ report: r }),
  setSummary: (s) => set({ summary: s }),
  setSummaryError: (s) => set({ summaryError: s }),
  setShowMock: (b) => set({ showMock: b }),
  setDate: (d) => set({ date: d }),
  setMode: (m) => set({ mode: m }),
  setStartTime: (s) => set({ startTime: s }),
  setEndTime: (s) => set({ endTime: s }),
}));
