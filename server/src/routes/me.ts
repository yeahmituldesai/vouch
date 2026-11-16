import { Router } from 'express';
import { z } from 'zod';
import { q, tx } from '../db';
import { HttpError, parse, wrap } from '../lib/http';
import { requireAuth } from '../lib/auth';
import { fetchIdeas, PAY } from '../lib/ideas';
import { publicUser } from './auth';
import { imagesEnabled, uploadImage } from '../lib/images';

const r = Router();
r.use(requireAuth);

r.get('/', wrap(async (req, res) => {
  const id = req.user!.id;
  const u = (await q('SELECT * FROM users WHERE id = $1', [id])).rows[0];
  const c = (await q(
    `SELECT (SELECT count(*)::int FROM ideas WHERE owner_id = $1 AND status <> 'removed') AS ideas,
            (SELECT count(*)::int FROM vouches WHERE user_id = $1) AS vouches,
            ${PAY ? "(SELECT count(*)::int FROM orders WHERE user_id = $1 AND status IN ('paid','refunded'))" : '(SELECT count(*)::int FROM wants WHERE user_id = $1)'} AS preorders,
            (SELECT count(*)::int FROM follows WHERE followee_id = $1) AS followers,
            (SELECT count(*)::int FROM follows WHERE follower_id = $1) AS following,
            (SELECT count(*)::int FROM notifications WHERE user_id = $1 AND read_at IS NULL) AS unread`, [id])).rows[0];
  res.json({ user: { ...publicUser(u), phone: u.phone }, counts: c });
}));

r.patch('/', wrap(async (req, res) => {
  const b = parse(z.object({
    name: z.string().trim().min(1).max(50).optional(),
    handle: z.string().trim().transform((v) => v.toLowerCase()).pipe(z.string().regex(/^[a-z0-9_]{4,15}$/, 'Handle must be 4 to 15 characters: letters, numbers or underscores')).optional(),
    bio: z.string().trim().max(160).optional(),
    location: z.string().trim().max(60).optional(),
    website: z.string().trim().max(120).optional(),
    bannerUrl: z.string().trim().max(500).optional(),
    role: z.enum(['member', 'founder', 'backer']).optional(),
  }), req.body);
  try {
    const u = (await q(
      `UPDATE users SET name = coalesce($2, name), handle = coalesce($3, handle), bio = coalesce($4, bio),
         location = coalesce($5, location), website = coalesce($6, website), banner_url = coalesce($7, banner_url),
         role = coalesce($8, role) WHERE id = $1 RETURNING *`,
      [req.user!.id, b.name ?? null, b.handle ?? null, b.bio ?? null, b.location ?? null, b.website ?? null, b.bannerUrl ?? null, b.role ?? null])).rows[0];
    res.json({ user: publicUser(u) });
  } catch (e: any) {
    if (e.code === '23505') throw new HttpError(409, 'HANDLE_TAKEN', 'That handle is already taken');
    throw e;
  }
}));

r.post('/push-token', wrap(async (req, res) => {
  const b = parse(z.object({ token: z.string().min(1) }), req.body);
  await q('UPDATE users SET push_token = $1 WHERE id = $2', [b.token, req.user!.id]);
  res.json({ ok: true });
}));

r.delete('/push-token', wrap(async (req, res) => {
  await q('UPDATE users SET push_token = NULL WHERE id = $1', [req.user!.id]);
  res.json({ ok: true });
}));

r.post('/avatar', wrap(async (req, res) => {
  if (!imagesEnabled()) throw new HttpError(501, 'IMAGES_DISABLED', 'Image uploads are not configured');
  const b = parse(z.object({ image: z.string().min(1) }), req.body);
  const url = await uploadImage(b.image, `avatars/${req.user!.id}`, 'avatar');
  const u = (await q('UPDATE users SET avatar_url = $1 WHERE id = $2 RETURNING *', [url, req.user!.id])).rows[0];
  res.json({ user: publicUser(u) });
}));
r.post('/banner', wrap(async (req, res) => {
  if (!imagesEnabled()) throw new HttpError(501, 'IMAGES_DISABLED', 'Image uploads are not configured');
  const b = parse(z.object({ image: z.string().min(1) }), req.body);
  const url = await uploadImage(b.image, `banners/${req.user!.id}`, 'banner');
  const u = (await q('UPDATE users SET banner_url = $1 WHERE id = $2 RETURNING *', [url, req.user!.id])).rows[0];
  res.json({ user: publicUser(u) });
}));

r.get('/ideas', wrap(async (req, res) => {
  res.json({ ideas: await fetchIdeas(req.user!.id, `i.owner_id = $2 AND i.status <> 'removed'`, [req.user!.id]) });
}));
r.get('/vouched', wrap(async (req, res) => {
  res.json({ ideas: await fetchIdeas(req.user!.id, `i.status <> 'removed' AND EXISTS (SELECT 1 FROM vouches v WHERE v.idea_id = i.id AND v.user_id = $2)`, [req.user!.id]) });
}));
r.get('/wants', wrap(async (req, res) => {
  res.json({ ideas: await fetchIdeas(req.user!.id, `i.status <> 'removed' AND EXISTS (SELECT 1 FROM wants w WHERE w.idea_id = i.id AND w.user_id = $2)`, [req.user!.id]) });
}));
r.get('/orders', wrap(async (req, res) => {
  const { rows } = await q(
    `SELECT o.id, o.qty, o.amount_paise, o.status, o.created_at, i.id AS idea_id, i.name AS idea_name, i.category
       FROM orders o JOIN ideas i ON i.id = o.idea_id
      WHERE o.user_id = $1 AND o.status IN ('paid','refunded') ORDER BY o.created_at DESC LIMIT 100`, [req.user!.id]);
  res.json({ orders: rows.map((o) => ({ id: o.id, qty: o.qty, amountPaise: o.amount_paise, status: o.status, createdAt: o.created_at, idea: { id: o.idea_id, name: o.idea_name, category: o.category } })) });
}));
r.get('/notifications', wrap(async (req, res) => {
  const { rows } = await q('SELECT id, type, title, body, data, read_at, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [req.user!.id]);
  res.json({ notifications: rows.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, data: n.data, read: !!n.read_at, createdAt: n.created_at })) });
}));
r.post('/notifications/read', wrap(async (req, res) => {
  await q('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL', [req.user!.id]);
  res.json({ ok: true });
}));

// In-app account deletion (required by the App Store). Blocked while money is still in flight.
r.delete('/', wrap(async (req, res) => {
  const id = req.user!.id;
  await tx(async (c) => {
    const active = (await c.query(
      `SELECT (SELECT count(*)::int FROM orders o JOIN ideas i ON i.id = o.idea_id WHERE o.user_id = $1 AND o.status = 'paid' AND i.status = 'live')
            + (SELECT count(*)::int FROM orders o JOIN ideas i ON i.id = o.idea_id WHERE i.owner_id = $1 AND o.status = 'paid' AND i.status IN ('live','funded')) AS n`, [id])).rows[0].n;
    if (active > 0) throw new HttpError(409, 'ACTIVE_ORDERS', 'You have pre-orders in progress. Wait until they are settled or refunded, then delete your account.');
    await c.query(`UPDATE ideas SET status = 'removed', removed_reason = 'account deleted' WHERE owner_id = $1 AND status = 'live'`, [id]);
    await c.query('DELETE FROM vouches WHERE user_id = $1', [id]);
    await c.query('DELETE FROM wants WHERE user_id = $1', [id]);
    await c.query('DELETE FROM comments WHERE user_id = $1', [id]);
    await c.query('DELETE FROM follows WHERE follower_id = $1 OR followee_id = $1', [id]);
    await c.query('DELETE FROM notifications WHERE user_id = $1', [id]);
    await c.query('DELETE FROM blocks WHERE blocker_id = $1 OR blocked_id = $1', [id]);
    await c.query('DELETE FROM reports WHERE reporter_id = $1', [id]);
    await c.query(`UPDATE users SET phone = 'deleted:' || id::text, name = 'Deleted user', handle = 'deleted_' || substr(replace(id::text, '-', ''), 1, 7), bio = '', google_sub = NULL, email = NULL, push_token = NULL, is_banned = true, deleted_at = now() WHERE id = $1`, [id]);
  });
  res.json({ ok: true });
}));

export default r;
