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
      return (data.models || []).map((m: any) => ({
        name: m.name,
        size: this.formatSize(m.size),
        modifiedAt: m.modified_at,
        isVision: /vl|vision|e2b|multimodal/i.test(m.name),
      }));
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
