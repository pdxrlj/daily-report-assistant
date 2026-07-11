import { useEffect, useRef } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

export function useAutoCapture() {
  const { autoCapture, captureInterval } = useSettingsStore();
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
        await invoke('capture_and_analyze');
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
  }, [autoCapture, captureInterval]);
}
