import { q } from '../db';

export async function sendPush(pushToken: string | null | undefined, title: string, body: string, data?: Record<string, unknown>) {
  if (!pushToken) return;
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ to: pushToken, title, body, data: data ?? {}, sound: 'default', priority: 'high' }),
    });
  } catch { /* best effort */ }
}

export async function pushToUser(userId: string, title: string, body: string, data?: Record<string, unknown>) {
  const rows = (await q('SELECT push_token FROM users WHERE id = $1', [userId])).rows;
  await sendPush(rows[0]?.push_token, title, body, data);
}