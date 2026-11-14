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
import { imagesEnabled } from './lib/images';
import { APP_VERSION } from './lib/appVersion';

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

  app.get('/api/v1/config', (_req, res) => res.json({ paymentsEnabled: config.PAYMENTS_ENABLED === 'true', imagesEnabled: imagesEnabled() }));
  app.get('/api/v1/app-version', (_req, res) => res.json(APP_VERSION));

  // Public landing page for shared idea links (the app shares /i/:id URLs).
  app.get('/i/:id', async (req, res, next) => {
    try {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) return next();
      const { rows } = await q(
        `SELECT i.id, i.name, i.description, i.category, i.goal, i.status,
                u.name AS owner_name, u.handle AS owner_handle,
                (SELECT count(*)::int FROM vouches v WHERE v.idea_id = i.id) AS vouches,
                (SELECT count(*)::int FROM wants w WHERE w.idea_id = i.id) AS interested
           FROM ideas i JOIN users u ON u.id = i.owner_id
          WHERE i.id = $1 AND i.status <> 'removed'`,
        [req.params.id],
      );
      const idea = rows[0];
      if (!idea) return next();
      const esc = (value: unknown) =>
        String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
      const percent = Math.min(100, Math.round((idea.interested / idea.goal) * 100));
      const founder = idea.owner_name || `@${idea.owner_handle}`;
      const appUrl = APP_VERSION.downloadUrl;
      res.type('html').send(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(idea.name)} · Vouch</title>
<meta name="description" content="${esc(idea.description).slice(0, 160)}">
<meta property="og:title" content="${esc(idea.name)} · Vouch">
<meta property="og:description" content="${esc(idea.description).slice(0, 160)}">
<meta property="og:type" content="website">
<style>
  :root { color-scheme: dark; }
  body { margin:0; background:#000; color:#fff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
  main { max-width:560px; margin:0 auto; padding:32px 22px 56px; }
  .badge { display:inline-block; font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:#a1a1aa; border:1px solid #2a2a2e; border-radius:999px; padding:6px 12px; }
  h1 { font-size:34px; line-height:1.15; letter-spacing:-1px; margin:18px 0 8px; }
  .meta { color:#a1a1aa; font-size:14px; margin-bottom:22px; }
  p { color:#d1d1d6; font-size:16px; line-height:1.55; }
  .bar { height:8px; border-radius:4px; background:#1a1a1c; overflow:hidden; margin:22px 0 8px; }
  .bar span { display:block; height:100%; background:#fff; border-radius:4px; }
  .numbers { display:flex; gap:26px; color:#a1a1aa; font-size:13px; }
  .numbers b { display:block; color:#fff; font-size:24px; letter-spacing:-.5px; }
  a.cta { display:block; text-align:center; margin-top:30px; background:#fff; color:#000; text-decoration:none; font-weight:700; padding:16px; border-radius:16px; }
  a.ghost { display:block; text-align:center; margin-top:12px; color:#a1a1aa; font-size:13px; text-decoration:none; }
</style>
</head><body><main>
  <span class="badge">${esc(idea.category)}</span>
  <h1>${esc(idea.name)}</h1>
  <div class="meta">by ${esc(founder)} · ${esc(idea.status)}</div>
  <p>${esc(idea.description)}</p>
  <div class="bar"><span style="width:${percent}%"></span></div>
  <div class="numbers">
    <div><b>${idea.vouches}</b>vouches</div>
    <div><b>${idea.interested}</b>interested</div>
    <div><b>${percent}%</b>of goal</div>
  </div>
  <a class="cta" href="${appUrl}">Get Vouch for Android</a>
  <a class="ghost" href="vouch://i/${idea.id}">Already have the app? Open this idea</a>
</main></body></html>`);
    } catch (error) {
      next(error);
    }
  });

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
