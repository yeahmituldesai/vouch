# Deployment guide (free tier: Supabase + Render)

This guide takes the Vouch beta from your laptop to a public URL that other people can use, at no cost. It assumes you already have free Supabase and Render accounts.

## 1. Database (Supabase, free)

1. Create a new Supabase project (region closest to your users).
2. Project Settings → Database → Connection string → **Session pooler** (not Transaction pooler, port 6543, which breaks migrations).
3. Copy the URI. It looks like `postgresql://postgres.xxxxx:PASSWORD@aws-0-region.pooler.supabase.com:5432/postgres`.
4. Save it as `DATABASE_URL`. Set `DATABASE_SSL=true`.

Migrations run automatically on server start, so you do not need to run them by hand.

**Common failure:** `password authentication failed for user "postgres"` means the password in `DATABASE_URL` is stale or the host is the direct database host instead of the pooler. Rotate the database password in Supabase, re-copy the Session pooler URI, and update Render.

## 2. API server (Render, free web service)

1. Push this repo to GitHub.
2. Render → New → Blueprint → select the repo. Render reads `render.yaml` and creates the web service.
3. In the Render dashboard, set these environment variables (the blueprint leaves them as `sync: false`):
   - `DATABASE_URL` = your Supabase Session pooler URI
   - `DATABASE_SSL` = `true`
   - `JWT_SECRET` = 32+ random chars (`openssl rand -hex 32`)
   - `OTP_PEPPER` = 16+ random chars
   - `ADMIN_TOKEN` = 16+ random chars (save this somewhere safe)
   - `CORS_ORIGINS` = `*` for the beta, or your web origin later
   - `PAYMENTS_ENABLED` = `false` (beta mode; flip to `true` only after Part D of the README)
   - `PAYMENT_PROVIDER` = `mock` in beta
   - `MAX_LIVE_IDEAS` = `5`
   - `GOOGLE_CLIENT_ID` = your Google OAuth Web client ID (required for production sign-in)
   - `SENTRY_DSN` = your Sentry DSN (optional, free tier is enough)
   - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` = Cloudflare R2 (optional, free tier 10GB; leave empty to use category icons)
4. Deploy. Open `https://YOUR-API/health` → `{"ok":true}`.
5. Review `server/public/*.html` before launch. They already use the real contact email and Google-only sign-in text.

Free Render web services sleep after 15 minutes of inactivity and wake on the next request (cold start ~30s). Fine for a beta.

## 3. Mobile app (Expo)

1. `cd mobile && npm install`
2. Create `mobile/.env`:
   ```
   EXPO_PUBLIC_API_URL=https://YOUR-API
   EXPO_PUBLIC_WEB_URL=https://YOUR-API
   EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-google-web-client-id
   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your-google-android-client-id
   EXPO_PUBLIC_SENTRY_DSN=optional
   ```
3. Type check: `npm run typecheck` (should be clean).
4. Test locally: `npx expo start`, scan the QR with Expo Go on Android.
5. Build an installable Android APK for testers:
   ```
   cd android
   ./gradlew assembleRelease --no-daemon
   ```
   The APK is at `android/app/build/outputs/apk/release/app-release.apk`. Attach it to a GitHub Release as `vouch-beta.apk`.
6. iOS is deliberately out of scope for this beta.

## 4. Google sign-in

1. Google Cloud Console → Create OAuth 2.0 Client ID (Web application) and one for Android (`com.vouchapp.vouch` + your signing SHA-1).
2. Set `GOOGLE_CLIENT_ID` (server), `EXPO_PUBLIC_GOOGLE_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` (mobile).
3. Backend verifies the ID token via Google's tokeninfo endpoint. No extra server dependency needed.
4. Phone/OTP sign-in stays disabled in production and exists only for local development and tests.

## 5. Admin console (free, no extra service)

Open `https://YOUR-API/admin` in a browser. It asks for your `ADMIN_TOKEN` and lets you view reports and remove ideas (which refunds buyers automatically when payments are enabled). The token stays in the tab's session storage only.

## 6. Error monitoring (free tier)

1. Create a free Sentry account and project.
2. Set `SENTRY_DSN` in Render env vars, and `EXPO_PUBLIC_SENTRY_DSN` in `mobile/.env` before building.
3. Errors are captured automatically; the app keeps working even if Sentry is down. With an empty DSN, reporting is simply disabled.

## 7. Verifying before you share

- `GET /health` returns `{"ok":true}`.
- `GET /api/v1/config` returns `{"paymentsEnabled":false,...}`.
- Sign in with Google on a real Android device.
- Post an idea, vouch, leave feedback, tap "I'm interested", follow a user, edit your profile.
- Check `https://YOUR-API/admin` with your admin token for moderation.

## 8. What is still not built (honest list)

See README Part G. In short: paying founders, image uploads until storage credentials are set, and delivery tracking. Push notifications and the admin console are implemented. The core idea-validation loop (post, vouch, want, comment, follow, report, block, account deletion) works end to end in beta mode.

## Free-tier limits to be aware of

- Supabase free projects pause after 7 days of inactivity (Pro removes the pause).
- Render free web services sleep after 15 minutes of inactivity.
- EAS free tier gives a limited number of builds per month.
