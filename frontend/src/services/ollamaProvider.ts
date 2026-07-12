import type { AIProviderConfig, ProviderStatus, AIAnalysisRequest, AIAnalysisResponse, ModelInfo } from '../types/ai';
import { apiUrl } from './env';

export class OllamaProvider {
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
      const models: string[] = (data.models || []).map((m: any) => m.name);
      return { available: true, models, version: data.version, latencyMs: performance.now() - start };
    } catch (err: any) {
      return { available: false, models: [], error: err.message, latencyMs: performance.now() - start };
    }
  }

  async analyze(req: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    const model = req.model || this.config.defaultModel;
    const res = await fetch(apiUrl(this.config.baseUrl, '/api/generate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: req.prompt,
        images: req.imageBase64 ? [req.imageBase64] : undefined,
        stream: false,
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama API error (${res.status}): ${text}`);
    }
    const data = await res.json();
    return { content: data.response, model: data.model };
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const res = await fetch(apiUrl(this.config.baseUrl, '/api/tags'), {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return [];
      const data = await res.json();
      const rawModels: any[] = data.models || [];
      const result: ModelInfo[] = [];

      for (const m of rawModels) {
        const name: string = m.name;
        let isVision: boolean | undefined;
        let supportsTools: boolean | undefined;

        // /api/tags 已返回 capabilities（vision / tools / embedding 等），优先使用，
        // 避免逐个调用会 500 的 /api/show 导致能力丢失
        const listCaps: string[] = (m.capabilities || []).map((c: string) => String(c).toLowerCase());
        isVision = listCaps.includes('vision') || undefined;
        supportsTools = listCaps.includes('tools') || undefined;

        // 仅当 /api/tags 未返回 capabilities 时才回退调用 /api/show 补充探测。
        // 现代 Ollama 的 /api/tags 已带 capabilities，跳过 /api/show 可避免对部分模型
        // （如 gpt-oss:20b）触发 500 报错，也省去逐个请求的耗时。
        if (listCaps.length === 0) {
          try {
            const showRes = await fetch(apiUrl(this.config.baseUrl, '/api/show'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ model: name }),
              signal: AbortSignal.timeout(3000),
            });
            if (showRes.ok) {
              const showData = await showRes.json();
              const showCaps: string[] = (showData.capabilities || []).map((c: string) => String(c).toLowerCase());
              const hasProjector = !!showData.projector_info && showData.projector_info !== '';
              isVision = isVision || showCaps.includes('vision') || hasProjector || undefined;
              supportsTools = supportsTools || showCaps.includes('tools') || undefined;
            }
          } catch {
            // 单个模型探测失败，沿用 /api/tags 中的能力信息
          }
        }

        result.push({
          name,
          size: this.formatSize(m.size),
          modifiedAt: m.modified_at,
          isVision,
          supportsTools,
        });
      }
      return result;
    } catch {
      return [];
    }
  }

  private formatSize(bytes: number): string {
    if (!bytes) return '';
    const gb = bytes / 1024 / 1024 / 1024;
    return gb >= 1 ? `${gb.toFixed(1)}GB` : `${(bytes / 1024 / 1024).toFixed(0)}MB`;
  }
}
