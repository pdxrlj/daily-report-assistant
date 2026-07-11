import type { AIProviderConfig, AIProviderType, ProviderStatus } from '../types/ai';
import { PROVIDER_PRESETS } from '../types/ai';
import { checkProviderHealth } from './aiProvider';

export interface DetectedProvider {
  config: AIProviderConfig;
  status: ProviderStatus;
}

export async function detectLocalProviders(): Promise<DetectedProvider[]> {
  const types: AIProviderType[] = ['ollama', 'lmstudio'];
  const results = await Promise.allSettled(
    types.map(async (type) => {
      const config = { ...PROVIDER_PRESETS[type] };
      const status = await checkProviderHealth(config);
      return { config, status };
    }),
  );

  return results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => (r as PromiseFulfilledResult<DetectedProvider>).value)
    .filter((r) => r.status.available);
}

export async function detectAllProviders(): Promise<DetectedProvider[]> {
  const local = await detectLocalProviders();

  const openAIConfig = { ...PROVIDER_PRESETS.openai };
  const openAIStatus = await checkProviderHealth(openAIConfig);
  if (openAIStatus.available) {
    local.push({ config: openAIConfig, status: openAIStatus });
  }

  return local;
}
