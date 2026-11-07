import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import type { Server } from 'node:http';
import { createApp } from '../src/app';
import { migrate } from '../src/migrate';
import { pool, q } from '../src/db';
import { demand } from '../src/lib/ideas';
import { normalizePhone } from '../src/lib/auth';
import { mockSign, mockWebhookSign } from '../src/lib/payments';
import { runSettlement } from '../src/lib/settle';

let server: Server;
let base = '';
const ADMIN = { 'x-admin-token': 'test-admin-token-1234' };

async function api(method: string, path: string, o: { token?: string; body?: unknown; headers?: Record<string, string>; raw?: string } = {}) {
  const headers: Record<string, string> = { ...(o.headers || {}) };
  if (o.token) headers.authorization = 'Bearer ' + o.token;
  let body: string | undefined;
  if (o.raw !== undefined) body = o.raw;
  else if (o.body !== undefined) { headers['content-type'] = 'application/json'; body = JSON.stringify(o.body); }
  const r = await fetch(base + path, { method, headers, body });
  const text = await r.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: r.status, json };
}
let phoneN = 9000000100;
async function signup(name = '') {
  const phone = String(phoneN++);
  const a = await api('POST', '/api/v1/auth/otp/request', { body: { phone } });
  const b = await api('POST', '/api/v1/auth/otp/verify', { body: { phone, code: a.json.devCode } });
  assert.equal(b.status, 200);
  if (name) await api('PATCH', '/api/v1/me', { token: b.json.token, body: { name } });
  return { token: b.json.token as string, user: b.json.user as { id: string; handle: string } };
}
const newIdea = (token: string, extra: Record<string, unknown> = {}) =>
  api('POST', '/api/v1/ideas', { token, body: { name: 'Masala Makhana', category: 'Snacks', description: 'Roasted fox nut chips in three flavours', priceInr: 149, goal: 5, durationDays: 30, ...extra } });
async function pay(token: string, ideaId: string, qty = 1) {
  const o = await api('POST', `/api/v1/ideas/${ideaId}/orders`, { token, body: { qty } });
  assert.equal(o.status, 201, JSON.stringify(o.json));
  const paymentId = 'pay_' + crypto.randomBytes(4).toString('hex');
  const v = await api('POST', `/api/v1/orders/${o.json.order.id}/verify`, { token, body: { paymentId, signature: mockSign(o.json.order.providerOrderId, paymentId) } });
  return { order: o.json.order, v, paymentId };
}
// Simulates time passing: the deadline and every payment so far move 2 minutes into the past.
const expire = async (id: string) => {
  await q(`UPDATE orders SET paid_at = paid_at - interval '2 minutes' WHERE idea_id = $1 AND paid_at IS NOT NULL`, [id]);
  await q(`UPDATE ideas SET deadline = now() - interval '1 minute' WHERE id = $1`, [id]);
};
const orderStatus = async (id: string) => (await q('SELECT status, refund_id FROM orders WHERE id = $1', [id])).rows[0];

before(async () => {
  await migrate(false);
  await q('TRUNCATE users, otps, ideas, vouches, comments, follows, orders, reports, notifications, blocks RESTART IDENTITY CASCADE');
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
after(async () => { server.close(); await pool.end(); });

describe('pure logic', () => {
  test('phone normalisation', () => {
    assert.equal(normalizePhone('98765 43210'), '+919876543210');
    assert.equal(normalizePhone('+14155550123'), '+14155550123');
    assert.equal(normalizePhone('12345'), null);
    assert.equal(normalizePhone('5876543210'), null);
  });
  test('demand score', () => {
    assert.deepEqual(demand({ vouches: 0, preorders: 0, goal: 100, buyers: 0 }), { score: 0, verdict: 'early', interest: 0, pay: 0, conv: 0 });
    const d = demand({ vouches: 1284, preorders: 312, goal: 500, buyers: 312 });
    assert.equal(d.score, 84);
    assert.equal(d.verdict, 'strong');
  });
});

describe('static pages', () => {
  test('legal and support pages are served', async () => {
    for (const p of ['/terms', '/privacy', '/refunds', '/support']) {
      const r = await fetch(base + p);
      assert.equal(r.status, 200);
      assert.match(r.headers.get('content-type') ?? '', /html/);
    }
  });
});

describe('auth', () => {
  test('health', async () => assert.equal((await api('GET', '/health')).status, 200));
  test('rejects bad phone, bad code, expired and too soon', async () => {
    assert.equal((await api('POST', '/api/v1/auth/otp/request', { body: { phone: '12345678' } })).json.error.code, 'INVALID_PHONE');
    const a = await api('POST', '/api/v1/auth/otp/request', { body: { phone: '9111111111' } });
    assert.equal((await api('POST', '/api/v1/auth/otp/request', { body: { phone: '9111111111' } })).json.error.code, 'TOO_SOON');
    const wrong = a.json.devCode === '123456' ? '654321' : '123456';
    assert.equal((await api('POST', '/api/v1/auth/otp/verify', { body: { phone: '9111111111', code: wrong } })).json.error.code, 'BAD_CODE');
    assert.equal((await api('POST', '/api/v1/auth/otp/verify', { body: { phone: '9111111111', code: 'abc' } })).status, 400);
  });
  test('review login works without SMS, and only with the right code', async () => {
    assert.equal((await api('POST', '/api/v1/auth/otp/request', { body: { phone: '9000000999' } })).json.devCode, undefined);
    assert.equal((await api('POST', '/api/v1/auth/otp/verify', { body: { phone: '9000000999', code: '111111' } })).status, 400);
    const ok = await api('POST', '/api/v1/auth/otp/verify', { body: { phone: '9000000999', code: '424242' } });
    assert.equal(ok.status, 200);
    assert.ok(ok.json.token);
  });
  test('locks the code after 5 wrong attempts', async () => {
    const a = await api('POST', '/api/v1/auth/otp/request', { body: { phone: '9222222222' } });
    const wrong = a.json.devCode === '111111' ? '222222' : '111111';
    for (let i = 0; i < 5; i++) await api('POST', '/api/v1/auth/otp/verify', { body: { phone: '9222222222', code: wrong } });
    const r = await api('POST', '/api/v1/auth/otp/verify', { body: { phone: '9222222222', code: a.json.devCode } });
    assert.equal(r.status, 429);
  });
  test('signup, session, profile edit, handle conflicts', async () => {
    const a = await signup('Aarav');
    const b = await signup('Meera');
    const me = await api('GET', '/api/v1/me', { token: a.token });
    assert.equal(me.status, 200);
    assert.equal(me.json.user.name, 'Aarav');
    assert.equal((await api('GET', '/api/v1/me')).status, 401);
    assert.equal((await api('GET', '/api/v1/me', { token: 'garbage' })).status, 401);
    assert.equal((await api('PATCH', '/api/v1/me', { token: a.token, body: { handle: 'aarav_s' } })).status, 200);
    assert.equal((await api('PATCH', '/api/v1/me', { token: b.token, body: { handle: 'aarav_s' } })).json.error.code, 'HANDLE_TAKEN');
    assert.equal((await api('PATCH', '/api/v1/me', { token: b.token, body: { handle: 'No Spaces!' } })).status, 400);
  });
});

describe('ideas, vouches, comments, follows', () => {
  test('create validates input and lists the idea', async () => {
    const f = await signup('Founder');
    assert.equal((await api('POST', '/api/v1/ideas', { body: {} })).status, 401);
    assert.equal((await newIdea(f.token, { priceInr: 0 })).status, 400);
    assert.equal((await newIdea(f.token, { priceInr: undefined })).status, 400);
    assert.equal((await newIdea(f.token, { category: 'Cars' })).status, 400);
    const ok = await newIdea(f.token, { name: 'Searchable Chips' });
    assert.equal(ok.status, 201);
    assert.equal(ok.json.idea.pricePaise, 14900);
    assert.equal(ok.json.idea.status, 'live');
    const list = await api('GET', '/api/v1/ideas?q=searchable');
    assert.ok(list.json.ideas.some((i: any) => i.id === ok.json.idea.id));
    assert.equal((await api('GET', '/api/v1/ideas?category=Apps&q=searchable')).json.ideas.length, 0);
    assert.equal((await api('GET', '/api/v1/ideas?q=%25')).status, 200);
    assert.equal((await api('GET', '/api/v1/ideas/not-a-uuid')).status, 400);
  });
  test('live idea limit', async () => {
    const f = await signup();
    for (let i = 0; i < 5; i++) assert.equal((await newIdea(f.token)).status, 201);
    assert.equal((await newIdea(f.token)).json.error.code, 'LIMIT_REACHED');
  });
  test('vouch toggles, comments, notifications, follow', async () => {
    const f = await signup('Founder');
    const v = await signup('Voter');
    const idea = (await newIdea(f.token)).json.idea;
    const a = await api('POST', `/api/v1/ideas/${idea.id}/vouch`, { token: v.token });
    assert.deepEqual(a.json, { vouched: true, count: 1 });
    assert.equal((await api('GET', `/api/v1/ideas/${idea.id}`, { token: v.token })).json.idea.viewer.vouched, true);
    assert.deepEqual((await api('POST', `/api/v1/ideas/${idea.id}/vouch`, { token: v.token })).json, { vouched: false, count: 0 });
    await api('POST', `/api/v1/ideas/${idea.id}/vouch`, { token: v.token });
    const c = await api('POST', `/api/v1/ideas/${idea.id}/comments`, { token: v.token, body: { body: 'Add a jeera flavour please' } });
    assert.equal(c.status, 201);
    assert.equal((await api('POST', `/api/v1/ideas/${idea.id}/comments`, { token: v.token, body: { body: '   ' } })).status, 400);
    assert.equal((await api('GET', `/api/v1/ideas/${idea.id}/comments`)).json.comments.length, 1);
    const n = await api('GET', '/api/v1/me/notifications', { token: f.token });
    assert.ok(n.json.notifications.some((x: any) => x.type === 'feedback'));
    assert.ok(n.json.notifications.some((x: any) => x.type === 'vouch'));
    assert.equal((await api('GET', '/api/v1/me/vouched', { token: v.token })).json.ideas.length, 1);
    const fo = await api('POST', `/api/v1/users/${f.user.id}/follow`, { token: v.token });
    assert.deepEqual(fo.json, { following: true, followers: 1 });
    assert.equal((await api('POST', `/api/v1/users/${v.user.id}/follow`, { token: v.token })).status, 400);
    assert.equal((await api('GET', '/api/v1/ideas?following=1', { token: v.token })).json.ideas.length, 1);
    assert.equal((await api('GET', '/api/v1/ideas?following=1')).status, 401);
  });
  test('only the founder can delete, and not once pre-orders exist', async () => {
    const f = await signup(); const v = await signup();
    const a = (await newIdea(f.token)).json.idea;
    assert.equal((await api('DELETE', `/api/v1/ideas/${a.id}`, { token: v.token })).status, 403);
    const b = (await newIdea(f.token)).json.idea;
    await pay(v.token, b.id, 1);
    assert.equal((await api('DELETE', `/api/v1/ideas/${b.id}`, { token: f.token })).json.error.code, 'HAS_PREORDERS');
    assert.equal((await api('DELETE', `/api/v1/ideas/${a.id}`, { token: f.token })).status, 200);
    assert.equal((await api('GET', `/api/v1/ideas/${a.id}`)).status, 404);
  });
});

describe('pre-orders and payments', () => {
  test('order, bad signature, verify, idempotency, own idea', async () => {
    const f = await signup('F'); const b = await signup('B');
    const idea = (await newIdea(f.token, { goal: 10 })).json.idea;
    assert.equal((await api('POST', `/api/v1/ideas/${idea.id}/orders`, { token: f.token, body: { qty: 1 } })).json.error.code, 'OWN_IDEA');
    assert.equal((await api('POST', `/api/v1/ideas/${idea.id}/orders`, { token: b.token, body: { qty: 10 } })).status, 400);
    const o = await api('POST', `/api/v1/ideas/${idea.id}/orders`, { token: b.token, body: { qty: 2 } });
    assert.equal(o.json.order.amountPaise, 29800);
    const bad = await api('POST', `/api/v1/orders/${o.json.order.id}/verify`, { token: b.token, body: { paymentId: 'pay_x1234', signature: 'f'.repeat(64) } });
    assert.equal(bad.json.error.code, 'BAD_SIGNATURE');
    assert.equal((await orderStatus(o.json.order.id)).status, 'created');
    const other = await signup();
    const pid = 'pay_abcd1234';
    const sig = mockSign(o.json.order.providerOrderId, pid);
    assert.equal((await api('POST', `/api/v1/orders/${o.json.order.id}/verify`, { token: other.token, body: { paymentId: pid, signature: sig } })).status, 404);
    assert.equal((await api('POST', `/api/v1/orders/${o.json.order.id}/verify`, { token: b.token, body: { paymentId: pid, signature: sig } })).json.order.status, 'paid');
    assert.equal((await api('POST', `/api/v1/orders/${o.json.order.id}/verify`, { token: b.token, body: { paymentId: pid, signature: sig } })).json.order.status, 'paid');
    const d = (await api('GET', `/api/v1/ideas/${idea.id}`)).json.idea;
    assert.equal(d.stats.preorders, 2);
    assert.equal(d.percent, 20);
    assert.equal((await api('GET', '/api/v1/me/orders', { token: b.token })).json.orders.length, 1);
    const fn = (await api('GET', '/api/v1/me/notifications', { token: f.token })).json.notifications;
    assert.ok(fn.some((x: any) => x.type === 'preorder'));
  });
  test('webhook marks paid once, rejects bad signature', async () => {
    const f = await signup(); const b = await signup();
    const idea = (await newIdea(f.token)).json.idea;
    const o = await api('POST', `/api/v1/ideas/${idea.id}/orders`, { token: b.token, body: { qty: 1 } });
    const raw = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_hook1234', order_id: o.json.order.providerOrderId } } } });
    assert.equal((await api('POST', '/webhooks/payments', { raw, headers: { 'x-signature': 'nope', 'content-type': 'application/json' } })).status, 400);
    const ok = { 'x-signature': mockWebhookSign(raw), 'content-type': 'application/json' };
    assert.equal((await api('POST', '/webhooks/payments', { raw, headers: ok })).status, 200);
    assert.equal((await api('POST', '/webhooks/payments', { raw, headers: ok })).status, 200);
    assert.equal((await orderStatus(o.json.order.id)).status, 'paid');
    assert.equal((await q('SELECT count(*)::int AS n FROM notifications WHERE type = $1 AND user_id = $2', ['preorder', f.user.id])).rows[0].n, 1);
  });
});

describe('settlement and refunds', () => {
  test('goal missed: idea fails and every buyer is refunded', async () => {
    const f = await signup(); const b1 = await signup(); const b2 = await signup();
    const idea = (await newIdea(f.token, { goal: 50 })).json.idea;
    const p1 = await pay(b1.token, idea.id, 2); const p2 = await pay(b2.token, idea.id, 1);
    await expire(idea.id);
    assert.equal((await api('POST', `/api/v1/ideas/${idea.id}/orders`, { token: b1.token, body: { qty: 1 } })).json.error.code, 'IDEA_CLOSED');
    const s = await runSettlement();
    assert.equal(s.failed >= 1, true);
    assert.equal(s.refunded, 2);
    assert.equal((await orderStatus(p1.order.id)).status, 'refunded');
    assert.ok((await orderStatus(p2.order.id)).refund_id);
    const d = (await api('GET', `/api/v1/ideas/${idea.id}`)).json.idea;
    assert.equal(d.status, 'failed');
    assert.equal(d.stats.preorders, 3);
    assert.ok((await api('GET', '/api/v1/me/notifications', { token: b1.token })).json.notifications.some((n: any) => n.type === 'refund'));
    assert.equal((await runSettlement()).refunded, 0);
  });
  test('goal met: idea is funded and nothing is refunded', async () => {
    const f = await signup(); const b = await signup();
    const idea = (await newIdea(f.token, { goal: 5 })).json.idea;
    const p = await pay(b.token, idea.id, 5);
    await expire(idea.id);
    await runSettlement();
    assert.equal((await api('GET', `/api/v1/ideas/${idea.id}`)).json.idea.status, 'funded');
    assert.equal((await orderStatus(p.order.id)).status, 'paid');
    assert.ok((await api('GET', '/api/v1/me/notifications', { token: f.token })).json.notifications.some((n: any) => n.type === 'idea_funded'));
  });
  test('payment arriving after close is refunded automatically', async () => {
    const f = await signup(); const b = await signup();
    const idea = (await newIdea(f.token, { goal: 50 })).json.idea;
    const o = await api('POST', `/api/v1/ideas/${idea.id}/orders`, { token: b.token, body: { qty: 1 } });
    await expire(idea.id);
    await runSettlement();
    const pid = 'pay_late1234';
    const v = await api('POST', `/api/v1/orders/${o.json.order.id}/verify`, { token: b.token, body: { paymentId: pid, signature: mockSign(o.json.order.providerOrderId, pid) } });
    assert.equal(v.status, 409);
    assert.equal((await orderStatus(o.json.order.id)).status, 'refunded');
  });
});

describe('blocking and account deletion', () => {
  test('blocking hides a founder and their comments; unblock restores', async () => {
    const f = await signup('Founder'); const v = await signup('Viewer');
    const idea = (await newIdea(f.token, { name: 'Blockable Bars' })).json.idea;
    await api('POST', `/api/v1/ideas/${idea.id}/comments`, { token: f.token, body: { body: 'hello from founder' } });
    const has = async () => (await api('GET', '/api/v1/ideas?q=blockable', { token: v.token })).json.ideas.length;
    assert.equal(await has(), 1);
    assert.deepEqual((await api('POST', `/api/v1/users/${f.user.id}/block`, { token: v.token })).json, { blocked: true });
    assert.equal(await has(), 0);
    assert.equal((await api('GET', `/api/v1/ideas/${idea.id}/comments`, { token: v.token })).json.comments.length, 0);
    assert.equal((await api('GET', `/api/v1/ideas/${idea.id}/comments`)).json.comments.length, 1);
    assert.deepEqual((await api('POST', `/api/v1/users/${f.user.id}/block`, { token: v.token })).json, { blocked: false });
    assert.equal(await has(), 1);
  });
  test('account deletion: refused with active pre-orders, works otherwise and wipes personal data', async () => {
    const f = await signup('Founder'); const b = await signup('Buyer');
    const idea = (await newIdea(f.token, { goal: 50 })).json.idea;
    await pay(b.token, idea.id, 1);
    assert.equal((await api('DELETE', '/api/v1/me', { token: b.token })).json.error.code, 'ACTIVE_ORDERS');
    assert.equal((await api('DELETE', '/api/v1/me', { token: f.token })).json.error.code, 'ACTIVE_ORDERS');
    await expire(idea.id); await runSettlement();
    assert.equal((await api('DELETE', '/api/v1/me', { token: b.token })).status, 200);
    assert.equal((await api('GET', '/api/v1/me', { token: b.token })).status, 403);
    const u = (await q('SELECT phone, name, bio FROM users WHERE id = $1', [b.user.id])).rows[0];
    assert.equal(u.name, 'Deleted user');
    assert.ok(u.phone.startsWith('deleted:'));
    assert.equal((await api('DELETE', '/api/v1/me', { token: f.token })).status, 200);
  });
});

describe('moderation', () => {
  test('report, admin removal refunds buyers, ban blocks the account', async () => {
    const f = await signup(); const b = await signup(); const r = await signup();
    const idea = (await newIdea(f.token, { goal: 50 })).json.idea;
    const p = await pay(b.token, idea.id, 1);
    assert.equal((await api('POST', `/api/v1/ideas/${idea.id}/report`, { token: r.token, body: { reason: 'Looks fake' } })).status, 200);
    assert.equal((await api('POST', `/api/v1/ideas/${idea.id}/report`, { token: r.token, body: { reason: 'Looks fake' } })).status, 200);
    assert.equal((await api('GET', '/api/v1/admin/reports')).status, 403);
    const rep = await api('GET', '/api/v1/admin/reports', { headers: ADMIN });
    assert.equal(rep.json.reports.find((x: any) => x.idea_id === idea.id).reports, 1);
    const rm = await api('POST', `/api/v1/admin/ideas/${idea.id}/remove`, { headers: ADMIN, body: { reason: 'Fraud' } });
    assert.equal(rm.status, 200);
    assert.equal((await orderStatus(p.order.id)).status, 'refunded');
    assert.equal((await api('GET', `/api/v1/ideas/${idea.id}`)).status, 404);
    assert.equal((await api('POST', `/api/v1/admin/users/${f.user.id}/ban`, { headers: ADMIN })).status, 200);
    assert.equal((await api('GET', '/api/v1/me', { token: f.token })).json.error.code, 'BANNED');
  });
  test('bad JSON and unknown routes return clean errors', async () => {
    assert.equal((await api('POST', '/api/v1/auth/otp/request', { raw: '{bad', headers: { 'content-type': 'application/json' } })).json.error.code, 'INVALID_JSON');
    assert.equal((await api('GET', '/api/v1/nope')).status, 404);
  });
});
