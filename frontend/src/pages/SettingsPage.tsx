import React, { useEffect, useState, useCallback } from 'react';
import {
  Settings,
  Cpu,
  Network,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Wifi,
  WifiOff,
  Camera,
  Sun,
  Moon,
  Check,
} from 'lucide-react';
import { useSettingsStore } from '../stores/settingsStore';
import type { AIProviderType, ProviderStatus, ModelInfo } from '../types/ai';
import { PROVIDER_PRESETS } from '../types/ai';
import { checkProviderHealth, listProviderModels } from '../services/aiProvider';

const PROVIDER_OPTIONS: { type: AIProviderType; label: string; desc: string }[] = [
  { type: 'ollama', label: 'Ollama', desc: 'http://localhost:11434' },
  { type: 'lmstudio', label: 'LM Studio', desc: 'http://localhost:1234 (OpenAI 兼容)' },
  { type: 'openai', label: 'OpenAI API', desc: '云端 API，需要 API Key' },
];

const ModelList: React.FC<{
  models: ModelInfo[];
  selected: string;
  onSelect: (name: string) => void;
  sourceTag?: string;
}> = ({ models, selected, onSelect, sourceTag }) => {
  // 已选模型可能来自其他来源（不在当前列表），确保它始终显示
  const displayModels = models.some((m) => m.name === selected)
    ? models
    : selected
      ? [{ name: selected, size: '', isVision: undefined, supportsTools: undefined }, ...models]
      : models;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {displayModels.map((m) => {
        const active = selected === m.name;
        return (
          <button
            key={m.name}
            type="button"
            onClick={() => onSelect(m.name)}
            title={m.name}
            className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-all ${
              active
                ? 'bg-green-50 border-green-400 text-green-800 shadow-sm'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            {active && <Check className="w-3.5 h-3.5 flex-shrink-0 text-green-600" />}
            {active && sourceTag && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-gray-100 text-gray-500">
                {sourceTag}
              </span>
            )}
            <span className="truncate max-w-[180px]">{m.name}</span>
            {m.isVision && (
              <span
                className={`px-1.5 py-0.5 text-[10px] rounded-full ${
                  active ? 'bg-white/70 text-green-800' : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                视觉
              </span>
            )}
            {m.supportsTools && (
              <span
                className={`px-1.5 py-0.5 text-[10px] rounded-full ${
                  active ? 'bg-white/70 text-green-800' : 'bg-violet-100 text-violet-700'
                }`}
              >
                工具
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export const SettingsPage: React.FC = () => {
  const {
    aiProvider,
    customBaseUrl,
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
    resetToPreset,
    getEffectiveConfig,
  } = useSettingsStore();

  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [testing, setTesting] = useState(false);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  // 已选模型若来自其他来源，计算来源标签（淡灰 tag）用于区分
  const maskKey = (k: string) => (k.length <= 8 ? k : `${k.slice(0, 6)}...${k.slice(-4)}`);
  const visionSourceTag =
    visionModelSource && visionModelSource !== aiProvider ? PROVIDER_PRESETS[visionModelSource].label : '';
  const chatSourceTag =
    chatModelSource && chatModelSource !== aiProvider ? PROVIDER_PRESETS[chatModelSource].label : '';

  const loadModels = useCallback(async () => {
    setLoadingModels(true);
    try {
      const config = getEffectiveConfig();
      const result = await listProviderModels(config);
      setModels(result);
    } catch {
      setModels([]);
    } finally {
      setLoadingModels(false);
    }
  }, [getEffectiveConfig]);

  const testConnection = useCallback(async () => {
    setTesting(true);
    setStatus(null);
    try {
      const config = getEffectiveConfig();
      const result = await checkProviderHealth(config);
      setStatus(result);
      if (result.available) {
        // 测试连接成功后自动加载带能力信息的模型列表
        loadModels();
      }
    } catch (err: any) {
      setStatus({ available: false, models: [], error: err.message, latencyMs: 0 });
    } finally {
      setTesting(false);
    }
  }, [getEffectiveConfig, loadModels]);

  useEffect(() => {
    if (autoDetect) {
      runDetection();
    }
  }, []);

  const handleProviderChange = (type: AIProviderType) => {
    resetToPreset(type);
    setStatus(null);
    setModels([]);
  };

  return (
    <div className="flex-1 overflow-auto">
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

        {/* Auto-detect Banner */}
        {detectedProviders.length > 0 && (
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
            <button
              onClick={runDetection}
              className="ml-auto text-green-700 hover:text-green-800"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        )}

        {!detectedProviders.length && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <WifiOff className="w-5 h-5 text-yellow-600" />
            <div className="text-sm text-yellow-800">
              未检测到本地 AI 服务。请确保 Ollama 或 LM Studio 正在运行。
            </div>
            <button
              onClick={runDetection}
              className="ml-auto text-yellow-700 hover:text-yellow-800"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* AI Provider Selection */}
        <div className="bg-white rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-6">
            <Cpu className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">AI 模型提供商</h2>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
            {PROVIDER_OPTIONS.map((opt) => {
              const isActive = aiProvider === opt.type;
              const isDetected = detectedProviders.includes(opt.type);
              return (
                <button
                  key={opt.type}
                  onClick={() => handleProviderChange(opt.type)}
                  className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                    isActive
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  {isDetected && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    </div>
                  )}
                  <p className="font-medium text-gray-900 mb-1">{opt.label}</p>
                  <p className="text-xs text-gray-500">{opt.desc}</p>
                </button>
              );
            })}
          </div>

          {/* Provider Config */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                服务地址
              </label>
              <input
                type="text"
                value={customBaseUrl || PROVIDER_PRESETS[aiProvider].baseUrl}
                onChange={(e) => setCustomBaseUrl(e.target.value)}
                placeholder={PROVIDER_PRESETS[aiProvider].baseUrl}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {aiProvider === 'openai' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            )}

            {/* 截图分析模型（视觉模型） */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  截图分析模型 {models.length > 0 && <span className="text-gray-400">({models.length} 个可用)</span>}
                </label>
                <button
                  onClick={loadModels}
                  disabled={loadingModels}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingModels ? 'animate-spin' : ''}`} />
                  刷新列表
                </button>
              </div>
              <p className="text-xs text-gray-400 mb-2">用于分析屏幕截图，建议选择支持视觉的模型。Ollama 会显示「视觉 / 工具」能力标签，其他服务不探测能力。</p>
              <div
                className={`w-full px-3 py-2 rounded-lg text-sm border flex items-center gap-2 ${
                  visionModel
                    ? 'border-green-200 bg-green-50 text-green-800'
                    : 'border-dashed border-gray-300 bg-gray-50 text-gray-400'
                }`}
              >
                {visionModel ? (
                  <>
                    <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                    {visionSourceTag && (
                      <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-gray-100 text-gray-500">
                        {visionSourceTag}
                      </span>
                    )}
                    <span className="font-medium truncate">{visionModel}</span>
                    {visionModelSource === 'openai' && apiKey && (
                      <span className="text-gray-400 text-xs">· Key: {maskKey(apiKey)}</span>
                    )}
                  </>
                ) : (
                  <span>未选择模型，请从下方列表选择</span>
                )}
              </div>
              {models.length > 0 && (
                <div className="mt-3 pt-3 border-t border-dashed border-gray-200">
                  <ModelList models={models} selected={visionModel} onSelect={setVisionModel} sourceTag={visionSourceTag} />
                  <p className="mt-2 text-[11px] text-gray-400">
                    {aiProvider === 'ollama'
                      ? '模型能力（视觉 / 工具调用）已通过 Ollama API 自动探测'
                      : '该服务商不探测模型能力，请按模型名称手动选择'}
                  </p>
                </div>
              )}
            </div>

            {/* 对话模型 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">对话模型</label>
              <p className="text-xs text-gray-400 mb-2">用于 Agent 智能助手对话，可选择更擅长文本推理的模型</p>
              <div
                className={`w-full px-3 py-2 rounded-lg text-sm border flex items-center gap-2 ${
                  chatModel
                    ? 'border-green-200 bg-green-50 text-green-800'
                    : 'border-dashed border-gray-300 bg-gray-50 text-gray-400'
                }`}
              >
                {chatModel ? (
                  <>
                    <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                    {chatSourceTag && (
                      <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-gray-100 text-gray-500">
                        {chatSourceTag}
                      </span>
                    )}
                    <span className="font-medium truncate">{chatModel}</span>
                    {chatModelSource === 'openai' && apiKey && (
                      <span className="text-gray-400 text-xs">· Key: {maskKey(apiKey)}</span>
                    )}
                  </>
                ) : (
                  <span>未选择模型，请从下方列表选择</span>
                )}
              </div>
              {models.length > 0 && (
                <div className="mt-3 pt-3 border-t border-dashed border-gray-200">
                  <ModelList models={models} selected={chatModel} onSelect={setChatModel} sourceTag={chatSourceTag} />
                </div>
              )}
            </div>
          </div>

          {/* Test Connection */}
          <div className="mt-6 flex items-center gap-4">
            <button
              onClick={testConnection}
              disabled={testing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {testing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Network className="w-4 h-4" />
              )}
              {testing ? '测试中...' : '测试连接'}
            </button>

            {status && (
              <div className={`flex items-center gap-2 text-sm ${
                status.available ? 'text-green-600' : 'text-red-600'
              }`}>
                {status.available ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    连接成功 ({status.latencyMs.toFixed(0)}ms)
                    {status.models.length > 0 && ` · ${status.models.length} 个模型`}
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    连接失败: {status.error}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Auto-detect Settings */}
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

        {/* Auto Capture */}
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

        {/* System Info */}
        <div className="bg-white rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">系统信息</h2>
          </div>
          <div className="space-y-2 text-sm text-gray-600">
            <p>当前提供商: <span className="font-medium text-gray-900">{PROVIDER_PRESETS[aiProvider].label}</span></p>
            <p>服务地址: <span className="font-medium text-gray-900">{customBaseUrl || PROVIDER_PRESETS[aiProvider].baseUrl}</span></p>
            <p>截图分析模型: <span className="font-medium text-gray-900">{visionModel || PROVIDER_PRESETS[aiProvider].defaultModel || '未设置'}</span></p>
            <p>对话模型: <span className="font-medium text-gray-900">{chatModel || PROVIDER_PRESETS[aiProvider].defaultModel || '未设置'}</span></p>
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
          </div>
        </div>
      </div>
    </div>
  );
};
