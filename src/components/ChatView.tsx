import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Square,
  Globe,
  Database,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  ExternalLink,
  FileText,
  AlertCircle,
  Coins,
} from 'lucide-react';
import { marked } from 'marked';
import type {
  Conversation,
  ChatMessage,
  ModelInfo,
  Citation,
  SearchResult,
  ProviderId,
} from '../../shared/types.js';

interface ChatViewProps {
  conversation: Conversation | null;
  messages: ChatMessage[];
  selectedModel: ModelInfo | null;
  onSendMessage: (content: string) => Promise<void>;
  isStreaming: boolean;
  onStopStreaming: () => void;
  webSearchEnabled: boolean;
  onToggleWebSearch: () => void;
  knowledgeBaseEnabled: boolean;
  onToggleKnowledgeBase: () => void;
  onNewConversation: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  conversation,
  messages,
  selectedModel,
  onSendMessage,
  isStreaming,
  onStopStreaming,
  webSearchEnabled,
  onToggleWebSearch,
  knowledgeBaseEnabled,
  onToggleKnowledgeBase,
  onNewConversation,
}) => {
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Adjust textarea height automatically
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!inputText.trim() || isStreaming) return;
    const content = inputText.trim();
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    onSendMessage(content);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renderMarkdown = (content: string) => {
    try {
      return { __html: marked.parse(content) as string };
    } catch {
      return { __html: content };
    }
  };

  const getProviderColor = (provider?: ProviderId) => {
    switch (provider) {
      case 'google':
        return 'text-blue-400 bg-blue-950/60 border-blue-800/40';
      case 'openai':
        return 'text-emerald-400 bg-emerald-950/60 border-emerald-800/40';
      case 'anthropic':
        return 'text-amber-400 bg-amber-950/60 border-amber-800/40';
      case 'xai':
        return 'text-purple-400 bg-purple-950/60 border-purple-800/40';
      default:
        return 'text-slate-400 bg-slate-800 border-slate-700';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0f17] overflow-hidden">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 space-y-6 max-w-4xl mx-auto w-full">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto my-auto pt-16">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-xl shadow-blue-500/20 mb-4">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2 tracking-tight">
              What would you like to explore?
            </h2>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              OmniDesk lets you switch effortlessly between Gemini 3.8 Flash, Claude 3.7 Sonnet, GPT-4o, and Grok 2 while querying private documents and live web data.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
              {[
                {
                  title: 'Query Architecture Spec',
                  desc: 'Search pre-loaded RAG knowledge base for quota reservation rules',
                  prompt: 'Explain the 4-step atomic quota reservation and settlement workflow in OmniDesk.',
                },
                {
                  title: 'Multi-Model Comparison',
                  desc: 'Ask complex reasoning questions with citation breakdown',
                  prompt: 'Compare latency vs reasoning depth tradeoffs between Gemini 3.8 Flash and Claude 3.7 Sonnet.',
                },
                {
                  title: 'Live Web Research',
                  desc: 'Verify latest announcements with source links',
                  prompt: 'What are the newest LLM frontier releases in 2026 and their micro-pricing benchmarks?',
                },
                {
                  title: 'Enterprise Workspaces',
                  desc: 'Multi-user collaborative workspace with zero paid tiers',
                  prompt: 'How does OmniDesk provide multi-model access and document RAG in a 100% free workspace edition?',
                },
              ].map((starter, i) => (
                <button
                  key={i}
                  onClick={() => onSendMessage(starter.prompt)}
                  className="p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800/80 hover:border-slate-700 transition-all text-left group"
                >
                  <div className="text-xs font-semibold text-slate-200 group-hover:text-blue-400 transition-colors">
                    {starter.title}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                    {starter.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-md">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl ${
                    isUser
                      ? 'bg-blue-600 text-white px-4 py-3 shadow-md'
                      : 'bg-slate-900/90 border border-slate-800/90 text-slate-200 px-5 py-4 shadow-lg'
                  }`}
                >
                  {/* Assistant Attribution Header */}
                  {!isUser && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-800 text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md border text-[11px] font-mono font-medium ${getProviderColor(
                            msg.provider
                          )}`}
                        >
                          {msg.model_name || msg.model_key || 'AI Assistant'}
                        </span>
                        <span className="text-emerald-400 text-[11px] font-mono">
                          Free
                        </span>
                        {msg.output_tokens !== undefined && (
                          <span className="text-slate-400 text-[11px]">
                            · {msg.output_tokens} tokens
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => copyToClipboard(msg.content, msg.id)}
                        className="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded hover:bg-slate-800"
                        title="Copy response"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  )}

                  {/* Web Search Sources Cards */}
                  {!isUser && msg.search_results && msg.search_results.length > 0 && (
                    <div className="mb-3 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Globe className="w-3 h-3 text-indigo-400" />
                        Web Sources Referenced ({msg.search_results.length})
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {msg.search_results.map((src, idx) => (
                          <a
                            key={idx}
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800/80 transition-colors block text-left"
                          >
                            <div className="text-xs font-medium text-blue-400 truncate flex items-center justify-between">
                              <span className="truncate">{src.title}</span>
                              <ExternalLink className="w-3 h-3 text-slate-400 shrink-0 ml-1" />
                            </div>
                            <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                              {src.snippet}
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Knowledge Base Citations */}
                  {!isUser && msg.citations && msg.citations.length > 0 && (
                    <div className="mb-3 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Database className="w-3 h-3 text-blue-400" />
                        RAG Knowledge Citations ({msg.citations.length})
                      </div>
                      <div className="space-y-1.5">
                        {msg.citations.map((cite, idx) => (
                          <div
                            key={idx}
                            className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-left text-xs"
                          >
                            <div className="flex items-center justify-between text-slate-300 font-medium mb-1">
                              <div className="flex items-center gap-1.5 text-blue-400 truncate">
                                <FileText className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">{cite.document_name}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">
                                Match: {Math.round(cite.score * 100)}%
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 leading-relaxed italic line-clamp-2">
                              "{cite.snippet}"
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Message Content */}
                  {isUser ? (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {msg.content}
                    </div>
                  ) : (
                    <div
                      className="markdown-body"
                      dangerouslySetInnerHTML={renderMarkdown(msg.content)}
                    />
                  )}

                  {/* Streaming indicator */}
                  {msg.status === 'streaming' && (
                    <span className="inline-block w-2 h-4 bg-blue-400 animate-pulse ml-1 align-middle" />
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Composer Area */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto">
          {/* Active Features Status Bar */}
          <div className="flex items-center justify-between mb-2 text-xs text-slate-400">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Active Model: <strong className="text-white font-medium">{selectedModel?.display_name || 'Gemini 3.8 Flash'}</strong>
              </span>

              {knowledgeBaseEnabled && (
                <span className="flex items-center gap-1 text-blue-400">
                  <Database className="w-3 h-3" />
                  RAG Enabled
                </span>
              )}

              {webSearchEnabled && (
                <span className="flex items-center gap-1 text-indigo-400">
                  <Globe className="w-3 h-3" />
                  Web Search
                </span>
              )}
            </div>

            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-emerald-400">
              <Coins className="w-3 h-3 text-emerald-400" />
              <span>100% Free Version · No Credit Card Required</span>
            </div>
          </div>

          {/* Text Input Container */}
          <div className="relative rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl focus-within:border-blue-500/70 transition-all p-2.5">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything, switch models mid-thread, or query knowledge docs..."
              rows={1}
              className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-400 resize-none outline-none px-2 py-1 max-h-44"
              disabled={isStreaming}
            />

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 mt-1">
              {/* Quick toggles */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={onToggleKnowledgeBase}
                  className={`p-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors ${
                    knowledgeBaseEnabled
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                  title="Toggle Knowledge Base RAG"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">RAG</span>
                </button>

                <button
                  type="button"
                  onClick={onToggleWebSearch}
                  className={`p-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors ${
                    webSearchEnabled
                      ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                  title="Toggle Web Search"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Web</span>
                </button>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                {isStreaming ? (
                  <button
                    onClick={onStopStreaming}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-medium transition-colors shadow-md"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Stop</span>
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!inputText.trim()}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                      inputText.trim()
                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20'
                        : 'bg-slate-800 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <span>Send</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 mt-2 text-center">
            OmniDesk Free Workspace · Multi-model intelligence with zero paid subscriptions or paywalls.
          </div>
        </div>
      </div>
    </div>
  );
};
