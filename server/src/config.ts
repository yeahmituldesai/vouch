import { z } from 'zod';

const schema = z
  .object({
    // false = beta mode: no money moves. People tap "I'd buy this" instead of paying.
    PAYMENTS_ENABLED: z.enum(['true', 'false']).default('false'),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(4000),
    DATABASE_URL: z.string().min(1),
    // Set to true for hosted databases such as Supabase that require an encrypted connection.
    DATABASE_SSL: z.enum(['true', 'false']).default('false'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    OTP_PEPPER: z.string().min(16),
    CORS_ORIGINS: z.string().default('*'),
    SMS_PROVIDER: z.enum(['console', 'msg91']).default('console'),
    MSG91_AUTH_KEY: z.string().optional(),
    MSG91_TEMPLATE_ID: z.string().optional(),
    PAYMENT_PROVIDER: z.enum(['mock', 'razorpay']).default('mock'),
    RAZORPAY_KEY_ID: z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
    ADMIN_TOKEN: z.string().min(16).optional().or(z.literal('')),
    MAX_LIVE_IDEAS: z.coerce.number().default(5),
    // Optional App Store review login: a fixed phone and 6 digit code that skip SMS. Leave empty to disable.
    REVIEW_PHONE: z.string().optional().or(z.literal('')),
    REVIEW_CODE: z.string().regex(/^\d{6}$/).optional().or(z.literal('')),
    // Optional Google sign-in. Set to your Google OAuth client ID to enable. Leave empty to disable.
    GOOGLE_CLIENT_ID: z.string().optional().or(z.literal('')),
    GOOGLE_ANDROID_CLIENT_ID: z.string().optional().or(z.literal('')),
    // Optional error monitoring. Set a Sentry DSN to enable. Free tier is enough for a beta.
    SENTRY_DSN: z.string().optional().or(z.literal('')),
    // (App version info is hardcoded in app.ts, not env-driven.)
    // Optional image uploads via Cloudflare R2 / S3-compatible storage (free tier: 10GB).
    R2_ACCOUNT_ID: z.string().optional().or(z.literal('')),
    R2_ACCESS_KEY: z.string().optional().or(z.literal('')),
    R2_SECRET_KEY: z.string().optional().or(z.literal('')),
    R2_BUCKET: z.string().optional().or(z.literal('')),
    R2_PUBLIC_URL: z.string().optional().or(z.literal('')),
    SETTLEMENT_INTERVAL_MS: z.coerce.number().default(600000),
  })
  .superRefine((c, ctx) => {
    if (c.NODE_ENV === 'production') {
      if (c.PAYMENTS_ENABLED === 'true') {
        if (c.PAYMENT_PROVIDER === 'mock')
          ctx.addIssue({ code: 'custom', message: 'PAYMENT_PROVIDER=mock is not allowed in production' });
        if (c.SMS_PROVIDER === 'console')
          ctx.addIssue({ code: 'custom', message: 'SMS_PROVIDER=console is not allowed when payments are enabled' });
        if (c.CORS_ORIGINS === '*')
          ctx.addIssue({ code: 'custom', message: 'Set CORS_ORIGINS to your real origins in production when payments are enabled' });
      }
    }
    if (!!c.REVIEW_PHONE !== !!c.REVIEW_CODE)
      ctx.addIssue({ code: 'custom', message: 'Set both REVIEW_PHONE and REVIEW_CODE, or neither' });
    if (c.PAYMENTS_ENABLED === 'true' && c.PAYMENT_PROVIDER === 'razorpay' && !(c.RAZORPAY_KEY_ID && c.RAZORPAY_KEY_SECRET && c.RAZORPAY_WEBHOOK_SECRET))
      ctx.addIssue({ code: 'custom', message: 'Razorpay keys and webhook secret are required' });
    if (c.SMS_PROVIDER === 'msg91' && !(c.MSG91_AUTH_KEY && c.MSG91_TEMPLATE_ID))
      ctx.addIssue({ code: 'custom', message: 'MSG91_AUTH_KEY and MSG91_TEMPLATE_ID are required' });
  });

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:\n' + parsed.error.issues.map((i) => ` - ${i.message}`).join('\n'));
  process.exit(1);
}
export const config = parsed.data;
