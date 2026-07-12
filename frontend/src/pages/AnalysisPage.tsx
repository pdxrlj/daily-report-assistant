import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Camera,
  Loader2,
  CheckCircle2,
  XCircle,
  Image,
  Upload,
  ClipboardList,
} from 'lucide-react';
import { useSettingsStore } from '../stores/settingsStore';
import { analyzeImage, generateAnalysisPrompt, parseAnalysisResult, checkProviderHealth } from '../services/aiProvider';
import { isTauri } from '../services/env';
import type { StructuredAnalysis, ActivityType, ProviderStatus } from '../types/ai';

export const AnalysisPage: React.FC = () => {
  const { getEffectiveConfig, getVisionConfig } = useSettingsStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<StructuredAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const config = getEffectiveConfig();
        setProviderStatus(await checkProviderHealth(config));
      } catch {
        setProviderStatus(null);
      }
    };
    check();
  }, [getEffectiveConfig]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setImageBase64(base64);
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!imageBase64) return;
    setAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const config = getVisionConfig();
      const prompt = generateAnalysisPrompt();
      const response = await analyzeImage(config, {
        imageBase64,
        prompt,
      });
      const parsed = parseAnalysisResult(response.content);
      setResult(parsed);
    } catch (err: any) {
      setError(typeof err === 'string' ? err : (err?.message || '分析失败'));
    } finally {
      setAnalyzing(false);
    }
  }, [imageBase64, getEffectiveConfig]);

  // 截取当前屏幕并直接分析（仅桌面端可用），结果自动入库
  const handleCapture = useCallback(async () => {
    setAnalyzing(true);
    setError(null);
    setResult(null);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const cfg = getVisionConfig();
      const res = await invoke<{
        analysis: {
          app_name: string;
          activity_type: string;
          description: string;
          keywords: string[];
          importance_score: number;
        };
      }>('capture_and_analyze', {
        model: cfg.defaultModel || null,
        providerType: cfg.type,
        baseUrl: cfg.baseUrl || null,
        apiKey: cfg.apiKey ?? null,
      });
      const a = res.analysis;
      setResult({
        appName: a.app_name,
        activityType: a.activity_type as ActivityType,
        description: a.description,
        keywords: a.keywords,
        importanceScore: a.importance_score,
      });
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : (err?.message || '截屏分析失败');
      setError(msg);
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const activityTypeLabels: Record<string, string> = {
    coding: '编程',
    design: '设计',
    communication: '沟通',
    reading: '阅读',
    data_analysis: '数据分析',
    writing: '写作',
    meeting: '会议',
    other: '其他',
  };

  const importanceColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 0.6) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (score >= 0.3) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-gray-600 bg-gray-50 border-gray-200';
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto px-8 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
            <Camera className="w-5 h-5 text-gray-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">截图分析</h1>
            <p className="text-sm text-gray-500">上传截图，AI 自动分析工作内容</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Left: Image Upload */}
          <div className="space-y-4">
            {isTauri() && (
              <button
                onClick={handleCapture}
                disabled={analyzing || !providerStatus?.available}
                title={!providerStatus?.available ? 'AI 服务未就绪，请先在设置中启动 Ollama / LM Studio' : '截取当前屏幕并分析'}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors font-medium"
              >
                <Camera className="w-5 h-5" />
                {analyzing ? '截屏分析中...' : '截取当前屏幕并分析'}
              </button>
            )}
            {isTauri() && !providerStatus?.available && (
              <p className="text-xs text-yellow-600 bg-yellow-50 px-3 py-2 rounded-lg">
                AI 服务未就绪，无法截屏分析。请到「设置」启动 Ollama 或 LM Studio 后重试。
              </p>
            )}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                imagePreview
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400 bg-white'
              }`}
            >
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="截图预览"
                  className="max-w-full max-h-[300px] mx-auto rounded-lg"
                />
              ) : (
                <div className="py-8">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium">点击上传截图</p>
                  <p className="text-sm text-gray-400 mt-1">支持 PNG / JPG / WEBP</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {imagePreview && (
              <button
                onClick={() => {
                  setImageBase64(null);
                  setImagePreview(null);
                  setResult(null);
                  setError(null);
                }}
                className="w-full py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                重新选择
              </button>
            )}

            {imageBase64 && !analyzing && !result && (
              <button
                onClick={handleAnalyze}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors font-medium"
              >
                <Camera className="w-5 h-5" />
                开始分析
              </button>
            )}
          </div>

          {/* Right: Results */}
          <div className="space-y-4">
            {analyzing && (
              <div className="bg-white rounded-xl p-8 text-center flex flex-col items-center justify-center min-h-[420px]">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
                <p className="text-gray-600 font-medium">AI 正在分析截图...</p>
                <p className="text-sm text-gray-400 mt-1">请稍候，这可能需要几秒钟</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-center gap-2 text-red-700 font-medium mb-1">
                  <XCircle className="w-5 h-5" />
                  分析失败
                </div>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <h2 className="text-lg font-semibold text-gray-900">分析结果</h2>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">应用程序</p>
                      <p className="font-medium text-gray-900">{result.appName}</p>
                    </div>

                    <div className="flex gap-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${importanceColor(result.importanceScore)}`}>
                        {activityTypeLabels[result.activityType] || result.activityType}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${importanceColor(result.importanceScore)}`}>
                        重要性: {result.importanceScore.toFixed(1)}
                      </span>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-1">工作描述</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{result.description}</p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-1">关键词</p>
                      <div className="flex flex-wrap gap-2">
                        {result.keywords.map((kw, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <ClipboardList className="w-4 h-4" />
                        <span>分析完成</span>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setImageBase64(null);
                    setImagePreview(null);
                    setResult(null);
                    setError(null);
                  }}
                  className="w-full py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  分析新截图
                </button>
              </div>
            )}

            {!analyzing && !result && !error && (
              <div className="bg-white rounded-xl p-8 text-center flex flex-col items-center justify-center min-h-[420px]">
                <Image className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">上传截图后开始分析</p>
                <p className="text-sm text-gray-400 mt-1">支持本地 AI 模型分析</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
