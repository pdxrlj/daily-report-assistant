import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AIProviderConfig, AIProviderType } from '../types/ai';
import { PROVIDER_PRESETS } from '../types/ai';
import { detectLocalProviders } from '../services/providerDetector';

interface SettingsState {
  aiProvider: AIProviderType;
  customBaseUrl: string;
  customModel: string;
  visionModel: string;
  chatModel: string;
  apiKey: string;
  autoDetect: boolean;
  autoCapture: boolean;
  captureInterval: number;
  detectedProviders: AIProviderType[];
  providerConfig: AIProviderConfig;

  setAIProvider: (provider: AIProviderType) => void;
  setCustomBaseUrl: (url: string) => void;
  setCustomModel: (model: string) => void;
  setVisionModel: (model: string) => void;
  setChatModel: (model: string) => void;
  setApiKey: (key: string) => void;
  setAutoDetect: (enabled: boolean) => void;
  setAutoCapture: (enabled: boolean) => void;
  setCaptureInterval: (minutes: number) => void;
  runDetection: () => Promise<void>;
  getEffectiveConfig: () => AIProviderConfig;
  getVisionModel: () => string;
  getChatModel: () => string;
  resetToPreset: (type: AIProviderType) => void;
}

const PERSIST_KEY = 'daily-report-settings';

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      aiProvider: 'ollama' as AIProviderType,
      customBaseUrl: '',
      customModel: '',
      visionModel: '',
      chatModel: '',
      apiKey: '',
      autoDetect: true,
      autoCapture: false,
      captureInterval: 5,
      detectedProviders: [],
      providerConfig: { ...PROVIDER_PRESETS.ollama },

      setAIProvider: (provider) => {
        const config = { ...PROVIDER_PRESETS[provider] };
        set({ aiProvider: provider, providerConfig: config });
      },

      setCustomBaseUrl: (url) => {
        set({ customBaseUrl: url });
        const state = get();
        const config = { ...state.providerConfig, baseUrl: url };
        set({ providerConfig: config });
      },

      setCustomModel: (model) => {
        set({ customModel: model });
        const state = get();
        const config = { ...state.providerConfig, defaultModel: model };
        set({ providerConfig: config });
      },

      setVisionModel: (model) => {
        set({ visionModel: model });
        // 截图分析模型同时作为默认模型（用于视觉分析链路）
        const state = get();
        set({ providerConfig: { ...state.providerConfig, defaultModel: model } });
      },

      setChatModel: (model) => {
        set({ chatModel: model });
      },

      setApiKey: (key) => {
        set({ apiKey: key });
        const state = get();
        const config = { ...state.providerConfig, apiKey: key };
        set({ providerConfig: config });
      },

      setAutoDetect: (enabled) => {
        set({ autoDetect: enabled });
        if (enabled) {
          get().runDetection();
        }
      },

      setAutoCapture: (enabled) => {
        set({ autoCapture: enabled });
      },

      setCaptureInterval: (minutes) => {
        set({ captureInterval: minutes });
      },

      runDetection: async () => {
        const detected = await detectLocalProviders();
        const types = detected.map((d) => d.config.type);
        set({ detectedProviders: types });

        if (types.length > 0 && get().autoDetect) {
          const first = detected[0];
          set({
            aiProvider: first.config.type,
            providerConfig: {
              ...first.config,
              models: first.status.models,
              apiKey: get().apiKey,
            },
          });
        }
      },

      getEffectiveConfig: () => {
        const state = get();
        return {
          ...state.providerConfig,
          baseUrl: state.customBaseUrl || state.providerConfig.baseUrl,
          defaultModel: state.visionModel || state.customModel || state.providerConfig.defaultModel,
          apiKey: state.apiKey || state.providerConfig.apiKey || undefined,
        };
      },

      // 截图分析使用的模型（回退到通用模型/预设）
      getVisionModel: () => {
        const state = get();
        return state.visionModel || state.customModel || state.providerConfig.defaultModel || '';
      },

      // Agent 对话使用的模型（回退到通用模型/预设）
      getChatModel: () => {
        const state = get();
        return state.chatModel || state.customModel || state.providerConfig.defaultModel || '';
      },

      resetToPreset: (type) => {
        const config = { ...PROVIDER_PRESETS[type] };
        set({
          aiProvider: type,
          providerConfig: config,
          customBaseUrl: '',
          customModel: '',
          visionModel: '',
          chatModel: '',
          apiKey: '',
        });
      },
    }),
    {
      name: PERSIST_KEY,
      partialize: (state) => ({
        aiProvider: state.aiProvider,
        customBaseUrl: state.customBaseUrl,
        customModel: state.customModel,
        visionModel: state.visionModel,
        chatModel: state.chatModel,
        apiKey: state.apiKey,
        autoDetect: state.autoDetect,
        autoCapture: state.autoCapture,
        captureInterval: state.captureInterval,
      }),
    },
  ),
);
