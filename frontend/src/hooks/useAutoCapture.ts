import { useEffect, useRef } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

export function useAutoCapture() {
  const autoCapture = useSettingsStore((s) => s.autoCapture);
  const captureInterval = useSettingsStore((s) => s.captureInterval);
  const getVisionConfig = useSettingsStore((s) => s.getVisionConfig);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!autoCapture) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const run = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const cfg = getVisionConfig();
        await invoke('capture_and_analyze', {
          model: cfg.defaultModel || null,
          providerType: cfg.type,
          baseUrl: cfg.baseUrl || null,
          apiKey: cfg.apiKey ?? null,
        });
      } catch {
        // silent fail
      }
    };

    run();
    intervalRef.current = setInterval(run, captureInterval * 60 * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoCapture, captureInterval, getVisionConfig]);
}
