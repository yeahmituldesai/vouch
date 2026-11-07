import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';
import { q } from '../db';
import { HttpError } from './http';

export type AuthUser = { id: string; phone: string | null; name: string; handle: string };
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const signToken = (userId: string) =>
  jwt.sign({ sub: userId }, config.JWT_SECRET, { expiresIn: '30d', algorithm: 'HS256' });

export function normalizePhone(raw: string): string | null {
  const d = raw.replace(/[\s-]/g, '');
  if (/^\+[1-9]\d{9,14}$/.test(d)) return d;
  if (/^[6-9]\d{9}$/.test(d)) return '+91' + d;
  return null;
}

export const hashOtp = (phone: string, code: string) =>
  crypto.createHmac('sha256', config.OTP_PEPPER).update(`${phone}:${code}`).digest('hex');

export function safeEq(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

async function load(req: Request): Promise<AuthUser | null> {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return null;
  let sub: string;
  try {
    const p = jwt.verify(h.slice(7), config.JWT_SECRET, { algorithms: ['HS256'] }) as { sub?: string };
    if (!p.sub) return null;
    sub = p.sub;
  } catch {
    throw new HttpError(401, 'UNAUTHORIZED', 'Your session has expired. Sign in again.');
  }
  const { rows } = await q('SELECT id, phone, name, handle, is_banned FROM users WHERE id = $1', [sub]);
  const u = rows[0];
  if (!u) throw new HttpError(401, 'UNAUTHORIZED', 'Account not found');
  if (u.is_banned) throw new HttpError(403, 'BANNED', 'This account has been suspended');
  return { id: u.id, phone: u.phone, name: u.name, handle: u.handle };
}

export const requireAuth = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const u = await load(req);
    if (!u) throw new HttpError(401, 'UNAUTHORIZED', 'Sign in required');
    req.user = u;
    next();
  } catch (e) {
    next(e);
  }
};

export const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const u = await load(req);
    if (u) req.user = u;
    next();
  } catch (e) {
    next(e);
  }
};

export const requireAdmin = (req: Request, _res: Response, next: NextFunction) => {
  const t = req.headers['x-admin-token'];
  if (!config.ADMIN_TOKEN || typeof t !== 'string' || !safeEq(t, config.ADMIN_TOKEN))
    return next(new HttpError(403, 'FORBIDDEN', 'Admin only'));
  next();
};
