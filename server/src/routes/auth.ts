import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config';
import { q } from '../db';
import { HttpError, parse, wrap } from '../lib/http';
import { hashOtp, normalizePhone, safeEq, signToken } from '../lib/auth';
import { sendOtp } from '../lib/sms';

export const publicUser = (u: any) => ({ id: u.id, name: u.name, handle: u.handle, bio: u.bio ?? '', avatarUrl: u.avatar_url ?? null });
const r = Router();
const isReview = (phone: string) => !!config.REVIEW_PHONE && !!config.REVIEW_CODE && phone === normalizePhone(config.REVIEW_PHONE);

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, skip: () => config.NODE_ENV === 'test' });
const phoneSchema = z.string().min(8).max(20);

r.post('/otp/request', limiter, wrap(async (req, res) => {
  const body = parse(z.object({ phone: phoneSchema }), req.body);
  const phone = normalizePhone(body.phone);
  if (!phone) throw new HttpError(400, 'INVALID_PHONE', 'Enter a valid mobile number');
  if (isReview(phone)) return void res.json({ ok: true });
  const prev = (await q('SELECT created_at FROM otps WHERE phone = $1', [phone])).rows[0];
  if (prev && Date.now() - new Date(prev.created_at).getTime() < 30_000)
    throw new HttpError(429, 'TOO_SOON', 'Wait 30 seconds before asking for another code');
  const code = String(crypto.randomInt(100000, 1000000));
  await q(
    `INSERT INTO otps (phone, code_hash, expires_at, attempts, created_at) VALUES ($1,$2, now() + interval '5 minutes', 0, now())
     ON CONFLICT (phone) DO UPDATE SET code_hash = $2, expires_at = now() + interval '5 minutes', attempts = 0, created_at = now()`,
    [phone, hashOtp(phone, code)],
  );
  await sendOtp(phone, code);
  const dev = config.SMS_PROVIDER === 'console';
  res.json({ ok: true, ...(dev ? { devCode: code } : {}) });
}));

r.post('/otp/verify', limiter, wrap(async (req, res) => {
  const body = parse(z.object({ phone: phoneSchema, code: z.string().regex(/^\d{6}$/, 'Enter the 6 digit code') }), req.body);
  const phone = normalizePhone(body.phone);
  if (!phone) throw new HttpError(400, 'INVALID_PHONE', 'Enter a valid mobile number');
  const review = isReview(phone) && safeEq(body.code, config.REVIEW_CODE!);
  const o = review ? { expires_at: new Date(Date.now() + 60000), attempts: 0, code_hash: '' } : (await q('SELECT * FROM otps WHERE phone = $1', [phone])).rows[0];
  if (!o || new Date(o.expires_at).getTime() < Date.now()) throw new HttpError(400, 'CODE_EXPIRED', 'That code has expired. Ask for a new one.');
  if (o.attempts >= 5) {
    await q('DELETE FROM otps WHERE phone = $1', [phone]);
    throw new HttpError(429, 'TOO_MANY_ATTEMPTS', 'Too many wrong codes. Ask for a new one.');
  }
  if (!review && !safeEq(hashOtp(phone, body.code), o.code_hash)) {
    await q('UPDATE otps SET attempts = attempts + 1 WHERE phone = $1', [phone]);
    throw new HttpError(400, 'BAD_CODE', 'That code is not correct');
  }
  await q('DELETE FROM otps WHERE phone = $1', [phone]);
  let user = (await q('SELECT * FROM users WHERE phone = $1', [phone])).rows[0];
  let isNew = false;
  for (let n = 0; !user && n < 5; n++) {
    try {
      user = (await q('INSERT INTO users (phone, handle) VALUES ($1, $2) RETURNING *', [phone, 'user' + crypto.randomBytes(3).toString('hex')])).rows[0];
      isNew = true;
    } catch (e: any) {
      if (e.code !== '23505') throw e;
      user = (await q('SELECT * FROM users WHERE phone = $1', [phone])).rows[0];
    }
  }
  if (!user) throw new HttpError(500, 'SIGNUP_FAILED', 'Could not create your account');
  if (user.is_banned) throw new HttpError(403, 'BANNED', 'This account has been suspended');
  res.json({ token: signToken(user.id), user: publicUser(user), isNew });
}));

// Google sign-in (optional, enabled when GOOGLE_CLIENT_ID is set).
r.post('/google', limiter, wrap(async (req, res) => {
  if (!config.GOOGLE_CLIENT_ID) throw new HttpError(501, 'GOOGLE_DISABLED', 'Google sign-in is not configured');
  const body = parse(z.object({ idToken: z.string().min(1) }), req.body);
  const vr = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(body.idToken));
  if (!vr.ok) throw new HttpError(401, 'BAD_GOOGLE_TOKEN', 'That Google sign-in was not valid');
  const info = await vr.json() as { aud?: string; iss?: string; exp?: string; sub?: string; email?: string; name?: string };
  if (info.aud !== config.GOOGLE_CLIENT_ID) throw new HttpError(401, 'BAD_GOOGLE_AUDIENCE', 'Google sign-in was for a different app');
  if (info.iss !== 'accounts.google.com' && info.iss !== 'https://accounts.google.com') throw new HttpError(401, 'BAD_GOOGLE_ISSUER', 'Invalid Google token issuer');
  if (!info.sub) throw new HttpError(401, 'BAD_GOOGLE_TOKEN', 'Google token missing subject');
  if (info.exp && Number(info.exp) * 1000 < Date.now()) throw new HttpError(401, 'EXPIRED_GOOGLE_TOKEN', 'Google sign-in expired. Try again.');
  const googleSub = info.sub;
  let user = (await q('SELECT * FROM users WHERE google_sub = $1', [googleSub])).rows[0];
  let isNew = false;
  if (!user) {
    for (let n = 0; !user && n < 5; n++) {
      try {
        const handle = 'user' + crypto.randomBytes(3).toString('hex');
        user = (await q(
          'INSERT INTO users (phone, handle, name, google_sub, email) VALUES (NULL, $1, $2, $3, $4) RETURNING *',
          [handle, info.name ?? '', googleSub, info.email ?? null],
        )).rows[0];
        isNew = true;
      } catch (e: any) {
        if (e.code !== '23505') throw e;
        user = (await q('SELECT * FROM users WHERE google_sub = $1', [googleSub])).rows[0];
      }
    }
  }
  if (!user) throw new HttpError(500, 'SIGNUP_FAILED', 'Could not create your account');
  if (user.is_banned) throw new HttpError(403, 'BANNED', 'This account has been suspended');
  res.json({ token: signToken(user.id), user: publicUser(user), isNew });
}));

export default r;
