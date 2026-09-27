import { randomUUID } from 'crypto';
import { db } from './db.js';
import type { ArenaComparison, ArenaResultItem, LeaderboardEntry, ProviderId } from '../shared/types.js';
import { routeChatStream } from './providers/index.js';

class ArenaService {
  comparisons: Map<string, ArenaComparison> = new Map();
  leaderboard: Map<string, LeaderboardEntry> = new Map();

  constructor() {
    this.seedLeaderboard();
  }

  private seedLeaderboard() {
    const entries: LeaderboardEntry[] = [
      {
        modelId: 'gemini-3.8-flash',
        modelName: 'Gemini 3.8 Flash',
        provider: 'google',
        eloRating: 1284,
        winRate: 68.4,
        wins: 145,
        matches: 212,
        avgLatencyMs: 380,
        speedRank: 2,
      },
      {
        modelId: 'gemini-3.1-flash-lite',
        modelName: 'Gemini 3.1 Flash Lite',
        provider: 'google',
        eloRating: 1242,
        winRate: 61.2,
        wins: 112,
        matches: 183,
        avgLatencyMs: 195,
        speedRank: 1,
      },
      {
        modelId: 'claude-3-7-sonnet',
        modelName: 'Claude 3.7 Sonnet',
        provider: 'anthropic',
        eloRating: 1276,
        winRate: 66.8,
        wins: 135,
        matches: 202,
        avgLatencyMs: 620,
        speedRank: 5,
      },
      {
        modelId: 'gpt-4o-mini',
        modelName: 'GPT-4o mini',
        provider: 'openai',
        eloRating: 1228,
        winRate: 58.7,
        wins: 98,
        matches: 167,
        avgLatencyMs: 410,
        speedRank: 3,
      },
      {
        modelId: 'claude-3-5-haiku',
        modelName: 'Claude 3.5 Haiku',
        provider: 'anthropic',
        eloRating: 1215,
        winRate: 56.1,
        wins: 87,
        matches: 155,
        avgLatencyMs: 440,
        speedRank: 4,
      },
      {
        modelId: 'grok-2-1212',
        modelName: 'Grok 2',
        provider: 'xai',
        eloRating: 1205,
        winRate: 54.3,
        wins: 76,
        matches: 140,
        avgLatencyMs: 510,
        speedRank: 6,
      },
    ];

    for (const e of entries) {
      this.leaderboard.set(e.modelId, e);
    }
  }

  getLeaderboard(): LeaderboardEntry[] {
    return Array.from(this.leaderboard.values()).sort((a, b) => b.eloRating - a.eloRating);
  }

  async runModelStream(
    modelKey: string,
    prompt: string,
    systemPrompt?: string
  ): Promise<{ output: string; latencyMs: number; tokens: number }> {
    const model = Array.from(db.models.values()).find(
      (m) => m.model_key === modelKey || m.id === modelKey
    ) || db.models.get('google-gemini-3.8-flash')!;

    const startTime = Date.now();
    let output = '';
    let tokens = 0;

    const stream = routeChatStream({
      requestId: 'arena_' + randomUUID(),
      userId: 'arena_runner',
      provider: model.provider,
      model: model.model_key,
      messages: [
        ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
        { role: 'user' as const, content: prompt },
      ],
      maxOutputTokens: 2048,
    });

    for await (const chunk of stream) {
      if (chunk.type === 'delta' && chunk.delta) {
        output += chunk.delta;
      } else if (chunk.type === 'done') {
        tokens = chunk.outputTokens || Math.ceil(output.length / 4);
      } else if (chunk.type === 'error') {
        throw new Error(chunk.error || 'Provider stream error');
      }
    }

    const latencyMs = Date.now() - startTime;
    return { output, latencyMs, tokens: tokens || Math.ceil(output.length / 4) };
  }

  async runComparison(data: {
    prompt: string;
    systemPrompt?: string;
    modelIds: string[];
    isBlind: boolean;
  }): Promise<ArenaComparison> {
    const comparisonId = 'cmp_' + randomUUID().slice(0, 8);
    const results: Record<string, ArenaResultItem> = {};

    // Initialize items
    for (const mKey of data.modelIds) {
      const model = Array.from(db.models.values()).find(
        (m) => m.model_key === mKey || m.id === mKey
      );
      results[mKey] = {
        modelId: mKey,
        modelName: model?.display_name || mKey,
        provider: model?.provider || 'google',
        output: '',
        latencyMs: 0,
        tokens: 0,
        status: 'pending',
      };
    }

    // Execute parallel calls
    await Promise.all(
      data.modelIds.map(async (mKey) => {
        try {
          results[mKey].status = 'streaming';
          const res = await this.runModelStream(mKey, data.prompt, data.systemPrompt);
          results[mKey].output = res.output;
          results[mKey].latencyMs = res.latencyMs;
          results[mKey].tokens = res.tokens;
          results[mKey].status = 'completed';

          // Update average latency in leaderboard
          const entry = this.leaderboard.get(mKey);
          if (entry) {
            entry.avgLatencyMs = Math.round((entry.avgLatencyMs * entry.matches + res.latencyMs) / (entry.matches + 1));
            this.leaderboard.set(mKey, entry);
          }
        } catch (err: any) {
          results[mKey].status = 'error';
          results[mKey].error = err.message || 'Execution error';
          results[mKey].output = `Error: ${err.message || 'Execution failed'}`;
        }
      })
    );

    const comp: ArenaComparison = {
      id: comparisonId,
      prompt: data.prompt,
      systemPrompt: data.systemPrompt,
      isBlind: data.isBlind,
      modelIds: data.modelIds,
      results,
      created_at: new Date().toISOString(),
    };

    this.comparisons.set(comparisonId, comp);
    return comp;
  }

  voteWinner(comparisonId: string, winnerModelId: string): LeaderboardEntry[] {
    const comp = this.comparisons.get(comparisonId);
    if (!comp) throw new Error('Comparison not found');

    comp.votedWinnerModelId = winnerModelId;
    this.comparisons.set(comparisonId, comp);

    // ELO update
    for (const mId of comp.modelIds) {
      const entry = this.leaderboard.get(mId);
      if (entry) {
        entry.matches += 1;
        if (mId === winnerModelId) {
          entry.wins += 1;
          entry.eloRating += 16;
        } else {
          entry.eloRating = Math.max(1000, entry.eloRating - 12);
        }
        entry.winRate = Number(((entry.wins / entry.matches) * 100).toFixed(1));
        this.leaderboard.set(mId, entry);
      }
    }

    return this.getLeaderboard();
  }
}

export const arenaService = new ArenaService();
