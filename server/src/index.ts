import fs from 'node:fs';
import path from 'node:path';
import { createApp } from './app';
import { config } from './config';
import * as Sentry from '@sentry/node';
import { pool } from './db';
import { migrate } from './migrate';
import { runSettlement } from './lib/settle';

async function main() {
  if (config.SENTRY_DSN) {
    Sentry.init({ dsn: config.SENTRY_DSN, environment: config.NODE_ENV, tracesSampleRate: 0.1 });
  }
  await migrate();
  const pub = path.join(__dirname, '..', 'public');
  const todo = fs.readdirSync(pub).filter((f) => f.endsWith('.html') && fs.readFileSync(path.join(pub, f), 'utf8').includes('[['));
  if (todo.length) console.warn(`\n!!! LEGAL PLACEHOLDERS REMAIN in public/${todo.join(', public/')}. Fill every [[...]] and have a lawyer review before launch.\n`);
  const server = createApp().listen(config.PORT, () => console.log(`Vouch API listening on :${config.PORT} (${config.NODE_ENV}, payments=${config.PAYMENT_PROVIDER})`));
  let timer: NodeJS.Timeout | undefined;
  if (config.SETTLEMENT_INTERVAL_MS > 0) {
    const tick = () => runSettlement().then((s) => s.closed + s.refunded && console.log('settlement', s)).catch((e) => console.error('settlement error', e));
    tick();
    timer = setInterval(tick, config.SETTLEMENT_INTERVAL_MS);
  }
  const stop = () => {
    if (timer) clearInterval(timer);
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
