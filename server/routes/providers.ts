import { Router } from 'express';
import { db } from '../db.js';
import { authMiddleware } from '../middleware.js';

const router = Router();
router.use(authMiddleware);

router.get('/providers', (req, res) => {
  const providers = (['google', 'openai', 'xai'] as const).map((p) => {
    const cred = db.credentials.get(p);
    return {
      id: p,
      name: p === 'google' ? 'Google Gemini' : p === 'openai' ? 'OpenAI GPT' : 'xAI Grok',
      status: p === 'google' || cred?.encryptedSecret ? 'active' : 'unconfigured',
      hasKey: Boolean(p === 'google' || cred?.encryptedSecret),
    };
  });
  res.json(providers);
});

router.get('/models', (req, res) => {
  const models = Array.from(db.models.values()).filter((m) => m.enabled);
  res.json(models);
});

export default router;
