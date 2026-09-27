import React, { useState } from 'react';
import {
  Sparkles,
  ChevronDown,
  Globe,
  Database,
  Shield,
  Coins,
  Search,
} from 'lucide-react';
import type { ModelInfo, User, UsageSummary } from '../../shared/types.js';

interface HeaderProps {
  currentView: string;
  currentUser: User | null;
  selectedModel: ModelInfo | null;
  models: ModelInfo[];
  onSelectModel: (model: ModelInfo) => void;
  webSearchEnabled: boolean;
  onToggleWebSearch: () => void;
  knowledgeBaseEnabled: boolean;
  onToggleKnowledgeBase: () => void;
  usageSummary: UsageSummary | null;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  currentUser,
  selectedModel,
  models,
  onSelectModel,
  webSearchEnabled,
  onToggleWebSearch,
  knowledgeBaseEnabled,
  onToggleKnowledgeBase,
  usageSummary,
}) => {
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  const getProviderIconColor = (provider: string) => {
    switch (provider) {
      case 'google':
        return 'text-blue-400';
      case 'openai':
        return 'text-emerald-400';
      case 'anthropic':
        return 'text-amber-400';
      case 'xai':
        return 'text-purple-400';
      default:
        return 'text-slate-400';
    }
  };

  const remainingCredits = usageSummary ? Math.round(usageSummary.remaining_micro_usd / 100).toLocaleString() : '100,000';
  const allowanceCredits = usageSummary ? Math.round(usageSummary.limit_micro_usd / 100).toLocaleString() : '100,000';

  return (
    <header className="h-14 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-4 flex items-center justify-between z-20 sticky top-0">
      {/* Left: View title or active model switcher */}
      <div className="flex items-center gap-3">
        {currentView === 'chat' && (
          <div className="relative">
            <button
              onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/80 hover:border-slate-600 transition-all text-sm font-medium text-slate-200"
              aria-expanded={modelDropdownOpen}
              aria-haspopup="true"
            >
              <span className={`w-2 h-2 rounded-full ${selectedModel?.provider === 'google' ? 'bg-blue-400' : selectedModel?.provider === 'openai' ? 'bg-emerald-400' : selectedModel?.provider === 'anthropic' ? 'bg-amber-400' : 'bg-purple-400'}`} />
              <span>{selectedModel?.display_name || 'Select Model'}</span>
              <span className="text-[11px] text-emerald-400 font-normal bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/40">
                Free
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
            </button>

            {modelDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setModelDropdownOpen(false)}
                />
                <div className="absolute left-0 mt-1.5 w-80 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-2 z-40 space-y-1">
                  <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Frontier Models</span>
                    <span className="text-[10px] text-emerald-400 lowercase">100% free version</span>
                  </div>
                  {models.map((m) => {
                    const isSelected = selectedModel?.id === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => {
                          onSelectModel(m);
                          setModelDropdownOpen(false);
                        }}
                        className={`w-full text-left p-2.5 rounded-lg transition-all flex items-start justify-between ${
                          isSelected
                            ? 'bg-blue-600/15 border border-blue-500/30 text-white'
                            : 'hover:bg-slate-800/70 text-slate-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2 font-medium text-sm">
                            <span className={getProviderIconColor(m.provider)}>●</span>
                            <span>{m.display_name}</span>
                            {m.badge && (
                              <span className="text-[10px] text-emerald-400 font-normal">
                                {m.badge}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                            {m.description}
                          </div>
                        </div>
                        <div className="text-[10px] text-emerald-400 font-mono whitespace-nowrap ml-2">
                          Free
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {currentView !== 'chat' && (
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-slate-200 capitalize">
              {currentView === 'arena'
                ? 'Model Evaluation Arena'
                : currentView === 'evals'
                ? 'AI Evals & Prompt Workbench'
                : currentView === 'kb'
                ? 'Knowledge Base (RAG)'
                : currentView === 'gmail'
                ? 'Gmail Assistant'
                : currentView === 'usage'
                ? 'Free Credits & Usage'
                : 'Admin & Governance'}
            </h1>
          </div>
        )}
      </div>

      {/* Right: Quick Context Controls & Free Quota Pill */}
      <div className="flex items-center gap-3">
        {currentView === 'chat' && (
          <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-lg border border-slate-800">
            <button
              onClick={onToggleKnowledgeBase}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                knowledgeBaseEnabled
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title="Ground model responses in uploaded Knowledge Base docs"
            >
              <Database className="w-3.5 h-3.5" />
              <span>RAG Grounding</span>
            </button>

            <button
              onClick={onToggleWebSearch}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                webSearchEnabled
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title="Search live web sources to back answer"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Web Search</span>
            </button>
          </div>
        )}

        {/* Free Credits indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
          <Coins className="w-3.5 h-3.5 text-amber-400" />
          <div className="text-slate-300">
            <span className="font-semibold text-emerald-400">{remainingCredits}</span>
            <span className="text-slate-500 font-normal"> / {allowanceCredits} free credits</span>
          </div>
        </div>

        {/* Free Edition tag */}
        <div className="hidden md:flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-800/40 text-[10px] text-emerald-300 font-medium">
          Free Edition
        </div>

        {/* Role badge */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Shield className={`w-3.5 h-3.5 ${currentUser?.role === 'owner' ? 'text-amber-400' : 'text-blue-400'}`} />
          <span className="capitalize font-medium text-slate-300">{currentUser?.role}</span>
        </div>
      </div>
    </header>
  );
};
