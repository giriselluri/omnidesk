import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import authRoutes from './server/routes/auth.js';
import adminRoutes from './server/routes/admin.js';
import providersRoutes from './server/routes/providers.js';
import conversationsRoutes from './server/routes/conversations.js';
import documentsRoutes from './server/routes/documents.js';
import gmailRoutes from './server/routes/gmail.js';
import usageRoutes from './server/routes/usage.js';
import searchRoutes from './server/routes/search.js';
import arenaRoutes from './server/routes/arena.js';
import evalsRoutes from './server/routes/evals.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // API v1 Health Check
  app.get('/api/v1/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'omnidesk-api',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  });

  // Mount API Endpoints
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1', providersRoutes);
  app.use('/api/v1/conversations', conversationsRoutes);
  app.use('/api/v1/documents', documentsRoutes);
  app.use('/api/v1/collections', documentsRoutes);
  app.use('/api/v1/gmail', gmailRoutes);
  app.use('/api/v1/usage', usageRoutes);
  app.use('/api/v1/search', searchRoutes);
  app.use('/api/v1/arena', arenaRoutes);
  app.use('/api/v1/evals', evalsRoutes);

  // Development vs Production frontend serving
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[OmniDesk] Server running in ${isProduction ? 'production' : 'development'} on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
