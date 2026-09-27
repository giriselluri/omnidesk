import { Router } from 'express';
import { authMiddleware } from '../middleware.js';
import { performWebSearch } from '../search.js';

const router = Router();
router.use(authMiddleware);

router.post('/', async (req, res) => {
  const { query, limit = 5 } = req.body;
  if (!query || typeof query !== 'string') {
    res.status(400).json({ error: 'Query is required' });
    return;
  }
  const results = await performWebSearch(query, limit);
  res.json({ results });
});

export default router;
