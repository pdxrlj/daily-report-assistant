import type { AIProviderConfig, ProviderStatus, AIAnalysisRequest, AIAnalysisResponse, ModelInfo } from '../types/ai';
import { apiUrl } from './env';

export class LMStudioProvider {
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  async checkStatus(): Promise<ProviderStatus> {
    const start = performance.now();
    try {
      const res = await fetch(apiUrl(this.config.baseUrl, this.config.healthEndpoint), {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        return { available: false, models: [], error: `HTTP ${res.status}`, latencyMs: performance.now() - start };
      }
      const data = await res.json();
      const models: string[] = (data.data || []).map((m: any) => m.id);
      return { available: true, models, latencyMs: performance.now() - start };
    } catch (err: any) {
      return { available: false, models: [], error: err.message, latencyMs: performance.now() - start };
    }
  }

  async analyze(req: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    const model = req.model || this.config.defaultModel || (await this.pickBestModel());
    const res = await fetch(apiUrl(this.config.baseUrl, '/v1/chat/completions'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: req.prompt },
              ...(req.imageBase64
                ? [{ type: 'image_url', image_url: { url: `data:image/png;base64,${req.imageBase64}` } }]
                : []),
            ],
          },
        ],
        max_tokens: 1024,
        stream: false,
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LM Studio API error (${res.status}): ${text}`);
    }
    const data = await res.json();
    return {
      content: data.choices?.[0]?.message?.content || '',
      model: data.model || model,
      usage: data.usage
        ? { promptTokens: data.usage.prompt_tokens, completionTokens: data.usage.completion_tokens }
        : undefined,
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const res = await fetch(apiUrl(this.config.baseUrl, '/v1/models'), {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return [];
      const data = await res.json();
      // LM Studio / OpenAI 兼容接口无标准能力探测，不显示能力
      return (data.data || []).map((m: any) => ({
        name: m.id,
        isVision: undefined,
        supportsTools: undefined,
      }));
    } catch {
      return [];
    }
  }

  private async pickBestModel(): Promise<string> {
    const models = await this.listModels();
    // OpenAI 兼容接口无法可靠探测视觉能力，直接取第一个模型
    return models[0]?.name || '';
  }
}
