import { Router } from 'express';
import { authMiddleware } from '../middleware.js';
import { evalsService } from '../evals.js';

const router = Router();
router.use(authMiddleware);

// Get test suites
router.get('/suites', (req, res) => {
  res.json(evalsService.getSuites());
});

// Run evaluation suite
router.post('/run', async (req, res) => {
  const { suiteId, modelIds } = req.body;
  if (!suiteId || !modelIds || !Array.isArray(modelIds) || modelIds.length === 0) {
    res.status(400).json({ error: 'suiteId and modelIds are required' });
    return;
  }

  try {
    const report = await evalsService.runSuite(suiteId, modelIds);
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Evaluation run failed' });
  }
});

// Get prompt templates
router.get('/templates', (req, res) => {
  res.json(evalsService.getTemplates());
});

export default router;
