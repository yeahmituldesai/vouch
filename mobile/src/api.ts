const BASE = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
let token: string | null = null;
let onUnauthorized: () => void = () => {};
export const setToken = (t: string | null) => { token = t; };
export const setOnUnauthorized = (f: () => void) => { onUnauthorized = f; };

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 60000);
  try {
    const r = await fetch(`${BASE}/api/v1${path}`, {
      method: opts.method ?? 'GET',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: ctl.signal,
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      if (r.status === 401 && token) onUnauthorized();
      throw new ApiError(r.status, j?.error?.code ?? 'ERROR', j?.error?.message ?? 'Something went wrong');
    }
    return j as T;
  } catch (e: any) {
    if (e instanceof ApiError) throw e;
    if (e?.name === 'AbortError') throw new ApiError(0, 'TIMEOUT', 'The server is waking up. Please try again.');
    throw new ApiError(0, 'NETWORK', 'Could not reach Vouch. Check your connection.');
  } finally {
    clearTimeout(timer);
  }
}
