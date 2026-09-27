import { Router } from 'express';
import { authMiddleware } from '../middleware.js';
import { arenaService } from '../arena.js';

const router = Router();
router.use(authMiddleware);

// Get model arena leaderboard
router.get('/leaderboard', (req, res) => {
  const leaderboard = arenaService.getLeaderboard();
  res.json(leaderboard);
});

// Run side-by-side or blind comparison
router.post('/compare', async (req, res) => {
  const { prompt, systemPrompt, modelIds, isBlind = false } = req.body;
  if (!prompt || !modelIds || !Array.isArray(modelIds) || modelIds.length === 0) {
    res.status(400).json({ error: 'Prompt and modelIds are required' });
    return;
  }

  try {
    const comp = await arenaService.runComparison({
      prompt,
      systemPrompt,
      modelIds,
      isBlind: Boolean(isBlind),
    });
    res.json(comp);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Comparison failed' });
  }
});

// Vote for best model response
router.post('/vote', (req, res) => {
  const { comparisonId, winnerModelId } = req.body;
  if (!comparisonId || !winnerModelId) {
    res.status(400).json({ error: 'comparisonId and winnerModelId are required' });
    return;
  }

  try {
    const updatedLeaderboard = arenaService.voteWinner(comparisonId, winnerModelId);
    res.json({ success: true, leaderboard: updatedLeaderboard });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Vote failed' });
  }
});

export default router;
