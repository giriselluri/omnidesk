import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Coins,
  TrendingUp,
  Cpu,
  Layers,
  ShieldAlert,
  Clock,
  ArrowUpRight,
} from 'lucide-react';
import type { UsageSummary, UsageEvent } from '../../shared/types.js';
import { api } from '../api/client.js';

interface UsageViewProps {
  usageSummary: UsageSummary | null;
  onRefresh: () => void;
}

export const UsageView: React.FC<UsageViewProps> = ({ usageSummary, onRefresh }) => {
  const [history, setHistory] = useState<UsageEvent[]>([]);

  useEffect(() => {
    api.getUsageHistory().then(setHistory).catch(console.error);
  }, []);

  const userUsageCredits = usageSummary ? Math.round(usageSummary.current_month_micro_usd / 100).toLocaleString() : '0';
  const userLimitCredits = usageSummary ? Math.round(usageSummary.limit_micro_usd / 100).toLocaleString() : '100,000';
  const userPercent = usageSummary && usageSummary.limit_micro_usd > 0
    ? Math.min(100, (usageSummary.current_month_micro_usd / usageSummary.limit_micro_usd) * 100).toFixed(1)
    : '0';

  const groupUsageCredits = usageSummary ? Math.round(usageSummary.group_current_month_micro_usd / 100).toLocaleString() : '0';
  const groupBudgetCredit = usageSummary ? Math.round(usageSummary.group_monthly_budget_micro_usd / 100).toLocaleString() : '500,000';
  const groupPercent = usageSummary && usageSummary.group_monthly_budget_micro_usd > 0
    ? Math.min(100, (usageSummary.group_current_month_micro_usd / usageSummary.group_monthly_budget_micro_usd) * 100).toFixed(1)
    : '0';

  const providerNames: Record<string, string> = {
    google: 'Google Gemini',
    openai: 'OpenAI GPT',
    anthropic: 'Anthropic Claude',
    xai: 'xAI Grok',
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0f17] overflow-y-auto">
      <div className="p-6 md:p-8 max-w-5xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="border-b border-slate-800 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <BarChart3 className="w-5 h-5 text-emerald-400" />
              Free AI Credits & Usage Ledger
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              100% Free Workspace Edition. Generous monthly credit allowances with zero paid subscriptions or credit card requirements.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/40 text-xs font-mono font-medium self-start sm:self-auto">
            100% Free Version
          </span>
        </div>

        {/* Quota Progress Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Member Monthly Allowance */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider text-slate-300">
                Your Free Monthly Credits
              </span>
              <span className="font-mono text-emerald-400 font-semibold">{userPercent}% used</span>
            </div>

            <div>
              <div className="text-2xl font-bold text-white font-mono">
                {userUsageCredits}{' '}
                <span className="text-sm font-normal text-slate-400">/ {userLimitCredits} credits</span>
              </div>
              <div className="text-xs text-emerald-400 mt-0.5 font-mono">
                Free tier resets automatically every month
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  Number(userPercent) > 85 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${userPercent}%` }}
              />
            </div>
          </div>

          {/* Group Budget Progress */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider text-slate-300">
                Workspace Free Pool
              </span>
              <span className="font-mono text-blue-400 font-semibold">{groupPercent}% used</span>
            </div>

            <div>
              <div className="text-2xl font-bold text-white font-mono">
                {groupUsageCredits}{' '}
                <span className="text-sm font-normal text-slate-400">/ {groupBudgetCredit} credits</span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5 font-mono">
                Shared multi-user workspace capacity (100% free)
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-500"
                style={{ width: `${groupPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Provider Breakdown */}
        {usageSummary?.provider_breakdown && (
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Usage by Frontier Provider (All Included Free)
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(usageSummary.provider_breakdown).map(([providerKey, data]) => (
                <div
                  key={providerKey}
                  className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80"
                >
                  <div className="text-xs font-medium text-slate-300 mb-1 truncate">
                    {providerNames[providerKey] || providerKey}
                  </div>
                  <div className="text-base font-bold text-white font-mono">
                    {Math.round(data.micro_usd / 100).toLocaleString()} <span className="text-xs font-normal text-slate-400">credits</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {data.tokens.toLocaleString()} tokens · {data.requests} reqs
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Append-Only Usage Ledger Table */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Recent Activity Ledger ({history.length})
            </div>
            <span className="text-[11px] text-emerald-400 font-mono">
              Free Version
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400 font-medium">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Provider & Model</th>
                  <th className="py-2.5 px-3">Tokens (In / Out)</th>
                  <th className="py-2.5 px-3 font-mono">Credits Used</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      No usage transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  history.map((ev) => (
                    <tr key={ev.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                        {new Date(ev.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 px-3 font-medium">
                        <span className="capitalize">{ev.provider}</span> · {ev.model_key}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">
                        {ev.input_tokens} / {ev.output_tokens}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-emerald-400">
                        {Math.round(ev.actual_micro_usd / 100).toLocaleString()} credits
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 font-mono">
                          {ev.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
