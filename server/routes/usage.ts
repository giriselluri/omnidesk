import { Router } from 'express';
import { db } from '../db.js';
import { authMiddleware } from '../middleware.js';
import type { ProviderId, UsageSummary } from '../../shared/types.js';

const router = Router();
router.use(authMiddleware);

// Get current user usage summary & remaining quota
router.get('/me', (req, res) => {
  const userId = req.user!.id;
  const userAllowance = db.userQuotaOverrides.get(userId) ?? db.budgetConfig.member_monthly_allowance_micro_usd;
  const userCurrentUsage = db.getUserCurrentMonthUsage(userId);
  const userActiveReserved = db.getUserActiveReserved(userId);

  const groupBudget = db.budgetConfig.group_monthly_budget_micro_usd;
  const groupCurrentUsage = db.getGroupCurrentMonthUsage();

  const userEvents = db.usageEvents.filter((e) => e.user_id === userId);
  const totalTokens = userEvents.reduce((acc, curr) => acc + curr.input_tokens + curr.output_tokens, 0);

  const providerBreakdown: Record<ProviderId, { micro_usd: number; tokens: number; requests: number }> = {
    google: { micro_usd: 0, tokens: 0, requests: 0 },
    openai: { micro_usd: 0, tokens: 0, requests: 0 },
    anthropic: { micro_usd: 0, tokens: 0, requests: 0 },
    xai: { micro_usd: 0, tokens: 0, requests: 0 },
  };

  for (const e of userEvents) {
    if (providerBreakdown[e.provider]) {
      providerBreakdown[e.provider].micro_usd += e.actual_micro_usd;
      providerBreakdown[e.provider].tokens += e.input_tokens + e.output_tokens;
      providerBreakdown[e.provider].requests += 1;
    }
  }

  const remaining = Math.max(0, userAllowance - userCurrentUsage - userActiveReserved);

  const summary: UsageSummary = {
    user_id: userId,
    current_month_micro_usd: userCurrentUsage,
    limit_micro_usd: userAllowance,
    remaining_micro_usd: remaining,
    group_monthly_budget_micro_usd: groupBudget,
    group_current_month_micro_usd: groupCurrentUsage,
    total_tokens: totalTokens,
    request_count: userEvents.length,
    provider_breakdown: providerBreakdown,
  };

  res.json(summary);
});

// Get user usage history events
router.get('/me/history', (req, res) => {
  const userId = req.user!.id;
  const events = db.usageEvents
    .filter((e) => e.user_id === userId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 50);

  res.json(events);
});

export default router;
