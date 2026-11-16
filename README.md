# Vouch

## 📱 Beta download (Android)

**Vouch beta-v2** — free, Android only.

1. On your Android phone, open **[download Vouch beta](https://github.com/yeahmituldesai/vouch/releases/latest)**.
2. Allow installing from this source when Chrome asks.
3. Open Vouch, sign in with Google, and post your first idea.

Newer versions are offered inside the app automatically. No payments are taken during the beta — tapping **"I'm interested"** records demand.

> **Beta mode (default).** Payments are switched off. People tap **"I'm interested"** instead of paying. Nothing in the app shows a price or moves money, and the demand score and goals count those taps. No payment account, refunds, founder payouts or payment legal work are needed to run this. To turn real payments on later, set `PAYMENTS_ENABLED=true` on the server and follow Part D. Both modes are tested.

Validate a product idea before you launch it. Founders post an idea, people vouch for it, give feedback and say they are interested.
If payments are enabled and the goal is missed by the deadline, every buyer is refunded automatically.

```
server/   Node + TypeScript + Express + Postgres API  (25 automated tests)
mobile/   Expo (React Native) Android app
```

## What is verified

| Check | Result |
|---|---|
| Backend tests against real Postgres, payments mode (sign-in, ideas, vouches, pre-orders, webhooks, refunds, moderation, blocking, account deletion) | 21 of 21 pass |
| Backend tests, no-money beta mode (“I’m interested”, deadline results, no payment routes, ideas without prices) | 4 of 4 pass |
| Backend type check and production build | clean |
| Dependency audit (production) | 0 vulnerabilities |
| Production start-up guard (refuses mock payments, console SMS, open CORS) | works |
| Mobile type check | clean |
| Android release APK built and published | beta-v2 (versionCode 16) |
| Profile photo / header rules | X-parity: avatar 400×400 ≤ 2 MB, header 1500×500 ≤ 5 MB, JPG/PNG/GIF |

Not verified, because it needs real accounts or a device: real payments (Razorpay), push delivery on every OEM, and image uploads (storage is not configured). Test these yourself in Part D.

---

## Part A. Run everything on your computer (30 minutes)

You need Node 20+ and PostgreSQL 14+.

1. Create the databases
   ```
   createdb vouch_dev && createdb vouch_test
   ```
2. Start the API
   ```
   cd server
   npm install
   cp .env.example .env        # edit DATABASE_URL if your Postgres user or password differ
   npm run migrate
   npm run dev                 # http://localhost:4000
   ```
   In development the sign-in code is printed in the server log and returned by the API, and payments are fake (no money moves).
3. Run the tests: `npm test` (uses `.env.test` and the `vouch_test` database).
4. Start the app
   ```
   cd ../mobile
   npm install
   cp .env.example .env
   ```
   Edit `.env` and set `EXPO_PUBLIC_API_URL` to your computer's local IP, for example `http://192.168.1.20:4000` (a phone cannot reach `localhost`).
   ```
   npx expo start
   ```
   Scan the QR code with Expo Go on Android. Sign in with Google (set `EXPO_PUBLIC_GOOGLE_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` first).

## Part B. Accounts you need to create

| Account | Why | Cost and lead time |
|---|---|---|
| GitHub | Source code and APK releases | free |
| Google Cloud | Google Sign-In OAuth client | free |
| Expo (expo.dev) | Optional cloud builds (EAS) | free tier is enough to start |
| Render, Railway or similar | Hosts the API | about ₹1,500 to ₹3,000 per month |
| Supabase (or any Postgres) | Database | free tier is enough for the beta |
| Razorpay | Payments and refunds. **Not needed for the beta.** | Free to open, 2% + GST per payment, business KYC needed |
| A domain name | API address, legal pages | about ₹800 per year |

Apple Developer Program, TestFlight, MSG91/SMS and Razorpay KYC are **not** needed: this beta is Android-only, sign-in is Google-only, and no money moves.

## Part C. Put the API online

1. Push this folder to GitHub.
2. In Render choose New, then Blueprint, and select the repo. It reads `render.yaml`.
3. Set `DATABASE_URL` to your Postgres connection string (Supabase Session pooler, port 5432, with `DATABASE_SSL=true`). `JWT_SECRET`, `OTP_PEPPER` and `ADMIN_TOKEN` are generated for you. Save `ADMIN_TOKEN` somewhere safe.
4. Set `CORS_ORIGINS` to your real domain (or `*` for the beta).
5. Open `https://YOUR-API/health`. You should see `{"ok":true}`.
6. Legal pages are served from `server/public/*.html` and already contain the real contact email. Have a lawyer review them when you can.
7. Turn on automatic daily database backups in your host.

The server migrates the database on start, and every 10 minutes it closes ideas past their deadline and issues refunds (when payments are enabled).

### Using Supabase for the database

Vouch uses plain Postgres, so Supabase works as the database. The API server itself still needs somewhere to run (Render, Railway or similar), because Supabase only replaces the database.

1. Create a Supabase project. In Project Settings, Database, copy the **Session pooler** connection string (not the Transaction pooler on port 6543, which breaks migrations).
2. Put it in `DATABASE_URL` and set `DATABASE_SSL=true`.
3. Run `npm run migrate` once from your computer, or let the server migrate on start.
4. The free Supabase plan pauses a project after a week with no activity. That is fine for testing but not for real users. The Pro plan removes the pause.
5. You do not need to write Supabase Row Level Security rules for this setup, because the app never talks to the database directly. Only your API does. Keep the database password secret and never put it in the app.

## Part D. Turn on real payments later (skip this for the beta; do it in test mode first)

1. In Razorpay open Test Mode and copy the Key ID and Key Secret into the API environment (`PAYMENT_PROVIDER=razorpay`).
2. Razorpay Dashboard, Webhooks: add `https://YOUR-API/webhooks/payments`, tick `payment.captured`, set a secret, and put the same secret in `RAZORPAY_WEBHOOK_SECRET`.
3. Install the checkout module in the app: `cd mobile && npx expo install react-native-razorpay`. It does not run in Expo Go, so use a development build.
4. Make a test pre-order with Razorpay test UPI or card details. Confirm the order shows Paid.
5. Let an idea expire with its goal missed and confirm the refund appears in Razorpay. Do this on a test idea with a short deadline: in the database run `UPDATE ideas SET deadline = now() - interval '1 minute' WHERE id = '...'` then wait for the next settlement run, or call `POST /api/v1/admin/settlement/run` with your `x-admin-token`.
6. Only then switch to live keys.

## Part E. Build and publish the Android APK

The beta is distributed as a signed APK attached to a GitHub Release. No Play Store listing is needed.

1. `cd mobile && npm ci`
2. Build locally (requires JDK 21 and the Android SDK):
   ```
   cd android
   ./gradlew assembleRelease --no-daemon
   ```
   The APK is written to `android/app/build/outputs/apk/release/app-release.apk`.
3. Bump `version`/`versionCode` in `mobile/app.json` (and `android/app/build.gradle` if it is checked in), plus `server/src/lib/appVersion.ts` so the in-app update prompt points at the new file.
4. Create a GitHub Release tagged `vX.Y.Z`, attach the APK as `vouch-beta.apk`, and publish.
5. Testers open the latest release link on an Android phone, download the file, and allow installing from this source when the phone asks.

> **Signing note.** Beta APKs are signed with the local debug keystore so updates install over each other. Before a public launch, generate a private release keystore, keep it out of the repo, and ship a fresh install (switching keys cannot update an existing install).

The app is not signed for Google Play, which is fine for testing. Do not put passwords or API keys in the repo. `.env` files are already ignored.

## Part F. Before real users

- [ ] Legal pages reviewed by a lawyer
- [x] Android APK built, signed and published
- [ ] Production API healthy (`/health` returns `{"ok":true}`)
- [ ] `DATABASE_URL` on the host points at the right database and migrations run
- [ ] Sentry DSN set for the app and the API (`SENTRY_DSN`)
- [ ] Image storage configured (S3/R2) so uploads work
- [ ] Razorpay live KYC complete and a written plan for how money reaches founders (see below)
- [ ] A refund tested end to end in Razorpay test mode and again with a small live payment
- [ ] Someone is responsible for checking `GET /api/v1/admin/reports` daily and removing bad ideas
- [ ] Small private beta first (20 to 50 people), then widen

## Part G. What is not built yet (be honest with yourself and your users)

1. **Paying founders.** When an idea is funded, the money is in your Razorpay account. The app records that the idea is funded and notifies the founder, but it does not pay the founder or take your commission. Holding customer money and passing it to sellers is regulated in India. Use a compliant setup such as Razorpay Route, or an escrow arrangement approved by your payment partner, and get legal and accounting advice (GST, TDS, commission invoices) before you launch.
2. **The equity idea.** Not built. It needs proper agreements and legal advice and should not be added until the core product works.
3. **Images.** Idea photos need storage credentials. Without `S3_*`/`R2_*` set, image uploads are disabled (`imagesEnabled=false`) and ideas show a drawn category icon.
4. **Delivery tracking, disputes and founder verification.** Plan these once real orders start.

## API cheat sheet

`POST /api/v1/auth/google`, `GET|PATCH|DELETE /api/v1/me`, `GET /api/v1/ideas`, `POST /api/v1/ideas`, `POST /api/v1/ideas/:id/vouch`, `GET|POST /api/v1/ideas/:id/comments`, `POST /api/v1/ideas/:id/orders`, `POST /api/v1/orders/:id/verify`, `GET /api/v1/users/by-handle/:handle`, `POST /api/v1/users/:id/follow`, `POST /api/v1/users/:id/block`, `POST /api/v1/ideas/:id/report`, `POST /webhooks/payments`, and admin routes under `/api/v1/admin` with the `x-admin-token` header.
