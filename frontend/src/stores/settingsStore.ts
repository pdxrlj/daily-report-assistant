import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AIProviderConfig, AIProviderType } from '../types/ai';
import { PROVIDER_PRESETS } from '../types/ai';
import { detectLocalProviders } from '../services/providerDetector';

interface SettingsState {
  aiProvider: AIProviderType;
  customBaseUrls: Partial<Record<AIProviderType, string>>;
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
  setCustomBaseUrl: (type: AIProviderType, url: string) => void;
  setCustomModel: (model: string) => void;
  setVisionModel: (model: string, source: AIProviderType) => void;
  setChatModel: (model: string, source: AIProviderType) => void;
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
      customBaseUrls: {},
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

      setCustomBaseUrl: (type, url) => {
        const state = get();
        const next = { ...state.customBaseUrls, [type]: url };
        set({ customBaseUrls: next });
        // 同步更新当前激活服务商配置（用于展示与回退）
        if (state.aiProvider === type) {
          set({ providerConfig: { ...state.providerConfig, baseUrl: url || PROVIDER_PRESETS[type].baseUrl } });
        }
      },

      setCustomModel: (model) => {
        set({ customModel: model });
        const state = get();
        const config = { ...state.providerConfig, defaultModel: model };
        set({ providerConfig: config });
      },

      // 选择模型时记录其来源服务商，并让“激活服务商”跟随选择（用于回退/展示）
      setVisionModel: (model, source) => {
        const safeSource = (PROVIDER_PRESETS[source] ? source : 'ollama') as AIProviderType;
        const state = get();
        const preset = { ...PROVIDER_PRESETS[safeSource] };
        const baseUrl = state.customBaseUrls[safeSource] || preset.baseUrl;
        set({
          visionModel: model,
          visionModelSource: safeSource,
          aiProvider: safeSource,
          providerConfig: { ...preset, baseUrl, defaultModel: model || preset.defaultModel },
        });
      },

      setChatModel: (model, source) => {
        const safeSource = (PROVIDER_PRESETS[source] ? source : 'ollama') as AIProviderType;
        const state = get();
        const preset = { ...PROVIDER_PRESETS[safeSource] };
        const baseUrl = state.customBaseUrls[safeSource] || preset.baseUrl;
        set({
          chatModel: model,
          chatModelSource: safeSource,
          aiProvider: safeSource,
          providerConfig: { ...preset, baseUrl, defaultModel: model || preset.defaultModel },
        });
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
        // 仅记录检测到的服务商，不覆盖用户已选的模型与来源
        set({ detectedProviders: types });
      },

      getEffectiveConfig: () => {
        const state = get();
        return {
          ...state.providerConfig,
          baseUrl: state.customBaseUrls[state.aiProvider] || state.providerConfig.baseUrl,
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
          baseUrl: state.customBaseUrls[source] || preset.baseUrl,
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
          baseUrl: state.customBaseUrls[source] || preset.baseUrl,
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
          customModel: '',
          apiKey: '',
          // 切换服务商时，已选模型的来源同步为当前服务商，避免显示陈旧来源 tag 且路由到错误地址
          visionModelSource: type,
          chatModelSource: type,
        });
      },
    }),
    {
      name: PERSIST_KEY,
      partialize: (state) => ({
        aiProvider: state.aiProvider,
        customBaseUrls: state.customBaseUrls,
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
