import fs from 'node:fs';
import path from 'node:path';
import { createApp } from './app';
import { config } from './config';
import * as Sentry from '@sentry/node';
import { pool } from './db';
import { migrate } from './migrate';
import { runSettlement } from './lib/settle';
import { storageBackend } from './lib/images';

async function main() {
  if (config.SENTRY_DSN) {
    Sentry.init({ dsn: config.SENTRY_DSN, environment: config.NODE_ENV, tracesSampleRate: 0.1 });
  }
  if (config.NODE_ENV === 'production' && storageBackend() === 'database') {
    console.warn(
      '[images] Object storage is not configured (set all R2_* or all SUPABASE_* env vars); image uploads are stored as base64 data URLs in Postgres.',
    );
  } else if (config.NODE_ENV === 'production') {
    console.log(`[images] Object storage backend: ${storageBackend()}.`);
  }
  await migrate();
  const pub = path.join(__dirname, '..', 'public');
  const todo = fs.readdirSync(pub).filter((f) => f.endsWith('.html') && fs.readFileSync(path.join(pub, f), 'utf8').includes('[['));
  if (todo.length) console.warn(`\n!!! LEGAL PLACEHOLDERS REMAIN in public/${todo.join(', public/')}. Fill every [[...]] and have a lawyer review before launch.\n`);
  const app = createApp();
  const server = app.listen(config.PORT, () => console.log(`Vouch API listening on :${config.PORT} (${config.NODE_ENV}, payments=${config.PAYMENT_PROVIDER})`));
  let server2: ReturnType<typeof app.listen> | undefined;
  if (config.PORT !== 4000) {
    try {
      server2 = app.listen(4000, () => console.log('Vouch API also listening on :4000'));
    } catch (e) {
      console.warn('Could not bind port 4000:', e);
    }
  }
  let timer: NodeJS.Timeout | undefined;
  if (config.SETTLEMENT_INTERVAL_MS > 0) {
    const tick = () => runSettlement().then((s) => s.closed + s.refunded && console.log('settlement', s)).catch((e) => console.error('settlement error', e));
    tick();
    timer = setInterval(tick, config.SETTLEMENT_INTERVAL_MS);
  }
  const stop = () => {
    if (timer) clearInterval(timer);
    if (server2) server2.close();
    server.close(() => pool.end().then(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
