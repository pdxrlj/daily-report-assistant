import { useEffect, useRef } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

export function useSyncProviderSettings() {
  const { aiProvider, providerConfig, customBaseUrls, customModel, apiKey, getEffectiveConfig, visionModel, visionModelSource, chatModel, chatModelSource } = useSettingsStore();
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
          visionModel: visionModel || null,
          visionModelSource: visionModelSource || null,
          chatModel: chatModel || null,
          chatModelSource: chatModelSource || null,
        });
        synced.current = true;
      } catch {
        // not in Tauri, skip
      }
    };
    sync();
  }, [aiProvider, providerConfig.baseUrl, providerConfig.defaultModel, customBaseUrls, customModel, apiKey, visionModel, visionModelSource, chatModel, chatModelSource]);
}
