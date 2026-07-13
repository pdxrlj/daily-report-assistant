export type AIProviderType = 'ollama' | 'lmstudio' | 'openai';

export interface AIProviderConfig {
  type: AIProviderType;
  label: string;
  description: string;
  baseUrl: string;
  apiKey?: string;
  defaultModel: string;
  models?: string[];
  healthEndpoint: string;
  chatEndpoint: string;
}

export const PROVIDER_PRESETS: Record<AIProviderType, AIProviderConfig> = {
  ollama: {
    type: 'ollama',
    label: 'Ollama',
    description: '本地 Ollama 服务，支持 Gemma、Qwen-VL 等视觉模型',
    baseUrl: 'http://localhost:11434',
    defaultModel: '',
    healthEndpoint: '/api/tags',
    chatEndpoint: '/api/generate',
  },
  lmstudio: {
    type: 'lmstudio',
    label: 'LM Studio',
    description: '本地 LM Studio 服务，支持 OpenAI 兼容 API',
    baseUrl: 'http://localhost:1234',
    defaultModel: '',
    apiKey: 'not-needed',
    healthEndpoint: '/v1/models',
    chatEndpoint: '/v1/chat/completions',
  },
  openai: {
    type: 'openai',
    label: 'OpenAI',
    description: 'OpenAI 云端 API 服务',
    baseUrl: 'https://api.openai.com',
    defaultModel: 'gpt-4o',
    apiKey: '',
    healthEndpoint: '/v1/models',
    chatEndpoint: '/v1/chat/completions',
  },
};

export interface ProviderStatus {
  available: boolean;
  models: string[];
  version?: string;
  error?: string;
  latencyMs: number;
}

export interface AIAnalysisRequest {
  imageBase64: string;
  prompt: string;
  model?: string;
}

export interface AIAnalysisResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface StructuredAnalysis {
  appName: string;
  activityType: ActivityType;
  description: string;
  keywords: string[];
  importanceScore: number;
}

export type ActivityType =
  | 'coding'
  | 'design'
  | 'communication'
  | 'reading'
  | 'writing'
  | 'meeting'
  | 'data_analysis'
  | 'other';

export interface ModelInfo {
  name: string;
  size?: string;
  modifiedAt?: string;
  /** 是否支持视觉（图片）。undefined = 未知/不显示 */
  isVision?: boolean;
  /** 是否支持工具调用（function calling）。undefined = 未知/不显示 */
  supportsTools?: boolean;
  /** 模型所属服务商（聚合多服务商列表时使用） */
  source?: AIProviderType;
}

export interface SystemInfo {
  totalRamGB: number;
  freeRamGB: number;
  hasGPU: boolean;
  gpuInfo?: string;
}
