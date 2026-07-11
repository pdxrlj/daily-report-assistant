import { useState, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { TodayWorkPage } from './pages/TodayWorkPage';
import { AnalysisPage } from './pages/AnalysisPage';
import { ReportPage } from './pages/ReportPage';
import { TimelinePage } from './pages/TimelinePage';
import { HeatmapPage } from './pages/HeatmapPage';
import { AppRecordsPage } from './pages/AppRecordsPage';
import { HistoryPage } from './pages/HistoryPage';
import { AgentPage } from './pages/AgentPage';
import { SettingsPage } from './pages/SettingsPage';
import { useSettingsStore } from './stores/settingsStore';
import { useAutoCapture } from './hooks/useAutoCapture';
import { useSyncProviderSettings } from './hooks/useSyncProviderSettings';
import './index.css';

function App() {
  const [activeMenu, setActiveMenu] = useState('today');
  const { runDetection, autoDetect } = useSettingsStore();

  useAutoCapture();
  useSyncProviderSettings();

  useEffect(() => {
    if (autoDetect) {
      runDetection();
    }
  }, []);

  const renderPage = () => {
    switch (activeMenu) {
      case 'today':
        return <TodayWorkPage />;
      case 'analysis':
        return <AnalysisPage />;
      case 'report':
        return <ReportPage />;
      case 'timeline':
        return <TimelinePage />;
      case 'heatmap':
        return <HeatmapPage />;
      case 'apps':
        return <AppRecordsPage />;
      case 'history':
        return <HistoryPage />;
      case 'agent':
        return <AgentPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <TodayWorkPage />;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#f3f4f6' }}>
      <Sidebar activeMenu={activeMenu} onMenuChange={setActiveMenu} />
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
