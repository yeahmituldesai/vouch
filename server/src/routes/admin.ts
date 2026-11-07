import { Router } from 'express';
import { z } from 'zod';
import { q } from '../db';
import { HttpError, parse, uuid, wrap } from '../lib/http';
import { requireAdmin } from '../lib/auth';
import { runSettlement } from '../lib/settle';

const r = Router();
r.use(requireAdmin);

r.get('/reports', wrap(async (_req, res) => {
  const { rows } = await q(
    `SELECT i.id AS idea_id, i.name, i.status, count(*)::int AS reports, array_agg(r.reason ORDER BY r.created_at DESC) AS reasons
       FROM reports r JOIN ideas i ON i.id = r.idea_id GROUP BY i.id ORDER BY reports DESC LIMIT 100`);
  res.json({ reports: rows });
}));
r.post('/ideas/:id/remove', wrap(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const b = parse(z.object({ reason: z.string().trim().min(3).max(200) }), req.body);
  const u = await q(`UPDATE ideas SET status = 'removed', removed_reason = $2 WHERE id = $1 AND status <> 'removed'`, [id, b.reason]);
  if (!u.rowCount) throw new HttpError(404, 'NOT_FOUND', 'Idea not found');
  res.json({ ok: true, settlement: await runSettlement() }); // refunds any paid orders right away
}));
r.post('/users/:id/ban', wrap(async (req, res) => {
  const u = await q('UPDATE users SET is_banned = true WHERE id = $1', [parse(uuid, req.params.id)]);
  if (!u.rowCount) throw new HttpError(404, 'NOT_FOUND', 'User not found');
  res.json({ ok: true });
}));
r.post('/settlement/run', wrap(async (_req, res) => res.json(await runSettlement())));

export default r;
