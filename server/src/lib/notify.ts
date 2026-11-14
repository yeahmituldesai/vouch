import type { Db } from '../db';
import { pushToUser } from './push';

export async function notify(db: Db, userId: string, type: string, title: string, body = '', data: Record<string, unknown> = {}) {
  await db.query('INSERT INTO notifications (user_id, type, title, body, data) VALUES ($1,$2,$3,$4,$5)', [
    userId, type, title, body, JSON.stringify(data),
  ]);
  // Fire-and-forget push notification (best effort, no-op if no token).
  pushToUser(userId, title, body, data).catch(() => {});
}
