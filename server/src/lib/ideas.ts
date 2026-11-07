import { config } from '../config';
import { q } from '../db';

export const PAY = config.PAYMENTS_ENABLED === 'true';
const PREORDERS = PAY
  ? `CASE WHEN i.status IN ('funded','failed') THEN coalesce(i.settled_qty, 0)
       ELSE (SELECT coalesce(sum(o.qty),0)::int FROM orders o WHERE o.idea_id = i.id AND o.status = 'paid') END`
  : `CASE WHEN i.status IN ('funded','failed') THEN coalesce(i.settled_qty, 0)
       ELSE (SELECT count(*)::int FROM wants w WHERE w.idea_id = i.id) END`;
const BUYERS = PAY
  ? `(SELECT count(DISTINCT o.user_id)::int FROM orders o WHERE o.idea_id = i.id AND o.status IN ('paid','refunded'))`
  : `(SELECT count(*)::int FROM wants w WHERE w.idea_id = i.id)`;

export const CATEGORIES = ['Snacks', 'Skincare', 'Clothing', 'Apps'] as const;

export function demand(s: { vouches: number; preorders: number; goal: number; buyers: number }) {
  const interest = Math.min(100, Math.round((s.vouches / (s.goal * 2)) * 100));
  const pay = Math.min(100, Math.round((s.preorders / s.goal) * 100));
  const conv = Math.min(100, Math.round((s.vouches ? s.buyers / s.vouches : 0) * 400));
  const score = Math.round(0.4 * interest + 0.4 * pay + 0.2 * conv);
  const verdict = score >= 70 ? 'strong' : score >= 40 ? 'growing' : 'early';
  return { score, verdict, interest, pay, conv };
}

// $1 is always the viewer id (or null).
export const IDEA_BASE = `
SELECT i.id, i.name, i.category, i.description, i.price_paise, i.goal, i.status, i.deadline, i.created_at, i.image_url,
  u.id AS owner_id, u.name AS owner_name, u.handle AS owner_handle,
  (SELECT count(*)::int FROM vouches v WHERE v.idea_id = i.id) AS vouches,
  (SELECT count(*)::int FROM comments c WHERE c.idea_id = i.id) AS comments,
  ${PREORDERS} AS preorders,
  ${BUYERS} AS buyers,
  ($1::uuid IS NOT NULL AND EXISTS (SELECT 1 FROM wants w WHERE w.idea_id = i.id AND w.user_id = $1::uuid)) AS wanted,
  ($1::uuid IS NOT NULL AND EXISTS (SELECT 1 FROM vouches v WHERE v.idea_id = i.id AND v.user_id = $1::uuid)) AS vouched,
  ($1::uuid IS NOT NULL AND EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $1::uuid AND f.followee_id = i.owner_id)) AS following
FROM ideas i JOIN users u ON u.id = i.owner_id`;

export function mapIdea(r: any) {
  const daysLeft = r.status === 'live' ? Math.max(0, Math.ceil((new Date(r.deadline).getTime() - Date.now()) / 86400000)) : 0;
  const d = demand({ vouches: r.vouches, preorders: r.preorders, goal: r.goal, buyers: r.buyers });
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    description: r.description,
    imageUrl: r.image_url ?? null,
    pricePaise: r.price_paise,
    goal: r.goal,
    status: r.status,
    deadline: r.deadline,
    daysLeft,
    createdAt: r.created_at,
    owner: { id: r.owner_id, name: r.owner_name, handle: r.owner_handle },
    stats: { vouches: r.vouches, preorders: r.preorders, comments: r.comments, buyers: r.buyers },
    percent: Math.min(100, Math.round((r.preorders / r.goal) * 100)),
    demand: d,
    viewer: { vouched: r.vouched, followingOwner: r.following, wanted: r.wanted },
  };
}

export async function fetchIdeas(viewerId: string | null, where: string, params: unknown[], tail = 'ORDER BY i.created_at DESC LIMIT 50') {
  const { rows } = await q(`${IDEA_BASE} WHERE ${where} ${tail}`, [viewerId, ...params]);
  return rows.map(mapIdea);
}

export async function fetchIdea(viewerId: string | null, id: string) {
  const { rows } = await q(`${IDEA_BASE} WHERE i.id = $2 AND i.status <> 'removed'`, [viewerId, id]);
  return rows[0] ? mapIdea(rows[0]) : null;
}
