import { useEffect, useRef } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

export function useSyncProviderSettings() {
  const { aiProvider, providerConfig, customBaseUrl, customModel, apiKey, getEffectiveConfig } = useSettingsStore();
  const synced = useRef(false);

  useEffect(() => {
    const sync = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const cfg = getEffectiveConfig();
        await invoke('update_ai_provider', {
          providerType: cfg.type,
          baseUrl: cfg.baseUrl,
          model: cfg.defaultModel,
          apiKey: cfg.apiKey ?? null,
        });
        synced.current = true;
      } catch {
        // not in Tauri, skip
      }
    };
    sync();
  }, [aiProvider, providerConfig.baseUrl, providerConfig.defaultModel, customBaseUrl, customModel, apiKey]);
}
