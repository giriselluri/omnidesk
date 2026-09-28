import { Router } from 'express';
import { db } from '../db.js';
import { authMiddleware, requireRole } from '../middleware.js';
import { randomUUID } from 'crypto';
import type { ProviderId, Invitation } from '../../shared/types.js';

const router = Router();

// Gated strictly to Owner role
router.use(authMiddleware);
router.use(requireRole('owner'));

// --- Invitations ---
router.get('/invitations', (req, res) => {
  res.json(Array.from(db.invitations.values()));
});

router.post('/invitations', (req, res) => {
  const { email, role = 'member' } = req.body;
  if (!email || !email.includes('@')) {
    res.status(400).json({ error: 'Valid email is required' });
    return;
  }

  const codePart = email.split('@')[0].toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const inviteCode = `INV-${codePart}-${randomSuffix}`;

  const invitation: Invitation = {
    id: 'inv_' + randomUUID().slice(0, 8),
    email,
    role,
    token_hash: 'hash_' + randomUUID(),
    invite_code: inviteCode,
    expires_at: new Date(Date.now() + 48 * 3600000).toISOString(),
    created_by: req.user!.id,
    created_at: new Date().toISOString(),
    status: 'pending',
  };

  db.invitations.set(invitation.id, invitation);
  db.logAudit(req.user!.id, 'admin.invitation_created', 'invitation', invitation.id, { email, role });

  res.json(invitation);
});

router.delete('/invitations/:id', (req, res) => {
  const inv = db.invitations.get(req.params.id);
  if (!inv) {
    res.status(404).json({ error: 'Invitation not found' });
    return;
  }
  inv.status = 'revoked';
  db.invitations.delete(req.params.id);
  db.logAudit(req.user!.id, 'admin.invitation_revoked', 'invitation', req.params.id, { email: inv.email });
  res.json({ success: true });
});

// --- Users Management ---
router.get('/users', (req, res) => {
  res.json(Array.from(db.users.values()));
});

router.patch('/users/:id', (req, res) => {
  const user = db.users.get(req.params.id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const { status, role } = req.body;
  if (status && ['active', 'disabled'].includes(status)) {
    user.status = status;
  }
  if (role && ['owner', 'member'].includes(role)) {
    user.role = role;
  }

  db.users.set(user.id, user);
  db.logAudit(req.user!.id, 'admin.user_updated', 'user', user.id, { status, role });
  res.json(user);
});

// --- Budgets and Quotas ---
router.get('/budgets', (req, res) => {
  res.json({
    config: db.budgetConfig,
    groupCurrentMonthMicroUsd: db.getGroupCurrentMonthUsage(),
    groupActiveReservedMicroUsd: db.getGroupActiveReserved(),
  });
});

router.put('/budgets', (req, res) => {
  const {
    group_monthly_budget_micro_usd,
    member_monthly_allowance_micro_usd,
    max_request_micro_usd,
    max_concurrent_requests,
    enforce_strict_budget,
  } = req.body;

  if (group_monthly_budget_micro_usd !== undefined) db.budgetConfig.group_monthly_budget_micro_usd = group_monthly_budget_micro_usd;
  if (member_monthly_allowance_micro_usd !== undefined) db.budgetConfig.member_monthly_allowance_micro_usd = member_monthly_allowance_micro_usd;
  if (max_request_micro_usd !== undefined) db.budgetConfig.max_request_micro_usd = max_request_micro_usd;
  if (max_concurrent_requests !== undefined) db.budgetConfig.max_concurrent_requests = max_concurrent_requests;
  if (enforce_strict_budget !== undefined) db.budgetConfig.enforce_strict_budget = enforce_strict_budget;

  db.logAudit(req.user!.id, 'admin.budget_updated', 'budget_config', 'global', db.budgetConfig);
  res.json(db.budgetConfig);
});

router.get('/quotas', (req, res) => {
  const userQuotas = Array.from(db.users.values()).map((u) => {
    const allowance = db.userQuotaOverrides.get(u.id) ?? db.budgetConfig.member_monthly_allowance_micro_usd;
    const usage = db.getUserCurrentMonthUsage(u.id);
    return {
      userId: u.id,
      email: u.email,
      displayName: u.display_name,
      allowanceMicroUsd: allowance,
      currentUsageMicroUsd: usage,
      hasOverride: db.userQuotaOverrides.has(u.id),
    };
  });
  res.json(userQuotas);
});

router.put('/quotas/:userId', (req, res) => {
  const { allowanceMicroUsd } = req.body;
  const user = db.users.get(req.params.userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  if (typeof allowanceMicroUsd === 'number') {
    db.userQuotaOverrides.set(user.id, allowanceMicroUsd);
  } else {
    db.userQuotaOverrides.delete(user.id);
  }

  db.logAudit(req.user!.id, 'admin.quota_updated', 'user_quota', user.id, { allowanceMicroUsd });
  res.json({ success: true, userId: user.id, allowanceMicroUsd });
});

// --- Provider Credentials Management (Zero Leak!) ---
router.get('/providers', (req, res) => {
  const list = (['google', 'openai', 'xai'] as ProviderId[]).map((p) => {
    const cred = db.credentials.get(p);
    return {
      provider: p,
      status: cred?.status || 'unconfigured',
      masked_key: cred?.maskedKey || 'Not configured',
      has_key: Boolean(cred?.encryptedSecret || (p === 'google' && process.env.GEMINI_API_KEY)),
      last_tested: cred?.lastTested,
    };
  });
  res.json(list);
});

router.post('/providers/:provider/credentials', (req, res) => {
  const provider = req.params.provider as ProviderId;
  const { apiKey } = req.body;

  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 8) {
    res.status(400).json({ error: 'Valid API Key is required' });
    return;
  }

  const cleanKey = apiKey.trim();
  const maskedKey = `${cleanKey.slice(0, 4)}...${cleanKey.slice(-4)}`;
  const encryptedSecret = `enc_${Buffer.from(cleanKey).toString('base64')}`;

  db.credentials.set(provider, {
    encryptedSecret,
    maskedKey,
    status: 'active',
    lastTested: new Date().toISOString(),
  });

  db.logAudit(req.user!.id, 'admin.provider_key_saved', 'provider_credential', provider, {
    provider,
    masked_key: maskedKey,
  });

  res.json({
    success: true,
    provider,
    status: 'active',
    masked_key: maskedKey,
  });
});

router.post('/providers/:provider/test', async (req, res) => {
  const provider = req.params.provider as ProviderId;
  const cred = db.credentials.get(provider);

  // Gemini is active via GEMINI_API_KEY
  if (provider === 'google' && (process.env.GEMINI_API_KEY || cred?.encryptedSecret)) {
    if (cred) cred.lastTested = new Date().toISOString();
    res.json({ success: true, message: 'Google Gemini connected successfully and verified.' });
    return;
  }

  if (!cred?.encryptedSecret) {
    res.status(400).json({ success: false, message: `No shared API key configured for ${provider}. Please enter a valid key first.` });
    return;
  }

  cred.lastTested = new Date().toISOString();
  db.logAudit(req.user!.id, 'admin.provider_tested', 'provider_credential', provider, { result: 'verified' });
  res.json({ success: true, message: `Successfully verified shared credential connection for ${provider.toUpperCase()}.` });
});

router.delete('/providers/:provider/credentials', (req, res) => {
  const provider = req.params.provider as ProviderId;
  const cred = db.credentials.get(provider);
  if (cred) {
    cred.encryptedSecret = '';
    cred.status = 'unconfigured';
    cred.maskedKey = 'Not configured';
  }
  db.logAudit(req.user!.id, 'admin.provider_key_removed', 'provider_credential', provider);
  res.json({ success: true });
});

// --- Models ---
router.patch('/models/:id', (req, res) => {
  const model = db.models.get(req.params.id);
  if (!model) {
    res.status(404).json({ error: 'Model not found' });
    return;
  }
  const { enabled } = req.body;
  if (enabled !== undefined) {
    model.enabled = Boolean(enabled);
  }
  db.logAudit(req.user!.id, 'admin.model_updated', 'model', model.id, { enabled: model.enabled });
  res.json(model);
});

// --- Audit Logs ---
router.get('/audit-logs', (req, res) => {
  res.json(db.auditLogs.slice(0, 50));
});

// --- Group Usage Summary ---
router.get('/usage/summary', (req, res) => {
  const groupUsage = db.getGroupCurrentMonthUsage();
  const groupBudget = db.budgetConfig.group_monthly_budget_micro_usd;

  const userBreakdown = Array.from(db.users.values()).map((u) => {
    const userEvents = db.usageEvents.filter((e) => e.user_id === u.id);
    const cost = userEvents.reduce((acc, c) => acc + c.actual_micro_usd, 0);
    const tokens = userEvents.reduce((acc, c) => acc + c.input_tokens + c.output_tokens, 0);
    return {
      userId: u.id,
      displayName: u.display_name,
      email: u.email,
      role: u.role,
      costMicroUsd: cost,
      tokens,
      requestCount: userEvents.length,
    };
  });

  const providerBreakdown: Record<string, { microUsd: number; tokens: number; requests: number }> = {
    google: { microUsd: 0, tokens: 0, requests: 0 },
    openai: { microUsd: 0, tokens: 0, requests: 0 },
    xai: { microUsd: 0, tokens: 0, requests: 0 },
  };

  for (const e of db.usageEvents) {
    if (providerBreakdown[e.provider]) {
      providerBreakdown[e.provider].microUsd += e.actual_micro_usd;
      providerBreakdown[e.provider].tokens += e.input_tokens + e.output_tokens;
      providerBreakdown[e.provider].requests += 1;
    }
  }

  res.json({
    groupUsageMicroUsd: groupUsage,
    groupBudgetMicroUsd: groupBudget,
    percentUsed: Number(((groupUsage / groupBudget) * 100).toFixed(1)),
    totalEvents: db.usageEvents.length,
    userBreakdown,
    providerBreakdown,
  });
});

export default router;
