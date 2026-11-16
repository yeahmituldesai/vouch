import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config';
import { pool, q, tx } from '../db';
import { HttpError, parse, uuid, wrap } from '../lib/http';
import { optionalAuth, requireAuth } from '../lib/auth';
import { CATEGORIES, fetchIdea, fetchIdeas, PAY } from '../lib/ideas';
import { notify } from '../lib/notify';
import { imagesEnabled, uploadImage } from '../lib/images';

const r = Router();
const idParam = (req: any) => parse(uuid, req.params.id);

r.get('/', optionalAuth, wrap(async (req, res) => {
  const f = parse(z.object({
    category: z.enum(CATEGORIES).optional(),
    q: z.string().trim().max(60).optional(),
    sort: z.enum(['trending', 'new', 'closing']).default('trending'),
    following: z.enum(['1']).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    offset: z.coerce.number().int().min(0).max(1000).default(0),
  }), req.query);
  const where = [`i.status = 'live'`, `i.deadline > now()`, `NOT EXISTS (SELECT 1 FROM blocks b WHERE b.blocker_id = $1::uuid AND b.blocked_id = i.owner_id)`];
  const params: unknown[] = [];
  const add = (v: unknown) => (params.push(v), `$${params.length + 1}`);
  if (f.category) where.push(`i.category = ${add(f.category)}`);
  if (f.q) where.push(`(i.name ILIKE ${add('%' + f.q.replace(/[\\%_]/g, '\\$&') + '%')} OR u.name ILIKE $${params.length + 1} OR u.handle ILIKE $${params.length + 1})`);
  if (f.following) {
    if (!req.user) throw new HttpError(401, 'UNAUTHORIZED', 'Sign in to see people you follow');
    where.push(`EXISTS (SELECT 1 FROM follows fo WHERE fo.follower_id = $1::uuid AND fo.followee_id = i.owner_id)`);
  }
  const order = { trending: 'vouches DESC, i.created_at DESC', new: 'i.created_at DESC', closing: 'i.deadline ASC' }[f.sort];
  const ideas = await fetchIdeas(req.user?.id ?? null, where.join(' AND '), params, `ORDER BY ${order} LIMIT ${f.limit} OFFSET ${f.offset}`);
  res.json({ ideas, nextOffset: ideas.length === f.limit ? f.offset + f.limit : null });
}));

r.get('/:id', optionalAuth, wrap(async (req, res) => {
  const idea = await fetchIdea(req.user?.id ?? null, idParam(req));
  if (!idea) throw new HttpError(404, 'NOT_FOUND', 'Idea not found');
  res.json({ idea });
}));

r.post('/', requireAuth, wrap(async (req, res) => {
  const b = parse(z.object({
    name: z.string().trim().min(3).max(60),
    category: z.enum(CATEGORIES),
    description: z.string().trim().min(10).max(500),
    priceInr: PAY ? z.number().int().min(1).max(100000) : z.number().int().min(1).max(100000).optional(),
    goal: z.number().int().min(5).max(100000),
    durationDays: z.union([z.literal(14), z.literal(30), z.literal(60)]).default(30),
  }), req.body);
  const id = await tx(async (c) => {
    await c.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [req.user!.id]);
    const n = (await c.query(`SELECT count(*)::int AS n FROM ideas WHERE owner_id = $1 AND status = 'live'`, [req.user!.id])).rows[0].n;
    if (n >= config.MAX_LIVE_IDEAS) throw new HttpError(403, 'LIMIT_REACHED', `You can run ${config.MAX_LIVE_IDEAS} live ideas at a time`);
    const row = (await c.query(
      `INSERT INTO ideas (owner_id, name, category, description, price_paise, goal, deadline)
       VALUES ($1,$2,$3,$4,$5,$6, now() + ($7 || ' days')::interval) RETURNING id`,
      [req.user!.id, b.name, b.category, b.description, b.priceInr ? b.priceInr * 100 : null, b.goal, String(b.durationDays)])).rows[0];
    return row.id as string;
  });
  res.status(201).json({ idea: await fetchIdea(req.user!.id, id) });
}));

r.delete('/:id', requireAuth, wrap(async (req, res) => {
  const id = idParam(req);
  await tx(async (c) => {
    const i = (await c.query('SELECT owner_id, status FROM ideas WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!i || i.status === 'removed') throw new HttpError(404, 'NOT_FOUND', 'Idea not found');
    if (i.owner_id !== req.user!.id) throw new HttpError(403, 'FORBIDDEN', 'Only the founder can delete this idea');
    const paid = (await c.query(`SELECT count(*)::int AS n FROM orders WHERE idea_id = $1 AND status = 'paid'`, [id])).rows[0].n;
    if (paid > 0) throw new HttpError(409, 'HAS_PREORDERS', 'This idea has pre-orders and cannot be deleted');
    await c.query(`UPDATE ideas SET status = 'removed', removed_reason = 'deleted by founder' WHERE id = $1`, [id]);
  });
  res.json({ ok: true });
}));

r.post('/:id/vouch', requireAuth, wrap(async (req, res) => {
  const id = idParam(req);
  const idea = (await q(`SELECT owner_id, name, status FROM ideas WHERE id = $1`, [id])).rows[0];
  if (!idea || idea.status === 'removed') throw new HttpError(404, 'NOT_FOUND', 'Idea not found');
  const del = await q('DELETE FROM vouches WHERE user_id = $1 AND idea_id = $2', [req.user!.id, id]);
  let vouched = false;
  if (!del.rowCount) {
    await q('INSERT INTO vouches (user_id, idea_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user!.id, id]);
    vouched = true;
    if (idea.owner_id !== req.user!.id) await notify(pool, idea.owner_id, 'vouch', 'New vouch', `${req.user!.name || 'Someone'} vouched for ${idea.name}`, { ideaId: id });
  }
  const count = (await q('SELECT count(*)::int AS n FROM vouches WHERE idea_id = $1', [id])).rows[0].n;
  res.json({ vouched, count });
}));

r.post('/:id/want', requireAuth, wrap(async (req, res) => {
  const id = idParam(req);
  const idea = (await q(`SELECT owner_id, name, status, deadline FROM ideas WHERE id = $1`, [id])).rows[0];
  if (!idea || idea.status === 'removed') throw new HttpError(404, 'NOT_FOUND', 'Idea not found');
  if (idea.owner_id === req.user!.id) throw new HttpError(403, 'OWN_IDEA', 'You cannot say you would buy your own idea');
  const del = await q('DELETE FROM wants WHERE user_id = $1 AND idea_id = $2', [req.user!.id, id]);
  let wanted = false;
  if (!del.rowCount) {
    if (idea.status !== 'live' || new Date(idea.deadline).getTime() <= Date.now()) throw new HttpError(409, 'IDEA_CLOSED', 'This idea has closed');
    await q('INSERT INTO wants (user_id, idea_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user!.id, id]);
    wanted = true;
    await notify(pool, idea.owner_id, 'want', 'New interest', `${req.user!.name || 'Someone'} is interested in ${idea.name}`, { ideaId: id });
  }
  const count = (await q('SELECT count(*)::int AS n FROM wants WHERE idea_id = $1', [id])).rows[0].n;
  res.json({ wanted, count });
}));

r.get('/:id/comments', optionalAuth, wrap(async (req, res) => {
  const { rows } = await q(
    `SELECT c.id, c.body, c.created_at, u.id AS user_id, u.name, u.handle, u.avatar_url FROM comments c JOIN users u ON u.id = c.user_id
      WHERE c.idea_id = $1 AND NOT EXISTS (SELECT 1 FROM blocks b WHERE b.blocker_id = $2::uuid AND b.blocked_id = c.user_id)
      ORDER BY c.created_at DESC LIMIT 50`, [idParam(req), req.user?.id ?? null]);
  res.json({ comments: rows.map((c) => ({ id: c.id, body: c.body, createdAt: c.created_at, author: { id: c.user_id, name: c.name, handle: c.handle, avatarUrl: c.avatar_url ?? null } })) });
}));

r.post('/:id/comments', requireAuth, wrap(async (req, res) => {
  const id = idParam(req);
  const b = parse(z.object({ body: z.string().trim().min(1).max(500) }), req.body);
  const idea = (await q(`SELECT owner_id, name, status FROM ideas WHERE id = $1`, [id])).rows[0];
  if (!idea || idea.status === 'removed') throw new HttpError(404, 'NOT_FOUND', 'Idea not found');
  const recent = (await q(`SELECT count(*)::int AS n FROM comments WHERE user_id = $1 AND created_at > now() - interval '1 minute'`, [req.user!.id])).rows[0].n;
  if (recent >= 5) throw new HttpError(429, 'SLOW_DOWN', 'You are commenting too fast');
  const c = (await q('INSERT INTO comments (idea_id, user_id, body) VALUES ($1,$2,$3) RETURNING id, body, created_at', [id, req.user!.id, b.body])).rows[0];
  if (idea.owner_id !== req.user!.id) await notify(pool, idea.owner_id, 'feedback', 'New feedback', `${idea.name}: ${b.body.slice(0, 80)}`, { ideaId: id });
  const me = (await q('SELECT avatar_url FROM users WHERE id = $1', [req.user!.id])).rows[0];
  res.status(201).json({ comment: { id: c.id, body: c.body, createdAt: c.created_at, author: { id: req.user!.id, name: req.user!.name, handle: req.user!.handle, avatarUrl: me?.avatar_url ?? null } } });
}));

r.post('/:id/report', requireAuth, wrap(async (req, res) => {
  const id = idParam(req);
  const b = parse(z.object({ reason: z.string().trim().min(3).max(300) }), req.body);
  const idea = (await q(`SELECT 1 FROM ideas WHERE id = $1 AND status <> 'removed'`, [id])).rows[0];
  if (!idea) throw new HttpError(404, 'NOT_FOUND', 'Idea not found');
  await q('INSERT INTO reports (reporter_id, idea_id, reason) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [req.user!.id, id, b.reason]);
  res.json({ ok: true });
}));

// Optional image upload for an idea (requires R2/S3 config).
r.post('/:id/image', requireAuth, wrap(async (req, res) => {
  if (!imagesEnabled()) throw new HttpError(501, 'IMAGES_DISABLED', 'Image uploads are not configured');
  const id = idParam(req);
  const i = (await q('SELECT owner_id FROM ideas WHERE id = $1', [id])).rows[0];
  if (!i) throw new HttpError(404, 'NOT_FOUND', 'Idea not found');
  if (i.owner_id !== req.user!.id) throw new HttpError(403, 'FORBIDDEN', 'Only the founder can update this image');
  const b = parse(z.object({ image: z.string().min(1) }), req.body);
  const url = await uploadImage(b.image, `ideas/${id}`, 'idea');
  await q('UPDATE ideas SET image_url = $1 WHERE id = $2', [url, id]);
  res.json({ imageUrl: url });
}));

export default r;
