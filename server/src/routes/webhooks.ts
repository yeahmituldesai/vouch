import express, { Router } from 'express';
import { q } from '../db';
import { HttpError, wrap } from '../lib/http';
import { provider } from '../lib/payments';
import { markPaid } from '../lib/settle';

const r = Router();

// Raw body is required to verify the signature. Mounted before express.json().
r.post('/payments', express.raw({ type: '*/*', limit: '200kb' }), wrap(async (req, res) => {
  const sig = req.headers['x-razorpay-signature'] ?? req.headers['x-signature'];
  if (typeof sig !== 'string' || !Buffer.isBuffer(req.body) || !provider.verifyWebhook(req.body, sig))
    throw new HttpError(400, 'BAD_SIGNATURE', 'Invalid signature');
  let ev: any;
  try { ev = JSON.parse(req.body.toString('utf8')); } catch { throw new HttpError(400, 'INVALID_JSON', 'Invalid body'); }
  if (ev?.event === 'payment.captured') {
    const p = ev?.payload?.payment?.entity;
    if (p?.id && p?.order_id) {
      const o = (await q('SELECT id FROM orders WHERE provider_order_id = $1', [p.order_id])).rows[0];
      if (o) await markPaid(o.id, p.id);
    }
  }
  res.json({ ok: true }); // always 200 for valid signatures so the provider stops retrying
}));

export default r;
