# Deployment guide (free tier: Supabase + Render)

This guide takes the Vouch beta from your laptop to a public URL that other people can use, at no cost. It assumes you already have free Supabase and Render accounts.

## 1. Database (Supabase, free)

1. Create a new Supabase project (region closest to your users).
2. Project Settings -> Database -> Connection string -> **Session pooler** (not Transaction pooler, port 6543, which breaks migrations).
3. Copy the URI. It looks like `postgresql://postgres.xxxxx:PASSWORD@aws-0-region.pooler.supabase.com:5432/postgres`.
4. Save it as `DATABASE_URL`. Set `DATABASE_SSL=true`.

Migrations run automatically on server start, so you do not need to run them by hand.

## 2. API server (Render, free web service)

1. Push this repo to GitHub.
2. Render -> New -> Blueprint -> select the repo. Render reads `render.yaml` and creates the web service.
3. In the Render dashboard, set these environment variables (the blueprint leaves them as `sync: false`):
   - `DATABASE_URL` = your Supabase Session pooler URI
   - `DATABASE_SSL` = `true`
   - `JWT_SECRET` = 32+ random chars (`openssl rand -hex 32`)
   - `OTP_PEPPER` = 16+ random chars
   - `ADMIN_TOKEN` = 16+ random chars (save this somewhere safe)
   - `CORS_ORIGINS` = your app's origin, e.g. `https://your-app.example.com` (not `*` in production)
   - `SMS_PROVIDER` = `console` for testing, or `msg91` with `MSG91_AUTH_KEY` + `MSG91_TEMPLATE_ID` for real SMS
   - `PAYMENTS_ENABLED` = `false` (beta mode; flip to `true` only after Part D of the README)
   - `PAYMENT_PROVIDER` = `mock` in beta
   - `MAX_LIVE_IDEAS` = `5`
   - `GOOGLE_CLIENT_ID` = your Google OAuth Web client ID (optional, enables "Continue with Google")
   - `SENTRY_DSN` = your Sentry DSN (optional, free tier is enough)
   - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` = Cloudflare R2 (optional, free tier 10GB; leave empty to use category icons)
4. Deploy. Open `https://YOUR-API/health` -> `{"ok":true}`.
5. Legal pages are already filled with generic content. Review and customize `server/public/*.html` before launch (company name, email, phone, city).

Free Render web services sleep after 15 minutes of inactivity and wake on the next request (cold start ~30s). Fine for a beta.

## 3. Mobile app (Expo)

1. `cd mobile && npm install`
2. Create `mobile/.env`:
   ```
   EXPO_PUBLIC_API_URL=https://YOUR-API
   EXPO_PUBLIC_WEB_URL=https://YOUR-API
   EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-google-web-client-id   # optional
   ```
3. Type check: `npm run typecheck` (should be clean).
4. Test locally: `npx expo start`, scan QR with Expo Go.
5. Build an installable Android APK for testers:
   ```
   npm install -g eas-cli && eas login && eas init
   eas build --platform android --profile preview
   ```
   Download the `.apk` from the link Expo prints and share it.
6. For iOS / App Store, follow Part E of the README.

## 4. Google sign-in (optional)

1. Google Cloud Console -> Create OAuth 2.0 Client ID (Web application).
2. Set `GOOGLE_CLIENT_ID` (server) and `EXPO_PUBLIC_GOOGLE_CLIENT_ID` (mobile) to the Web client ID.
3. The "Continue with Google" button appears on the sign-in screen automatically.
4. Backend verifies the ID token via Google's tokeninfo endpoint. No extra server dependency needed.

## 5. Admin console (free, no extra service)

Open `https://YOUR-API/admin` in a browser. It asks for your `ADMIN_TOKEN` and lets you view reports and remove ideas (which refunds buyers automatically). The token stays in the tab's session storage only.

## 6. Error monitoring (free tier)

1. Create a free Sentry account and project.
2. Set `SENTRY_DSN` in Render env vars (and in local `.env` for testing).
3. Errors are captured automatically; the app keeps working even if Sentry is down.

## 7. Verifying before you share

- `GET /health` returns `{"ok":true}`.
- `GET /api/v1/config` returns `{"paymentsEnabled":false}`.
- Sign in with any 10-digit number, read the code from the server log (console SMS) or your phone (MSG91).
- Post an idea, vouch, leave feedback, tap "I'm interested".
- Check `https://YOUR-API/admin` with your admin token for moderation.

## 8. What is still not built (honest list)

See README Part G. In short: paying founders, image uploads, push notifications, admin web UI polish, delivery tracking. These need external services (S3/R2, Apple push, Razorpay Route) and are out of scope for the free beta. The core idea-validation loop (post, vouch, want, comment, follow, report, block, account deletion) works end to end in beta mode.

## Free-tier limits to be aware of

- Supabase free projects pause after 7 days of inactivity (Pro removes the pause).
- Render free web services sleep after 15 minutes of inactivity.
- EAS free tier gives a limited number of builds per month.
- MSG91 SMS is paid (not free) — keep `SMS_PROVIDER=console` for a free beta.