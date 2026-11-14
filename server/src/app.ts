import path from 'node:path';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { q } from './db';
import * as Sentry from '@sentry/node';
import { HttpError } from './lib/http';
import { optionalAuth } from './lib/auth';
import authRoutes from './routes/auth';
import meRoutes from './routes/me';
import ideaRoutes from './routes/ideas';
import orderRoutes from './routes/orders';
import socialRoutes from './routes/social';
import webhookRoutes from './routes/webhooks';
import adminRoutes from './routes/admin';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGINS === '*' ? true : config.CORS_ORIGINS.split(',').map((s) => s.trim()) }));
  app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'], maxAge: '1h' }));
  if (config.PAYMENTS_ENABLED === 'true') app.use('/webhooks', webhookRoutes);
  app.use(express.json({ limit: '50kb' }));
  app.use(rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false, skip: () => config.NODE_ENV === 'test' }));

  app.get('/health', async (_req, res) => {
    try {
      await q('SELECT 1');
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  app.get('/api/v1/config', (_req, res) => res.json({ paymentsEnabled: config.PAYMENTS_ENABLED === 'true' }));
  app.get('/api/v1/app-version', (_req, res) => res.json({
    versionCode: 5,
    versionName: '0.0.1',
    downloadUrl: 'https://github.com/yeahmituldesai/vouch/releases/download/vouch-beta-v0.0.1/vouch-beta.apk',
    changelog: 'Real Android push notifications, faster updates and stability fixes.',
    forceUpdate: false,
  }));

  const api = express.Router();
  api.use('/auth', authRoutes);
  api.use('/me', meRoutes);
  api.use('/ideas', ideaRoutes);
  if (config.PAYMENTS_ENABLED === 'true') api.use('/', orderRoutes);
  api.use('/', socialRoutes);
  api.use('/admin', adminRoutes);
  app.use('/api/v1', api);
  void optionalAuth;

  app.use((_req, _res, next) => next(new HttpError(404, 'NOT_FOUND', 'Route not found')));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) return void res.status(err.status).json({ error: { code: err.code, message: err.message } });
    if (err?.type === 'entity.parse.failed') return void res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } });
    if (err?.type === 'entity.too.large') return void res.status(413).json({ error: { code: 'TOO_LARGE', message: 'Request too large' } });
    if (err?.code === '23505') return void res.status(409).json({ error: { code: 'CONFLICT', message: 'That already exists' } });
    if (config.SENTRY_DSN) Sentry.captureException(err);
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
  });
  return app;
}
