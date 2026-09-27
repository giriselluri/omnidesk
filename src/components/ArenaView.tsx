import React, { useState, useEffect } from 'react';
import {
  Swords,
  Trophy,
  Sparkles,
  Zap,
  Eye,
  EyeOff,
  ThumbsUp,
  RotateCcw,
  CheckCircle2,
  Clock,
  Send,
  Layers,
  BarChart,
  HelpCircle,
} from 'lucide-react';
import { marked } from 'marked';
import type { ModelInfo, ArenaComparison, LeaderboardEntry } from '../../shared/types.js';
import { api } from '../api/client.js';

interface ArenaViewProps {
  models: ModelInfo[];
}

export const ArenaView: React.FC<ArenaViewProps> = ({ models }) => {
  const [activeTab, setActiveTab] = useState<'arena' | 'leaderboard'>('arena');

  // Comparison Setup
  const [selectedModelKeys, setSelectedModelKeys] = useState<string[]>([
    'gemini-3.8-flash',
    'claude-3-7-sonnet',
  ]);
  const [promptInput, setPromptInput] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isBlind, setIsBlind] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [currentComparison, setCurrentComparison] = useState<ArenaComparison | null>(null);
  const [votedWinner, setVotedWinner] = useState<string | null>(null);

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    api.getLeaderboard().then(setLeaderboard).catch(console.error);
  }, []);

  const toggleModelSelection = (mKey: string) => {
    if (selectedModelKeys.includes(mKey)) {
      if (selectedModelKeys.length > 2) {
        setSelectedModelKeys(selectedModelKeys.filter((k) => k !== mKey));
      }
    } else {
      if (selectedModelKeys.length < 4) {
        setSelectedModelKeys([...selectedModelKeys, mKey]);
      }
    }
  };

  const handleRunComparison = async (promptToRun?: string) => {
    const text = promptToRun || promptInput;
    if (!text.trim() || isRunning) return;

    setIsRunning(true);
    setVotedWinner(null);

    try {
      const comp = await api.compareModels({
        prompt: text.trim(),
        systemPrompt: systemPrompt.trim() || undefined,
        modelIds: selectedModelKeys,
        isBlind,
      });
      setCurrentComparison(comp);
    } catch (err: any) {
      alert(err.message || 'Comparison failed');
    } finally {
      setIsRunning(false);
    }
  };

  const handleVote = async (modelId: string) => {
    if (!currentComparison) return;
    try {
      const res = await api.voteArenaWinner(currentComparison.id, modelId);
      setVotedWinner(modelId);
      setLeaderboard(res.leaderboard);
    } catch (err: any) {
      alert(err.message || 'Failed to submit vote');
    }
  };

  const renderMarkdown = (content: string) => {
    try {
      return { __html: marked.parse(content) as string };
    } catch {
      return { __html: content };
    }
  };

  const samplePrompts = [
    {
      title: 'Nuanced Reasoning & Logic',
      prompt: 'A room has 3 switches outside that control 3 light bulbs inside. You can only enter the room once. How can you determine with certainty which switch controls which bulb?',
    },
    {
      title: 'Code Architecture Refactoring',
      prompt: 'Refactor this JavaScript snippet to be thread-safe, handle uncaught rejections gracefully, and adhere to clean async/await patterns without memory leaks.',
    },
    {
      title: 'System Design Benchmark',
      prompt: 'Design an end-to-end evaluation harness for LLM agents that includes pre-flight latency estimation, sandboxed tool validation, and automated assertion scoring.',
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0f17] overflow-y-auto">
      <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                <Swords className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                Model Evaluation Arena
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/40 font-mono font-medium">
                100% Free Version
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Broadcast prompts to multiple models simultaneously. Compare latency, throughput, and blind quality side-by-side.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('arena')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                activeTab === 'arena'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Swords className="w-3.5 h-3.5" />
              <span>Side-by-Side Arena</span>
            </button>

            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                activeTab === 'leaderboard'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Arena Leaderboard</span>
            </button>
          </div>
        </div>

        {/* TAB 1: ARENA RUNNER */}
        {activeTab === 'arena' && (
          <div className="space-y-6">
            {/* Model Selection & Controls Bar */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-400">
                    Active Arena Contenders (Choose 2-4):
                  </span>
                </div>

                <button
                  onClick={() => setIsBlind(!isBlind)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isBlind
                      ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                  title="Hide model names during testing to prevent brand bias"
                >
                  {isBlind ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>Blind Evaluation: {isBlind ? 'ON (Masked)' : 'OFF'}</span>
                </button>
              </div>

              {/* Models Chips */}
              <div className="flex flex-wrap gap-2">
                {models.map((m) => {
                  const isSelected = selectedModelKeys.includes(m.model_key);
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleModelSelection(m.model_key)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-2 ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      <span className="capitalize">{m.display_name}</span>
                      {isSelected && <span className="text-[10px] text-blue-200">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Prompt Input Box */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-slate-300">Prompt Broadcast Input</span>
                <span className="text-[11px] text-emerald-400">
                  Broadcasts in parallel to {selectedModelKeys.length} models
                </span>
              </div>

              <textarea
                rows={3}
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder="Type a benchmark query or challenge prompt to evaluate models side-by-side..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-blue-500 resize-none font-sans"
              />

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                {/* Presets */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-500">Presets:</span>
                  {samplePrompts.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setPromptInput(p.prompt);
                        handleRunComparison(p.prompt);
                      }}
                      className="px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-400 hover:text-blue-400 transition-colors"
                    >
                      {p.title}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => handleRunComparison()}
                  disabled={isRunning || !promptInput.trim()}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white text-xs font-semibold shadow-lg shadow-blue-600/20 transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isRunning ? 'Evaluating...' : 'Run Arena Comparison'}</span>
                </button>
              </div>
            </div>

            {/* Side-by-Side Results Grid */}
            {currentComparison && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold uppercase tracking-wider text-slate-300">
                    Arena Responses ({selectedModelKeys.length} Contenders)
                  </span>
                  {votedWinner && (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Vote recorded! Leaderboard updated.
                    </span>
                  )}
                </div>

                <div
                  className={`grid gap-4 ${
                    selectedModelKeys.length === 2
                      ? 'grid-cols-1 md:grid-cols-2'
                      : selectedModelKeys.length === 3
                      ? 'grid-cols-1 md:grid-cols-3'
                      : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
                  }`}
                >
                  {selectedModelKeys.map((mKey, idx) => {
                    const res = currentComparison.results[mKey];
                    const isWinner = votedWinner === mKey;
                    const modelLetter = String.fromCharCode(65 + idx); // A, B, C, D
                    const displayName = isBlind && !votedWinner ? `Model ${modelLetter}` : res?.modelName || mKey;

                    return (
                      <div
                        key={mKey}
                        className={`p-5 rounded-2xl bg-slate-900/90 border flex flex-col justify-between transition-all ${
                          isWinner
                            ? 'border-emerald-500 shadow-xl shadow-emerald-500/10'
                            : 'border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          {/* Card Header */}
                          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                            <div>
                              <div className="font-bold text-sm text-white flex items-center gap-2">
                                <span>{displayName}</span>
                                {isWinner && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                                    Voted Best
                                  </span>
                                )}
                              </div>
                              {res && (
                                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-1">
                                  <span className="flex items-center gap-1 text-amber-400">
                                    <Clock className="w-3 h-3" />
                                    {res.latencyMs}ms
                                  </span>
                                  <span>·</span>
                                  <span>{res.tokens} tokens</span>
                                </div>
                              )}
                            </div>

                            <button
                              onClick={() => handleVote(mKey)}
                              disabled={Boolean(votedWinner)}
                              className={`p-2 rounded-xl transition-all flex items-center gap-1 text-xs font-medium ${
                                isWinner
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
                              }`}
                              title="Vote this response as best"
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Vote</span>
                            </button>
                          </div>

                          {/* Response Text */}
                          <div className="text-xs text-slate-200 leading-relaxed max-h-96 overflow-y-auto pr-1">
                            {res?.status === 'streaming' && (
                              <div className="flex items-center gap-2 text-slate-400 py-6">
                                <Sparkles className="w-4 h-4 text-blue-400 animate-spin" />
                                <span>Generating response...</span>
                              </div>
                            )}
                            {res?.status === 'completed' && (
                              <div
                                className="markdown-body"
                                dangerouslySetInnerHTML={renderMarkdown(res.output)}
                              />
                            )}
                            {res?.status === 'error' && (
                              <div className="text-red-400 py-4 text-xs font-mono">
                                {res.error || 'Execution failed'}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Footer info */}
                        <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                          <span className="font-mono text-slate-400">
                            {isBlind && !votedWinner ? 'Identity hidden' : res?.provider?.toUpperCase()}
                          </span>
                          <span className="text-emerald-400 font-medium">Free Tier</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ARENA LEADERBOARD */}
        {activeTab === 'leaderboard' && (
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  Global Arena Rankings & ELO Scoreboard
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Rankings dynamically recalculate with every blind vote cast in the arena.
                </p>
              </div>
              <span className="text-xs text-emerald-400 font-mono">
                100% Free Open Benchmark
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 text-slate-400 font-medium">
                  <tr>
                    <th className="py-3 px-3">Rank</th>
                    <th className="py-3 px-3">Model</th>
                    <th className="py-3 px-3">Provider</th>
                    <th className="py-3 px-3 font-mono">Arena ELO</th>
                    <th className="py-3 px-3 font-mono">Win Rate</th>
                    <th className="py-3 px-3 font-mono">Avg Latency</th>
                    <th className="py-3 px-3">Matches</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {leaderboard.map((item, idx) => (
                    <tr key={item.modelId} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 font-bold">
                        {idx === 0 ? (
                          <span className="text-amber-400 flex items-center gap-1">🥇 1</span>
                        ) : idx === 1 ? (
                          <span className="text-slate-300 flex items-center gap-1">🥈 2</span>
                        ) : idx === 2 ? (
                          <span className="text-amber-600 flex items-center gap-1">🥉 3</span>
                        ) : (
                          <span className="text-slate-500 font-mono ml-1">{idx + 1}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-semibold text-white">
                        {item.modelName}
                      </td>
                      <td className="py-3 px-3 font-mono capitalize text-slate-400">
                        {item.provider}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-amber-400">
                        {item.eloRating}
                      </td>
                      <td className="py-3 px-3 font-mono text-emerald-400 font-semibold">
                        {item.winRate}%
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-400">
                        {item.avgLatencyMs} ms
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-400">
                        {item.matches}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
