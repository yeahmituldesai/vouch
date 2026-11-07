import { q, tx } from '../db';
import { PAY } from './ideas';
import { HttpError } from './http';
import { notify } from './notify';
import { provider } from './payments';

const inr = (p: number) => '₹' + (p / 100).toLocaleString('en-IN');

/** Marks an order paid. Safe to call twice (verify endpoint and webhook can both arrive). */
export async function markPaid(orderId: string, paymentId: string) {
  const res = await tx(async (c) => {
    const { rows } = await c.query(
      `SELECT o.*, i.status AS idea_status, i.name AS idea_name, i.owner_id, i.deadline
         FROM orders o JOIN ideas i ON i.id = o.idea_id WHERE o.id = $1 FOR UPDATE OF o`,
      [orderId],
    );
    const o = rows[0];
    if (!o) throw new HttpError(404, 'NOT_FOUND', 'Order not found');
    if (o.status === 'paid' || o.status === 'refunded') return { status: o.status as string, late: false };
    await c.query(`UPDATE orders SET status = 'paid', provider_payment_id = $2, paid_at = now() WHERE id = $1`, [orderId, paymentId]);
    const late = o.idea_status !== 'live' || new Date(o.deadline).getTime() <= Date.now();
    if (!late) {
      await notify(c, o.owner_id, 'preorder', `${o.qty} new pre-order${o.qty > 1 ? 's' : ''}`, `${o.idea_name} · ${inr(o.amount_paise)}`, { ideaId: o.idea_id });
      await notify(c, o.user_id, 'preorder_ok', 'Pre-order placed', `${o.idea_name}. Refunded in full if the goal is not reached.`, { ideaId: o.idea_id, orderId });
    }
    return { status: 'paid', late };
  });
  if (res.late) await refundOrder(orderId).catch((e) => console.error('late refund failed', orderId, e));
  return res;
}

/** Refunds one paid order in full. Row lock makes it safe to retry. */
export async function refundOrder(orderId: string): Promise<boolean> {
  return tx(async (c) => {
    const { rows } = await c.query(
      `SELECT o.*, i.name AS idea_name FROM orders o JOIN ideas i ON i.id = o.idea_id WHERE o.id = $1 FOR UPDATE OF o`,
      [orderId],
    );
    const o = rows[0];
    if (!o || o.status !== 'paid' || !o.provider_payment_id) return false;
    const r = await provider.refund({ paymentId: o.provider_payment_id, amountPaise: o.amount_paise, key: o.id });
    await c.query(`UPDATE orders SET status = 'refunded', refund_id = $2, refunded_at = now() WHERE id = $1`, [o.id, r.refundId]);
    await notify(c, o.user_id, 'refund', 'Refund issued', `${o.idea_name}: ${inr(o.amount_paise)} is on its way back to you.`, { orderId: o.id });
    return true;
  });
}

/** Closes ideas past their deadline (funded or failed) and refunds orders that must be refunded. */
export async function runSettlement() {
  const out = { closed: 0, funded: 0, failed: 0, refunded: 0, refundErrors: 0 };
  for (;;) {
    const funded = await tx(async (c) => {
      const { rows } = await c.query(
        `SELECT id, name, goal, owner_id FROM ideas WHERE status = 'live' AND deadline <= now()
          ORDER BY deadline LIMIT 1 FOR UPDATE SKIP LOCKED`,
      );
      const i = rows[0];
      if (!i) return null;
      const { rows: [s] } = await c.query(PAY ? `SELECT coalesce(sum(qty),0)::int AS qty FROM orders WHERE idea_id = $1 AND status = 'paid'` : `SELECT count(*)::int AS qty FROM wants WHERE idea_id = $1`, [i.id]);
      const ok = s.qty >= i.goal;
      await c.query('UPDATE ideas SET status = $2, settled_qty = $3 WHERE id = $1', [i.id, ok ? 'funded' : 'failed', s.qty]);
      await notify(c, i.owner_id, ok ? 'idea_funded' : 'idea_failed', ok ? 'Goal reached' : 'Goal not reached',
        ok ? `${i.name} hit ${i.goal} pre-orders. Time to build.` : PAY ? `${i.name} ended with ${s.qty} of ${i.goal}. Buyers are being refunded.` : `${i.name} ended with ${s.qty} of ${i.goal}.`, { ideaId: i.id });
      await c.query(
        `INSERT INTO notifications (user_id, type, title, body, data)
         SELECT DISTINCT ${PAY ? 'o' : 'w'}.user_id, $2::text, $3::text, $4::text, jsonb_build_object('ideaId', ${PAY ? 'o' : 'w'}.idea_id::text)
           FROM ${PAY ? "orders o WHERE o.idea_id = $1::uuid AND o.status = 'paid'" : 'wants w WHERE w.idea_id = $1::uuid'}`,
        [i.id, ok ? 'idea_funded' : 'idea_failed', ok ? 'Goal reached' : 'Goal not reached',
         ok ? `${i.name} will go into production.` : PAY ? `${i.name} did not reach its goal. Your refund is on its way.` : `${i.name} did not reach its goal this time.`],
      );
      return ok;
    });
    if (funded === null) break;
    out.closed++;
    funded ? out.funded++ : out.failed++;
  }
  const { rows } = await q(
    `SELECT o.id FROM orders o JOIN ideas i ON i.id = o.idea_id
      WHERE o.status = 'paid' AND (i.status IN ('failed','removed') OR o.paid_at > i.deadline)
      ORDER BY o.paid_at LIMIT 200`,
  );
  for (const r of rows) {
    try {
      if (await refundOrder(r.id)) out.refunded++;
    } catch (e) {
      out.refundErrors++;
      console.error('refund failed', r.id, e);
    }
  }
  return out;
}
