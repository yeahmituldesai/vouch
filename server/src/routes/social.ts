import { Router } from 'express';
import { pool, q } from '../db';
import { HttpError, parse, uuid, wrap } from '../lib/http';
import { requireAuth } from '../lib/auth';
import { notify } from '../lib/notify';

const r = Router();

r.post('/users/:id/follow', requireAuth, wrap(async (req, res) => {
  const id = parse(uuid, req.params.id);
  if (id === req.user!.id) throw new HttpError(400, 'SELF_FOLLOW', 'You cannot follow yourself');
  if (!(await q('SELECT 1 FROM users WHERE id = $1', [id])).rows[0]) throw new HttpError(404, 'NOT_FOUND', 'User not found');
  const del = await q('DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2', [req.user!.id, id]);
  let following = false;
  if (!del.rowCount) {
    await q('INSERT INTO follows (follower_id, followee_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user!.id, id]);
    following = true;
    await notify(pool, id, 'follow', 'New follower', req.user!.name || 'Someone started following you', { userId: req.user!.id });
  }
  const followers = (await q('SELECT count(*)::int AS n FROM follows WHERE followee_id = $1', [id])).rows[0].n;
  res.json({ following, followers });
}));

r.post('/users/:id/block', requireAuth, wrap(async (req, res) => {
  const id = parse(uuid, req.params.id);
  if (id === req.user!.id) throw new HttpError(400, 'SELF_BLOCK', 'You cannot block yourself');
  if (!(await q('SELECT 1 FROM users WHERE id = $1', [id])).rows[0]) throw new HttpError(404, 'NOT_FOUND', 'User not found');
  const del = await q('DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2', [req.user!.id, id]);
  let blocked = false;
  if (!del.rowCount) {
    await q('INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user!.id, id]);
    await q('DELETE FROM follows WHERE (follower_id = $1 AND followee_id = $2) OR (follower_id = $2 AND followee_id = $1)', [req.user!.id, id]);
    blocked = true;
  }
  res.json({ blocked });
}));

export default r;
