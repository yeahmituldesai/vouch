// Beta mode (PAYMENTS_ENABLED=false): no money anywhere, "I'd buy this" instead.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { Server } from 'node:http';
import { createApp } from '../src/app';
import { migrate } from '../src/migrate';
import { pool, q } from '../src/db';
import { runSettlement } from '../src/lib/settle';

let server: Server;
let base = '';
async function api(method: string, path: string, o: { token?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = {};
  if (o.token) headers.authorization = 'Bearer ' + o.token;
  if (o.body !== undefined) headers['content-type'] = 'application/json';
  const r = await fetch(base + path, { method, headers, body: o.body === undefined ? undefined : JSON.stringify(o.body) });
  let json: any = null;
  try { json = await r.json(); } catch { /* none */ }
  return { status: r.status, json };
}
let n = 9100000000;
async function signup(name: string) {
  const phone = String(n++);
  const a = await api('POST', '/api/v1/auth/otp/request', { body: { phone } });
  const b = await api('POST', '/api/v1/auth/otp/verify', { body: { phone, code: a.json.devCode } });
  await api('PATCH', '/api/v1/me', { token: b.json.token, body: { name } });
  return { token: b.json.token as string, id: b.json.user.id as string };
}
const mk = (token: string, goal = 5) => api('POST', '/api/v1/ideas', { token, body: { name: 'Beta Chips', category: 'Snacks', description: 'A beta mode idea for testing', goal, durationDays: 30 } });

before(async () => {
  await migrate(false);
  await q('TRUNCATE users, otps, ideas, vouches, comments, follows, orders, reports, notifications, blocks, wants RESTART IDENTITY CASCADE');
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
after(async () => { server.close(); await pool.end(); });

describe('beta mode', () => {
  test('config says payments are off and payment routes do not exist', async () => {
    assert.deepEqual((await api('GET', '/api/v1/config')).json, { paymentsEnabled: false, imagesEnabled: false });
    const f = await signup('F'); const b = await signup('B');
    const created = await mk(f.token);
    assert.equal(created.status, 201);
    assert.equal(created.json.idea.pricePaise, null);
    const idea = created.json.idea;
    assert.equal((await api('POST', `/api/v1/ideas/${idea.id}/orders`, { token: b.token, body: { qty: 1 } })).status, 404);
    assert.equal((await api('POST', '/webhooks/payments')).status, 404);
  });
  test('"I would buy this" toggles, counts, notifies and feeds the demand score', async () => {
    const f = await signup('Founder'); const b = await signup('Buyer'); const c = await signup('Other');
    const idea = (await mk(f.token, 10)).json.idea;
    assert.equal((await api('POST', `/api/v1/ideas/${idea.id}/want`, { token: f.token })).status, 403);
    assert.equal((await api('POST', `/api/v1/ideas/${idea.id}/want`)).status, 401);
    assert.deepEqual((await api('POST', `/api/v1/ideas/${idea.id}/want`, { token: b.token })).json, { wanted: true, count: 1 });
    await api('POST', `/api/v1/ideas/${idea.id}/want`, { token: c.token });
    await api('POST', `/api/v1/ideas/${idea.id}/vouch`, { token: b.token });
    const d = (await api('GET', `/api/v1/ideas/${idea.id}`, { token: b.token })).json.idea;
    assert.equal(d.stats.preorders, 2);
    assert.equal(d.percent, 20);
    assert.equal(d.viewer.wanted, true);
    assert.ok(d.demand.score > 0);
    assert.ok((await api('GET', '/api/v1/me/notifications', { token: f.token })).json.notifications.some((x: any) => x.type === 'want'));
    assert.equal((await api('GET', '/api/v1/me/wants', { token: b.token })).json.ideas.length, 1);
    assert.equal((await api('GET', '/api/v1/me', { token: b.token })).json.counts.preorders, 1);
    assert.deepEqual((await api('POST', `/api/v1/ideas/${idea.id}/want`, { token: b.token })).json, { wanted: false, count: 1 });
  });
  test('deadline: funded when the goal is met, failed otherwise, nobody is charged or refunded', async () => {
    const f = await signup('F'); const a = await signup('A'); const b = await signup('B');
    const win = (await mk(f.token, 5)).json.idea; const lose = (await mk(f.token, 50)).json.idea;
    const w = (await signup('W1')); const w2 = await signup('W2'); const w3 = await signup('W3');
    for (const u of [a, b, w, w2, w3]) await api('POST', `/api/v1/ideas/${win.id}/want`, { token: u.token });
    await api('POST', `/api/v1/ideas/${lose.id}/want`, { token: a.token });
    await q(`UPDATE ideas SET deadline = now() - interval '1 minute' WHERE id = ANY($1)`, [[win.id, lose.id]]);
    const s = await runSettlement();
    assert.equal(s.refunded, 0);
    assert.equal((await api('GET', `/api/v1/ideas/${win.id}`)).json.idea.status, 'funded');
    assert.equal((await api('GET', `/api/v1/ideas/${lose.id}`)).json.idea.status, 'failed');
    const late = await signup('Late');
    assert.equal((await api('POST', `/api/v1/ideas/${win.id}/want`, { token: late.token })).status, 409);
    assert.ok((await api('GET', '/api/v1/me/notifications', { token: a.token })).json.notifications.some((x: any) => x.type === 'idea_funded'));
    assert.equal((await q('SELECT count(*)::int AS n FROM orders')).rows[0].n, 0);
  });
  test('account deletion works and removes wants', async () => {
    const f = await signup('F'); const b = await signup('B');
    const idea = (await mk(f.token)).json.idea;
    await api('POST', `/api/v1/ideas/${idea.id}/want`, { token: b.token });
    assert.equal((await api('DELETE', '/api/v1/me', { token: b.token })).status, 200);
    assert.equal((await api('GET', `/api/v1/ideas/${idea.id}`)).json.idea.stats.preorders, 0);
  });
});
