import React, { useState, useEffect, useCallback } from 'react';
import { Bot, Send, Loader2, Sparkles, Globe, Code, PenLine, Brain, Zap, Cpu } from 'lucide-react';
import { useSettingsStore } from '../stores/settingsStore';
import { listProviderModels } from '../services/aiProvider';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AgentAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  prompt: string;
}

const AGENT_ACTIONS: AgentAction[] = [
  { id: 'analyze', label: '分析今日工作', icon: <Brain className="w-4 h-4" />, prompt: '分析我今天的工作效率并提出改进建议' },
  { id: 'summary', label: '生成工作总结', icon: <PenLine className="w-4 h-4" />, prompt: '请为我生成一份今日工作总结' },
  { id: 'plan', label: '制定明日计划', icon: <Zap className="w-4 h-4" />, prompt: '根据我今天的工作内容，制定明天的计划' },
  { id: 'code', label: '代码审查助手', icon: <Code className="w-4 h-4" />, prompt: '请帮我分析我的编码活动并提出改进建议' },
  { id: 'web', label: '技术搜索', icon: <Globe className="w-4 h-4" />, prompt: '搜索并推荐与我当前工作相关的技术资源' },
  { id: 'insight', label: '工作洞察', icon: <Sparkles className="w-4 h-4" />, prompt: '分析我的工作模式并提供深度洞察' },
];

export const AgentPage: React.FC = () => {
  const { getEffectiveConfig, customModel, providerConfig } = useSettingsStore();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '你好！我是你的工作助手。我可以帮你分析工作数据、生成报告、提供建议。请告诉我你需要什么帮助？', timestamp: new Date() },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [modelOptions, setModelOptions] = useState<string[]>(
    providerConfig.models && providerConfig.models.length > 0 ? providerConfig.models : [],
  );
  const [selectedModel, setSelectedModel] = useState<string>(customModel || providerConfig.defaultModel || '');
  const [loadingModels, setLoadingModels] = useState(false);

  const loadModels = useCallback(async () => {
    setLoadingModels(true);
    try {
      const config = getEffectiveConfig();
      const models = await listProviderModels(config);
      const names = models.map((m) => m.name).filter(Boolean);
      setModelOptions(names);
    } catch {
      setModelOptions([]);
    } finally {
      setLoadingModels(false);
    }
  }, [getEffectiveConfig]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  // 设置页切换了模型时同步默认选中项
  useEffect(() => {
    if (customModel && customModel !== selectedModel && !modelOptions.includes(selectedModel)) {
      setSelectedModel(customModel);
    }
  }, [customModel, modelOptions, selectedModel]);

  const handleSend = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: text, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const response = await invoke<string>('agent_chat', {
        message: text,
        model: selectedModel || null,
      });
      setMessages((prev) => [...prev, { role: 'assistant', content: response, timestamp: new Date() }]);
    } catch (err: any) {
      // 非桌面端或 AI 未就绪：回退到示例回复
      const note = err?.message ? `（AI 服务未就绪：${err.message}）\n\n` : '（演示模式）\n\n';
      setMessages((prev) => [...prev, { role: 'assistant', content: note + generateMockResponse(text), timestamp: new Date() }]);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (action: AgentAction) => {
    handleSend(action.prompt);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-8 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">接入 Agent</h1>
            <p className="text-sm text-gray-500">AI 工作助手，帮你分析和管理工作</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-8 py-4 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3 mb-4">
          <Cpu className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">对话模型</span>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 max-w-[260px]"
          >
            {modelOptions.length === 0 && (
              <option value="">{selectedModel || '默认模型'}</option>
            )}
            {modelOptions.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <button
            onClick={loadModels}
            disabled={loadingModels}
            title="刷新模型列表"
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-50"
          >
            <Loader2 className={`w-4 h-4 ${loadingModels ? 'animate-spin' : ''}`} />
          </button>
          {modelOptions.length === 0 && (
            <span className="text-xs text-gray-400">未检测到可用模型</span>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {AGENT_ACTIONS.map((action) => (
            <button
              key={action.id}
              onClick={() => handleAction(action)}
              className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm text-gray-700 whitespace-nowrap transition-colors"
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white text-sm font-medium'
                  : 'bg-gradient-to-br from-purple-500 to-pink-500'
              }`}>
                {msg.role === 'user' ? 'U' : <Bot className="w-4 h-4 text-white" />}
              </div>
              <div className={`max-w-[80%] ${
                msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-white border border-gray-200'
              } rounded-2xl px-4 py-3`}>
                <p className={`text-sm leading-relaxed ${msg.role === 'user' ? 'text-white' : 'text-gray-700'}`}>
                  {msg.content}
                </p>
                <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>
                  {msg.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="px-8 py-4 border-t border-gray-200 bg-white">
        <div className="max-w-3xl mx-auto flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
            placeholder="输入你的问题..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
          />
          <button
            onClick={() => handleSend(input)}
            disabled={!input.trim() || loading}
            className="px-4 py-3 bg-purple-500 text-white rounded-xl hover:bg-purple-600 disabled:opacity-50 transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

function generateMockResponse(input: string): string {
  if (input.includes('分析') || input.includes('效率')) {
    return '根据你的工作数据，今天的工作效率较高。建议：\n1. 上午编码时段专注度最佳\n2. 下午可安排文档类工作\n3. 每工作50分钟休息10分钟效果较好';
  }
  if (input.includes('总结') || input.includes('总结')) {
    return '今日工作总结：\n- 主要工作：前端开发（React组件编写）\n- 专注时长：约4.5小时\n- 完成进度：核心功能模块开发完成80%\n- 待办事项：还需要进行单元测试覆盖';
  }
  if (input.includes('计划') || input.includes('明天')) {
    return '明日计划建议：\n1. 上午（9:00-12:00）：完成组件单元测试\n2. 下午（14:00-16:00）：代码审查和Bug修复\n3. 下午（16:00-18:00）：文档整理和团队同步';
  }
  return '我已经收到你的问题。作为一个AI工作助手，我可以帮助你分析工作数据、生成报告、提供效率建议。请告诉我更具体的需求。';
}
