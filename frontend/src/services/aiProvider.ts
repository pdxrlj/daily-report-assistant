import type { AIProviderConfig, AIAnalysisRequest, AIAnalysisResponse, ProviderStatus, ModelInfo, StructuredAnalysis, ActivityType, AIProviderType } from '../types/ai';
import { PROVIDER_PRESETS } from '../types/ai';
import { isTauri } from './env';
import { OllamaProvider } from './ollamaProvider';
import { LMStudioProvider } from './lmStudioProvider';

type ProviderImpl = {
  checkStatus(): Promise<ProviderStatus>;
  analyze(req: AIAnalysisRequest): Promise<AIAnalysisResponse>;
  listModels(): Promise<ModelInfo[]>;
};

const instances = new Map<string, ProviderImpl>();

function createProvider(config: AIProviderConfig): ProviderImpl {
  const key = `${config.type}:${config.baseUrl}`;
  const existing = instances.get(key);
  if (existing) return existing;

  let provider: ProviderImpl;
  switch (config.type) {
    case 'ollama':
      provider = new OllamaProvider(config);
      break;
    case 'lmstudio':
    case 'openai':
      provider = new LMStudioProvider(config);
      break;
    default:
      throw new Error(`Unknown provider type: ${config.type}`);
  }

  instances.set(key, provider);
  return provider;
}

export async function checkProviderHealth(config: AIProviderConfig): Promise<ProviderStatus> {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<ProviderStatus>('check_ai_status', {
        providerType: config.type,
        baseUrl: config.baseUrl,
        model: config.defaultModel,
        apiKey: config.apiKey ?? null,
      });
      return result;
    } catch (err: any) {
      return { available: false, models: [], error: err.message || 'Tauri check failed', latencyMs: 0 };
    }
  }
  const provider = createProvider(config);
  return provider.checkStatus();
}

export async function analyzeImage(
  config: AIProviderConfig,
  req: AIAnalysisRequest,
): Promise<AIAnalysisResponse> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    const result = await invoke<{
      app_name: string;
      activity_type: string;
      description: string;
      keywords: string[];
      importance_score: number;
    }>('analyze_screenshot', {
      imageBase64: req.imageBase64,
      screenshotInfo: { hash: '', id: '', width: 0, height: 0, timestamp: '', monitor_name: '' },
      model: config.defaultModel || null,
      providerType: config.type,
      baseUrl: config.baseUrl || null,
      apiKey: config.apiKey ?? null,
    });
    // 后端 analyze_screenshot 直接返回结构化字段，这里重组为 content 供 parseAnalysisResult 复用
    const content = JSON.stringify({
      app_name: result.app_name,
      activity_type: result.activity_type,
      description: result.description,
      keywords: result.keywords,
      importance_score: result.importance_score,
    });
    return { content, model: result.app_name };
  }
  const provider = createProvider(config);
  return provider.analyze(req);
}

export async function listProviderModels(config: AIProviderConfig): Promise<ModelInfo[]> {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<Array<Record<string, any>>>('list_provider_models', {
        providerType: config.type,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey ?? null,
      });
      return result.map((m) => ({
        name: m.name,
        size: m.size,
        isVision: m.isVision ?? undefined,
        supportsTools: m.supportsTools ?? undefined,
      }));
    } catch (err: any) {
      throw new Error('模型列表获取失败：' + (err?.message || err));
    }
  }
  const provider = createProvider(config);
  return provider.listModels();
}

export interface ProviderModelsResult {
  type: AIProviderType;
  label: string;
  available: boolean;
  baseUrl: string;
  models: ModelInfo[];
  error?: string;
}

export type ProviderOverrides = Partial<
  Record<AIProviderType, { baseUrl?: string; apiKey?: string }>
>;

/**
 * 并行拉取所有服务商（Ollama / LM Studio / OpenAI）的可用模型，
 * 聚合为一个带来源(source)的统一列表，供 UI 无需切换服务商即可选择。
 */
export async function listAllProviderModels(
  overrides: ProviderOverrides = {},
): Promise<ProviderModelsResult[]> {
  const types: AIProviderType[] = ['ollama', 'lmstudio', 'openai'];

  const settled = await Promise.allSettled(
    types.map(async (type) => {
      const preset = PROVIDER_PRESETS[type];
      const ov = overrides[type] || {};
      // OpenAI 未配置 Key 时直接跳过，避免无意义的 401 报错
      if (type === 'openai' && !ov.apiKey && !preset.apiKey) {
        return {
          type,
          label: preset.label,
          available: false,
          baseUrl: ov.baseUrl || preset.baseUrl,
          models: [],
          error: '未配置 API Key',
        } as ProviderModelsResult;
      }
      const config: AIProviderConfig = {
        ...preset,
        baseUrl: ov.baseUrl || preset.baseUrl,
        apiKey: ov.apiKey ?? preset.apiKey,
      };
      const models = await listProviderModels(config);
      return {
        type,
        label: preset.label,
        available: true,
        baseUrl: config.baseUrl,
        models: models.map((m) => ({ ...m, source: type })),
      } as ProviderModelsResult;
    }),
  );

  return settled.map((r, i) => {
    const type = types[i];
    if (r.status === 'fulfilled') return r.value;
    return {
      type,
      label: PROVIDER_PRESETS[type].label,
      available: false,
      baseUrl: PROVIDER_PRESETS[type].baseUrl,
      models: [],
      error: (r.reason as any)?.message || '获取失败',
    } as ProviderModelsResult;
  });
}

export function generateAnalysisPrompt(): string {
  return `你是一个专业的工作内容分析助手。请仔细分析这张截图，提取以下信息并以 JSON 格式返回：

{
  "app_name": "应用程序名称",
  "activity_type": "编码类型: coding / design / communication / reading / data_analysis / writing / meeting / other",
  "description": "工作内容描述（50-100字中文）",
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "importance_score": 0.0-1.0 之间的重要性评分
}

要求：
- app_name 是完整的应用程序名称，如 "Visual Studio Code"
- activity_type 从以下选择: coding, design, communication, reading, data_analysis, writing, meeting, other
- description 用简洁的中文描述正在进行的工作
- keywords 提取 3-5 个最相关的关键词
- importance_score 基于工作复杂度：0.0-0.3 低重要性，0.3-0.6 中等，0.6-0.8 高，0.8-1.0 极高

只返回 JSON，不要包含其他文字。`;
}

export function parseAnalysisResult(raw: string): StructuredAnalysis {
  try {
    const cleaned = raw
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();
    const parsed = JSON.parse(cleaned);
    return {
      appName: parsed.app_name || '',
      activityType: (parsed.activity_type || 'other') as ActivityType,
      description: parsed.description || '',
      keywords: parsed.keywords || [],
      importanceScore: parsed.importance_score ?? 0.5,
    };
  } catch {
    return {
      appName: '',
      activityType: 'other',
      description: raw.slice(0, 200),
      keywords: [],
      importanceScore: 0.5,
    };
  }
}
