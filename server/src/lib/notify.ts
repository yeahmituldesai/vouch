import type { Db } from '../db';

export async function notify(db: Db, userId: string, type: string, title: string, body = '', data: Record<string, unknown> = {}) {
  await db.query('INSERT INTO notifications (user_id, type, title, body, data) VALUES ($1,$2,$3,$4,$5)', [
    userId, type, title, body, JSON.stringify(data),
  ]);
}
