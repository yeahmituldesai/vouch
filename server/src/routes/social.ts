import { Router } from 'express';
import { pool, q } from '../db';
import { HttpError, parse, uuid, wrap } from '../lib/http';
import { requireAuth } from '../lib/auth';
import { publicUser } from './auth';
import { fetchIdeas } from '../lib/ideas';
import { notify } from '../lib/notify';

const r = Router();

// Public-ish profile (auth required for viewer context)
async function profileFor(id: string, viewerId: string) {
  const u = (await q('SELECT * FROM users WHERE id = $1', [id])).rows[0];
  if (!u || u.deleted_at) throw new HttpError(404, 'NOT_FOUND', 'User not found');
  if (u.is_banned) throw new HttpError(404, 'NOT_FOUND', 'User not found');
  const c = (await q(
    `SELECT (SELECT count(*)::int FROM ideas WHERE owner_id = $1 AND status <> 'removed') AS ideas,
            (SELECT count(*)::int FROM vouches WHERE user_id = $1) AS vouches,
            (SELECT count(*)::int FROM follows WHERE followee_id = $1) AS followers,
            (SELECT count(*)::int FROM follows WHERE follower_id = $1) AS following`,
    [id])).rows[0];
  const viewerFollowing = (await q('SELECT 1 FROM follows WHERE follower_id = $1 AND followee_id = $2', [viewerId, id])).rows[0] ? true : false;
  return { user: { ...publicUser(u), phone: undefined }, counts: { ...c, unread: 0 }, viewer: { following: viewerFollowing, isSelf: viewerId === id } };
}

// Shared profile links use /u/:handle, so the app must resolve a handle too.
r.get('/users/by-handle/:handle', requireAuth, wrap(async (req, res) => {
  const handle = String(req.params.handle ?? '');
  if (!/^[a-z0-9_]{3,20}$/i.test(handle)) throw new HttpError(404, 'NOT_FOUND', 'User not found');
  const row = (await q('SELECT id FROM users WHERE lower(handle) = lower($1)', [handle])).rows[0];
  if (!row) throw new HttpError(404, 'NOT_FOUND', 'User not found');
  res.json(await profileFor(row.id, req.user!.id));
}));

r.get('/users/:id', requireAuth, wrap(async (req, res) => {
  const id = parse(uuid, req.params.id);
  res.json(await profileFor(id, req.user!.id));
}));

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


r.get('/users/:id/ideas', requireAuth, wrap(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const ideas = await fetchIdeas(req.user!.id, `i.owner_id = $2 AND i.status <> 'removed'`, [id]);
  res.json({ ideas });
}));

r.get('/users/:id/followers', requireAuth, wrap(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const { rows } = await q(`SELECT u.* FROM follows f JOIN users u ON u.id = f.follower_id WHERE f.followee_id = $1 ORDER BY f.created_at DESC LIMIT 100`, [id]);
  res.json({ users: rows.map(publicUser) });
}));
r.get('/users/:id/following', requireAuth, wrap(async (req, res) => {
  const id = parse(uuid, req.params.id);
  const { rows } = await q(`SELECT u.* FROM follows f JOIN users u ON u.id = f.followee_id WHERE f.follower_id = $1 ORDER BY f.created_at DESC LIMIT 100`, [id]);
  res.json({ users: rows.map(publicUser) });
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
