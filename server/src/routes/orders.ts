import { Router } from 'express';
import { z } from 'zod';
import { q } from '../db';
import { HttpError, parse, uuid, wrap } from '../lib/http';
import { requireAuth } from '../lib/auth';
import { provider } from '../lib/payments';
import { markPaid } from '../lib/settle';

const r = Router();

r.post('/ideas/:id/orders', requireAuth, wrap(async (req, res) => {
  const ideaId = parse(uuid, req.params.id);
  const b = parse(z.object({ qty: z.number().int().min(1).max(9) }), req.body);
  const idea = (await q('SELECT id, owner_id, price_paise, status, deadline FROM ideas WHERE id = $1', [ideaId])).rows[0];
  if (!idea || idea.status === 'removed') throw new HttpError(404, 'NOT_FOUND', 'Idea not found');
  if (idea.status !== 'live' || new Date(idea.deadline).getTime() <= Date.now()) throw new HttpError(409, 'IDEA_CLOSED', 'Pre-orders for this idea are closed');
  if (idea.owner_id === req.user!.id) throw new HttpError(403, 'OWN_IDEA', 'You cannot pre-order your own idea');
  const open = (await q(`SELECT count(*)::int AS n FROM orders WHERE user_id = $1 AND status = 'created' AND created_at > now() - interval '1 hour'`, [req.user!.id])).rows[0].n;
  if (open >= 10) throw new HttpError(429, 'SLOW_DOWN', 'Finish or wait before starting more orders');
  if (!idea.price_paise) throw new HttpError(409, 'NO_PRICE', 'This idea has no price yet');
  const amount = idea.price_paise * b.qty;
  const o = (await q(`INSERT INTO orders (user_id, idea_id, qty, amount_paise, provider) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [req.user!.id, ideaId, b.qty, amount, provider.name])).rows[0];
  const p = await provider.createOrder({ amountPaise: amount, receipt: o.id });
  await q('UPDATE orders SET provider_order_id = $2 WHERE id = $1', [o.id, p.providerOrderId]);
  res.status(201).json({ order: { id: o.id, amountPaise: amount, qty: b.qty, provider: provider.name, providerOrderId: p.providerOrderId, checkout: p.checkout } });
}));

r.post('/orders/:id/verify', requireAuth, wrap(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const b = parse(z.object({ paymentId: z.string().min(3).max(100), signature: z.string().min(10).max(200) }), req.body);
  const o = (await q('SELECT id, user_id, status, provider_order_id FROM orders WHERE id = $1', [id])).rows[0];
  if (!o || o.user_id !== req.user!.id) throw new HttpError(404, 'NOT_FOUND', 'Order not found');
  if (o.status === 'paid' || o.status === 'refunded') return void res.json({ order: { id, status: o.status } });
  if (!o.provider_order_id || !provider.verifyPayment({ providerOrderId: o.provider_order_id, paymentId: b.paymentId, signature: b.signature }))
    throw new HttpError(400, 'BAD_SIGNATURE', 'Payment could not be verified');
  const r2 = await markPaid(id, b.paymentId);
  if (r2.late) throw new HttpError(409, 'IDEA_CLOSED', 'This idea closed before your payment arrived. You are being refunded in full.');
  res.json({ order: { id, status: r2.status } });
}));

export default r;
