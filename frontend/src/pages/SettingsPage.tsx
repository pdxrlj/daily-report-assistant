import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Settings,
  Cpu,
  RefreshCw,
  AlertCircle,
  Wifi,
  WifiOff,
  Camera,
  Sun,
  Moon,
} from 'lucide-react';
import { useSettingsStore } from '../stores/settingsStore';
import type { AIProviderType, ModelInfo } from '../types/ai';
import { PROVIDER_PRESETS } from '../types/ai';
import { listAllProviderModels, type ProviderModelsResult } from '../services/aiProvider';

const PROVIDER_ORDER: AIProviderType[] = ['ollama', 'lmstudio', 'openai'];

// 服务商标识：仅用小色点区分
const PROVIDER_DOT: Record<AIProviderType, string> = {
  ollama: 'bg-amber-500',
  lmstudio: 'bg-indigo-500',
  openai: 'bg-emerald-500',
};

/** 将原始网络/HTTP 错误精简为用户友好的短提示 */
function simplifyError(raw: string | undefined): string {
  if (!raw) return '连接失败';
  const lower = raw.toLowerCase();
  if (lower.includes('error sending request') || lower.includes('connection') || lower.includes('refused') || lower.includes('timeout')) {
    return '无法连接，请确认服务已启动';
  }
  if (lower.includes('http 401') || lower.includes('401')) return 'API Key 无效';
  if (lower.includes('http 403') || lower.includes('403')) return '访问被拒绝';
  if (lower.includes('http 429') || lower.includes('429')) return '请求过于频繁';
  if (lower.match(/http\s*4\d{2}/)) return '客户端请求错误';
  if (lower.match(/http\s*5\d{2}/)) return '服务端暂时不可用';
  // 超过 60 字的截断
  return raw.length > 60 ? raw.slice(0, 57) + '...' : raw;
}

const UnifiedModelList: React.FC<{
  models: ModelInfo[];
  visionModel: string;
  chatModel: string;
  onPickVision: (name: string, source: AIProviderType) => void;
  onPickChat: (name: string, source: AIProviderType) => void;
}> = ({ models, visionModel, chatModel, onPickVision, onPickChat }) => {
  if (models.length === 0) {
    return (
      <p className="text-sm text-gray-400 mt-2">
        暂无可用模型。请确认各服务商已启动并加载模型，然后点击上方「刷新模型」。
      </p>
    );
  }
  return (
    <div className="mt-3 space-y-2">
      {models.map((m) => {
        const isVision = visionModel === m.name;
        const isChat = chatModel === m.name;
        const source = m.source || 'ollama';
        return (
          <div
            key={`${source}:${m.name}`}
            className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-sm transition-all ${
              isVision
                ? 'border-green-300 bg-green-50/50 dark:border-green-700 dark:bg-green-900/20'
                : isChat
                  ? 'border-blue-300 bg-blue-50/50 dark:border-blue-700 dark:bg-blue-900/20'
                  : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PROVIDER_DOT[source]}`} />
              <span className="font-medium text-gray-900 dark:text-gray-100 truncate" title={m.name}>
                {m.name}
              </span>
              {m.isVision && (
                <span className="px-1.5 py-0.5 text-[10px] rounded bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                  视觉
                </span>
              )}
              {m.supportsTools && (
                <span className="px-1.5 py-0.5 text-[10px] rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  工具
                </span>
              )}
              <span className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0">
                {PROVIDER_PRESETS[source].label}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  try {
                    onPickVision(m.name, source);
                  } catch (err) {
                    console.error('选择截图分析模型失败:', err);
                  }
                }}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  isVision
                    ? 'bg-green-500 text-white border-green-500'
                    : 'border-gray-300 text-gray-600 hover:border-green-500 hover:text-green-600 hover:bg-green-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-green-900/20'
                }`}
              >
                {isVision ? '✓ 截图分析' : '设为截图分析'}
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    onPickChat(m.name, source);
                  } catch (err) {
                    console.error('选择对话模型失败:', err);
                  }
                }}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  isChat
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'border-gray-300 text-gray-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-blue-900/20'
                }`}
              >
                {isChat ? '✓ 对话' : '设为对话'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const SettingsPage: React.FC = () => {
  const {
    customBaseUrls,
    visionModel,
    chatModel,
    visionModelSource,
    chatModelSource,
    apiKey,
    autoDetect,
    autoCapture,
    captureInterval,
    theme,
    setTheme,
    detectedProviders,
    setCustomBaseUrl,
    setVisionModel,
    setChatModel,
    setApiKey,
    setAutoDetect,
    setAutoCapture,
    setCaptureInterval,
    runDetection,
  } = useSettingsStore();

  const [providerResults, setProviderResults] = useState<ProviderModelsResult[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // 聚合所有服务商的可用模型为一个统一列表（带来源）
  const allModels = useMemo(
    () => providerResults.filter((p) => p.available).flatMap((p) => p.models),
    [providerResults],
  );

  const loadModels = useCallback(async () => {
    setLoadingModels(true);
    setRefreshError(null);
    try {
      const overrides = PROVIDER_ORDER.reduce((acc, type) => {
        acc[type] = {
          baseUrl: customBaseUrls[type] || undefined,
          apiKey: type === 'openai' ? apiKey || undefined : undefined,
        };
        return acc;
      }, {} as Record<AIProviderType, { baseUrl?: string; apiKey?: string }>);
      const results = await listAllProviderModels(overrides);
      setProviderResults(results);
      // 检查是否所有服务商都失败
      const allFailed = results.every((r) => !r.available);
      if (allFailed && results.length > 0) {
        const errors = results.map((r) => `${r.label}: ${simplifyError(r.error)}`).join('; ');
        setRefreshError(errors);
      }
    } catch (err: any) {
      console.error('刷新模型失败:', err);
      setRefreshError(err?.message || '刷新模型时发生未知错误');
    } finally {
      setLoadingModels(false);
    }
  }, [customBaseUrls, apiKey]);

  useEffect(() => {
    if (autoDetect) {
      runDetection();
    }
    // 首次进入自动拉取一次全部模型
    void loadModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maskKey = (k: string) => (k.length <= 8 ? k : `${k.slice(0, 6)}...${k.slice(-4)}`);

  // 设置成功后短暂提示，便于确认选择是否生效
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const handlePickVision = (name: string, source: AIProviderType) => {
    try {
      setVisionModel(name, source);
      setToast(`已将「${name}」设为截图分析模型`);
    } catch (err) {
      console.error('选择截图分析模型失败:', err);
      setToast('设置失败，请查看控制台');
    }
  };

  const handlePickChat = (name: string, source: AIProviderType) => {
    try {
      console.log('[设置] 选择对话模型:', name, '来源:', source);
      setChatModel(name, source);
      setToast(`已将「${name}」设为对话模型`);
    } catch (err) {
      console.error('选择对话模型失败:', err);
      setToast('设置失败，请查看控制台');
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-gray-900/90 text-white text-sm rounded-lg shadow-lg">
          {toast}
        </div>
      )}
      <div className="max-w-3xl mx-auto px-8 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
            <Settings className="w-5 h-5 text-gray-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">设置</h1>
            <p className="text-sm text-gray-500">配置 AI 模型和系统参数</p>
          </div>
        </div>

        {/* 外观 / 主题 */}
        <div className="bg-white rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Sun className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">外观</h2>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">颜色主题</p>
              <p className="text-xs text-gray-500 mt-1">亮色适合白天，暗色（黑色）适合夜间保护视力</p>
            </div>
            <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
              <button
                onClick={() => setTheme('light')}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm ${theme === 'light' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                <Sun className="w-4 h-4" />
                亮色
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm border-l border-gray-300 ${theme === 'dark' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                <Moon className="w-4 h-4" />
                暗色
              </button>
            </div>
          </div>
        </div>

        {/* 自动检测提示 */}
        {detectedProviders.length > 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <Wifi className="w-5 h-5 text-green-600" />
            <div className="text-sm text-green-800">
              检测到本地 AI 服务：
              {detectedProviders.map((t) => (
                <span key={t} className="font-medium ml-1">
                  {PROVIDER_PRESETS[t].label}
                </span>
              ))}
            </div>
            <button onClick={runDetection} className="ml-auto text-green-700 hover:text-green-800" title="重新检测">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <WifiOff className="w-5 h-5 text-yellow-600" />
            <div className="text-sm text-yellow-800">
              未检测到本地 AI 服务。请确保 Ollama 或 LM Studio 正在运行。
            </div>
            <button onClick={runDetection} className="ml-auto text-yellow-700 hover:text-yellow-800" title="重新检测">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* AI 模型提供商：统一模型列表，无需切换服务商 */}
        <div className="bg-white rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-gray-500" />
              <h2 className="text-lg font-semibold text-gray-900">AI 模型提供商</h2>
            </div>
            <button
              onClick={loadModels}
              disabled={loadingModels}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loadingModels ? 'animate-spin' : ''}`} />
              {loadingModels ? '刷新中...' : '刷新模型'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-5">
            下方会列出所有服务商（Ollama / LM Studio / OpenAI）中可用的模型，无需切换服务商，直接为「截图分析」和「对话」分别选择即可。
          </p>

          {/* 服务商地址配置 */}
          <div className="space-y-3 mb-6">
            {PROVIDER_ORDER.map((type) => {
              const preset = PROVIDER_PRESETS[type];
              const result = providerResults.find((p) => p.type === type);
              const status = result
                ? result.available
                  ? { ok: true, text: `${result.models.length} 个模型` }
                  : { ok: false, text: simplifyError(result.error) }
                : null;
              return (
                <div key={type} className="flex items-center gap-3">
                  <div className="w-28 flex-shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${status ? (status.ok ? 'bg-green-500' : 'bg-red-400') : 'bg-gray-300'}`} />
                      <span className="text-sm font-medium text-gray-900">{preset.label}</span>
                    </div>
                    {status && (
                      <p className={`text-[11px] mt-0.5 ${status.ok ? 'text-green-600' : 'text-red-500'}`}>
                        {status.text}
                      </p>
                    )}
                  </div>
                  <input
                    type="text"
                    value={customBaseUrls[type] || ''}
                    onChange={(e) => setCustomBaseUrl(type, e.target.value)}
                    placeholder={type === 'openai' ? 'https://api.openai.com/v1' : preset.baseUrl}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  {type === 'openai' && (
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="API Key"
                      className="w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* 已选模型概览 — 极简一行 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            <div className={`px-3 py-2.5 rounded-lg text-sm border flex items-center gap-2.5 ${visionModel ? 'border-green-300/60 bg-green-500/5 dark:border-green-400/30 dark:bg-green-500/[0.06]' : 'border-dashed border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-800'}`}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${visionModel ? PROVIDER_DOT[visionModelSource] || 'bg-green-500' : 'bg-gray-300 dark:bg-gray-500'}`} />
              {visionModel ? (
                <>
                  <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100 truncate">{visionModel}</span>
                  <span className="text-[11px] text-gray-400 flex-shrink-0">截图分析</span>
                </>
              ) : (
                <span className="text-sm text-gray-400">截图分析模型未选择</span>
              )}
            </div>
            <div className={`px-3 py-2.5 rounded-lg text-sm border flex items-center gap-2.5 ${chatModel ? 'border-blue-300/60 bg-blue-500/5 dark:border-blue-400/30 dark:bg-blue-500/[0.06]' : 'border-dashed border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-800'}`}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${chatModel ? PROVIDER_DOT[chatModelSource] || 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-500'}`} />
              {chatModel ? (
                <>
                  <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100 truncate">{chatModel}</span>
                  <span className="text-[11px] text-gray-400 flex-shrink-0">对话</span>
                </>
              ) : (
                <span className="text-sm text-gray-400">对话模型未选择</span>
              )}
            </div>
          </div>

          {/* 统一模型列表 */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">
              全部可用模型 {allModels.length > 0 && <span className="text-gray-400">（{allModels.length} 个）</span>}
            </p>
            <p className="text-xs text-gray-400 mb-2">
              点击下方模型右侧的「设为截图分析」或「设为对话」按钮，分别选择对应的模型。Ollama 模型会显示「视觉 / 工具」能力标签。
            </p>
            {refreshError && (
              <div className="mb-3 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>刷新失败：{refreshError}</span>
                </div>
              </div>
            )}
            <UnifiedModelList
              models={allModels}
              visionModel={visionModel}
              chatModel={chatModel}
              onPickVision={handlePickVision}
              onPickChat={handlePickChat}
            />
          </div>
        </div>

        {/* 自动检测设置 */}
        <div className="bg-white rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900">自动检测本地服务</h3>
              <p className="text-xs text-gray-500 mt-1">启动时自动检测 Ollama 和 LM Studio</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoDetect}
                onChange={(e) => setAutoDetect(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
            </label>
          </div>
        </div>

        {/* 自动截屏分析 */}
        <div className="bg-white rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-gray-500" />
              <h3 className="text-sm font-medium text-gray-900">自动截屏分析</h3>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoCapture}
                onChange={(e) => setAutoCapture(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
            </label>
          </div>
          <p className="text-xs text-gray-500 mb-4">定时截屏并自动分析，结果存入本地数据库。需要 AI 服务正常运行。</p>
          {autoCapture && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 whitespace-nowrap">间隔时间</span>
              <select
                value={captureInterval}
                onChange={(e) => setCaptureInterval(Number(e.target.value))}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={1}>1 分钟</option>
                <option value={3}>3 分钟</option>
                <option value={5}>5 分钟</option>
                <option value={10}>10 分钟</option>
                <option value={15}>15 分钟</option>
                <option value={30}>30 分钟</option>
              </select>
            </div>
          )}
        </div>

        {/* 系统信息 */}
        <div className="bg-white rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">系统信息</h2>
          </div>
          <div className="space-y-2 text-sm text-gray-600">
            <p className="flex items-center gap-2">
              截图分析模型:
              {visionModel ? (
                <>
                  <span className={`w-2 h-2 rounded-full ${PROVIDER_DOT[visionModelSource] || 'bg-gray-400'}`} />
                  <span className="font-medium text-gray-900">{visionModel}</span>
                  {visionModelSource && <span className="text-xs text-gray-400">({PROVIDER_PRESETS[visionModelSource].label})</span>}
                </>
              ) : (
                <span className="text-gray-400">未设置</span>
              )}
            </p>
            <p className="flex items-center gap-2">
              对话模型:
              {chatModel ? (
                <>
                  <span className={`w-2 h-2 rounded-full ${PROVIDER_DOT[chatModelSource] || 'bg-gray-400'}`} />
                  <span className="font-medium text-gray-900">{chatModel}</span>
                  {chatModelSource && <span className="text-xs text-gray-400">({PROVIDER_PRESETS[chatModelSource].label})</span>}
                </>
              ) : (
                <span className="text-gray-400">未设置</span>
              )}
            </p>
            <p>自动检测: <span className="font-medium text-gray-900">{autoDetect ? '已启用' : '已禁用'}</span></p>
            {detectedProviders.length > 0 && (
              <p>
                检测到:
                {detectedProviders.map((t) => (
                  <span key={t} className="font-medium text-green-600 ml-1">
                    {PROVIDER_PRESETS[t].label}
                  </span>
                ))}
              </p>
            )}
            {chatModelSource === 'openai' && apiKey && (
              <p>OpenAI Key: <span className="font-medium text-gray-900">{maskKey(apiKey)}</span></p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
