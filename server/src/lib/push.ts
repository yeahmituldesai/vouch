import jwt from 'jsonwebtoken';
import { config } from '../config';
import { q } from '../db';

type ServiceAccount = { projectId: string; clientEmail: string; privateKey: string };

let serviceAccountCache: ServiceAccount | null | undefined;
let tokenCache: { accessToken: string; expiresAt: number } | null = null;

/**
 * FCM credentials come from an environment variable on the API host, or from
 * the private app_config table (RLS enabled, service connection only) so they
 * can be rotated without a redeploy.
 */
async function loadServiceAccount(): Promise<ServiceAccount | null> {
  if (serviceAccountCache !== undefined) return serviceAccountCache;

  let raw = config.FCM_SERVICE_ACCOUNT_BASE64 || '';
  if (!raw) {
    try {
      const { rows } = await q("SELECT value FROM app_config WHERE key = 'FCM_SERVICE_ACCOUNT_BASE64'");
      raw = rows[0]?.value ?? '';
    } catch {
      raw = '';
    }
  }
  if (!raw) return (serviceAccountCache = null);

  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) return (serviceAccountCache = null);
    serviceAccountCache = {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      // Some hosts store the key with escaped newlines; normalise either way.
      privateKey: String(parsed.private_key).replace(/\\n/g, '\n'),
    };
  } catch {
    serviceAccountCache = null;
  }
  return serviceAccountCache;
}

async function fcmAccessToken(): Promise<string | null> {
  const account = await loadServiceAccount();
  if (!account) return null;
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.accessToken;

  const issuedAt = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: account.clientEmail,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: issuedAt,
      exp: issuedAt + 3600,
    },
    account.privateKey,
    { algorithm: 'RS256' },
  );

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });
  if (!res.ok) {
    console.warn('FCM auth failed', res.status, await res.text().catch(() => ''));
    return null;
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;
  tokenCache = { accessToken: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return tokenCache.accessToken;
}

function isExpoToken(token: string) {
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
}

async function sendExpoPush(token: string, title: string, body: string, data?: Record<string, unknown>) {
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ to: token, title, body, data: data ?? {}, sound: 'default', priority: 'high' }),
  });
}

async function sendFcmPush(token: string, title: string, body: string, data?: Record<string, unknown>) {
  const account = await loadServiceAccount();
  if (!account) return;
  const accessToken = await fcmAccessToken();
  if (!accessToken) return;

  // FCM data payload values must be strings.
  const stringData: Record<string, string> = {};
  for (const [key, value] of Object.entries(data ?? {})) {
    stringData[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }

  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${account.projectId}/messages:send`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data: stringData,
        android: {
          priority: 'high',
          notification: { channel_id: 'default', sound: 'default' },
        },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.warn('FCM send failed', res.status, text.slice(0, 300));
    // Token is no longer valid (app uninstalled, data cleared): drop it.
    if (res.status === 404 || text.includes('UNREGISTERED')) throw new Error('UNREGISTERED');
  }
}

async function deliver(token: string, title: string, body: string, data?: Record<string, unknown>) {
  if (isExpoToken(token)) await sendExpoPush(token, title, body, data);
  else await sendFcmPush(token, title, body, data);
}

export async function sendPush(pushToken: string | null | undefined, title: string, body: string, data?: Record<string, unknown>) {
  if (!pushToken) return;
  try {
    await deliver(pushToken, title, body, data);
  } catch {
    /* best effort */
  }
}

export async function pushToUser(userId: string, title: string, body: string, data?: Record<string, unknown>) {
  const rows = (await q('SELECT push_token FROM users WHERE id = $1', [userId])).rows;
  const token: string | null = rows[0]?.push_token ?? null;
  if (!token) return;
  try {
    await deliver(token, title, body, data);
  } catch (error) {
    if ((error as Error).message === 'UNREGISTERED') {
      await q('UPDATE users SET push_token = NULL WHERE id = $1 AND push_token = $2', [userId, token]).catch(() => {});
    }
  }
}

export async function pushConfigured() {
  return (await loadServiceAccount()) !== null;
}
