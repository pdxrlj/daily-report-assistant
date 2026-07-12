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
  visionModelSource: AIProviderType;
  chatModelSource: AIProviderType;
  apiKey: string;
  autoDetect: boolean;
  autoCapture: boolean;
  captureInterval: number;
  theme: 'light' | 'dark';
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
  setTheme: (theme: 'light' | 'dark') => void;
  runDetection: () => Promise<void>;
  getEffectiveConfig: () => AIProviderConfig;
  getVisionModel: () => string;
  getChatModel: () => string;
  getVisionConfig: () => AIProviderConfig;
  getChatConfig: () => AIProviderConfig;
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
      visionModelSource: 'ollama',
      chatModelSource: 'ollama',
      apiKey: '',
      autoDetect: true,
      autoCapture: false,
      captureInterval: 5,
      theme: 'light',
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
        // 记录选中模型来源（当前服务商），用于跨来源显示时加 tag 区分
        set({ visionModel: model, visionModelSource: get().aiProvider });
      },

      setChatModel: (model) => {
        set({ chatModel: model, chatModelSource: get().aiProvider });
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

      setTheme: (theme) => {
        set({ theme });
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
          defaultModel: state.customModel || state.providerConfig.defaultModel,
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

      // 截图分析模型的完整配置（含来源、baseUrl、apiKey），用于按来源路由请求
      getVisionConfig: () => {
        const state = get();
        const source = state.visionModelSource;
        const preset = PROVIDER_PRESETS[source];
        return {
          ...preset,
          type: source,
          baseUrl: state.customBaseUrl && source === state.aiProvider
            ? state.customBaseUrl
            : preset.baseUrl,
          apiKey: source === 'openai' ? (state.apiKey || preset.apiKey) : preset.apiKey,
          defaultModel: state.visionModel || state.customModel || preset.defaultModel,
        };
      },

      // 对话模型的完整配置（含来源、baseUrl、apiKey），用于按来源路由请求
      getChatConfig: () => {
        const state = get();
        const source = state.chatModelSource;
        const preset = PROVIDER_PRESETS[source];
        return {
          ...preset,
          type: source,
          baseUrl: state.customBaseUrl && source === state.aiProvider
            ? state.customBaseUrl
            : preset.baseUrl,
          apiKey: source === 'openai' ? (state.apiKey || preset.apiKey) : preset.apiKey,
          defaultModel: state.chatModel || state.customModel || preset.defaultModel,
        };
      },

      resetToPreset: (type) => {
        const config = { ...PROVIDER_PRESETS[type] };
        // 切换服务商时保留已选的视觉/对话模型，不限制来源（用户选中哪个就用哪个）
        const state = get();
        set({
          aiProvider: type,
          providerConfig: { ...config, defaultModel: state.visionModel || config.defaultModel },
          customBaseUrl: '',
          customModel: '',
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
        visionModelSource: state.visionModelSource,
        chatModelSource: state.chatModelSource,
        apiKey: state.apiKey,
        autoDetect: state.autoDetect,
        autoCapture: state.autoCapture,
        captureInterval: state.captureInterval,
        theme: state.theme,
      }),
    },
  ),
);
