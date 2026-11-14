# Vouch

## 📱 Beta download (Android)

**Vouch beta v0.0.3** — free, Android only.

1. On your Android phone, open **[download Vouch beta](https://github.com/yeahmituldesai/vouch/releases/download/vouch-beta-v0.0.3/vouch-beta.apk)**.
2. Allow installing from this source when Chrome asks.
3. Open Vouch, sign in with Google, and post your first idea.

Newer versions are offered inside the app automatically. No payments are taken during the beta — tapping **"I'm interested"** records demand.

> **Beta mode (default).** Payments are switched off. People tap **"I'm interested"** instead of paying. Nothing in the app shows a price or any money, and the demand score and goals count those taps. No payment account, refunds, founder payouts or payment legal work are needed to run this. To turn real payments on later, set `PAYMENTS_ENABLED=true` on the server and follow Part D. Both modes are tested.

Validate a product idea before you launch it. Founders post an idea, people vouch for it, give feedback and pre-order.
If the goal is missed by the deadline, every buyer is refunded automatically.

```
server/   Node + TypeScript + Express + Postgres API  (21 automated tests)
mobile/   Expo (React Native) iPhone and Android app
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
| Mobile iOS bundle (Metro) | builds |
| Mobile client code against the live server (auth, feed, vouch, comments, mock payment, orders, notifications) | passes |

Not verified, because it needs real accounts or a device: real SMS (MSG91), real payments (Razorpay), App Store review, how the app looks on a physical iPhone. Test these yourself in Part D and E.

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
   Scan the QR code with the Expo Go app on your iPhone. Sign in with Google (set EXPO_PUBLIC_GOOGLE_CLIENT_ID first).

## Part B. Accounts you need to create

| Account | Why | Cost and lead time |
|---|---|---|
| Apple Developer Program | App Store and TestFlight | about ₹8,000 per year, 1 to 2 days to approve |
| Expo (expo.dev) | Builds the iPhone app in the cloud (EAS) | free tier is enough to start |
| Razorpay | Payments and refunds. **Not needed for the beta.** | Free to open, 2% + GST per payment, business KYC needed |
| MSG91 (or similar) | Sends sign-in codes by SMS | India needs DLT registration and an approved template, which can take 1 to 2 weeks. Start this first |
| Render, Railway or similar | Hosts the API and Postgres | about ₹1,500 to ₹3,000 per month |
| A domain name | API address, legal pages | about ₹800 per year |

## Part C. Put the API online

1. Push this folder to GitHub.
2. In Render choose New, then Blueprint, and select the repo. It reads `render.yaml` and creates the API and a database.
3. Fill the environment variables Render asks for (MSG91 and Razorpay keys). `JWT_SECRET`, `OTP_PEPPER` and `ADMIN_TOKEN` are generated for you. Save `ADMIN_TOKEN` somewhere safe.
4. Set `CORS_ORIGINS` to your real domain.
5. Open `https://YOUR-API/health`. You should see `{"ok":true}`.
6. Fill every `[[PLACEHOLDER]]` in `server/public/*.html` (terms, privacy, refunds, support) and have a lawyer review them. The server prints a warning on every start until you do.
7. Turn on automatic daily database backups in your host.

The server migrates the database on start, and every 10 minutes it closes ideas past their deadline and issues refunds.

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
3. Install the checkout module in the app: `cd mobile && npx expo install react-native-razorpay`. It does not run in Expo Go, so use a development build: `npx eas build --profile development --platform ios`.
4. Make a test pre-order with Razorpay test UPI or card details. Confirm the order shows Paid.
5. Let an idea expire with its goal missed and confirm the refund appears in Razorpay. Do this on a test idea with a short deadline: in the database run `UPDATE ideas SET deadline = now() - interval '1 minute' WHERE id = '...'` then wait for the next settlement run, or call `POST /api/v1/admin/settlement/run` with your `x-admin-token`.
6. Only then switch to live keys.

## Part E. Build and submit the iPhone app

1. `cd mobile && npm install -g eas-cli && eas login && eas init`
2. In `eas.json` replace the two `YOUR-...example.com` addresses with your API address. In `mobile/.env` set `EXPO_PUBLIC_WEB_URL` to the same address, since the legal pages are served by the API.
3. In `app.json` change `ios.bundleIdentifier` to one you own.
4. Build: `eas build --profile production --platform ios`
5. Send to TestFlight: `eas submit --platform ios`. Install it on your phone and test everything with real SMS.
6. In App Store Connect fill the app listing: description, screenshots, support URL (`https://YOUR-API/support`), privacy policy URL (`https://YOUR-API/privacy`), age rating, and the privacy questions (you collect phone number, name, purchases and user content).
7. App Review notes: set `REVIEW_PHONE` and `REVIEW_CODE` on the API, then give Apple that number and code as the demo login. Explain that pre-orders are refunded if the goal is missed.
8. Submit for review. Apple usually replies in 1 to 3 days.

Apple review points already handled: sign-in without social logins, report and block for user content, in-app account deletion, privacy and terms links, support contact.

Apple rule to check with your payments setup: Apple requires in-app purchase for digital goods and services consumed in the app. Pre-orders for physical products (snacks, skincare, clothing) are allowed to use outside payment. If you let people pre-order an app or digital product, get advice before submitting.

## Part F. Before real users

- [ ] Legal pages filled and reviewed by a lawyer
- [ ] Razorpay live KYC complete and a written plan for how money reaches founders (see below)
- [ ] MSG91 DLT template approved and sending real codes
- [ ] Tested on at least 3 real iPhones through TestFlight
- [ ] A refund tested end to end in Razorpay test mode and again with a small live payment
- [ ] Error monitoring added (Sentry works with both server and app)
- [ ] Someone is responsible for checking `GET /api/v1/admin/reports` daily and removing bad ideas
- [ ] Small private beta first (20 to 50 people), then widen

## Part G. What is not built yet (be honest with yourself and your users)

1. **Paying founders.** When an idea is funded, the money is in your Razorpay account. The app records that the idea is funded and notifies the founder, but it does not pay the founder or take your commission. Holding customer money and passing it to sellers is regulated in India. Use a compliant setup such as Razorpay Route, or an escrow arrangement approved by your payment partner, and get legal and accounting advice (GST, TDS, commission invoices) before you launch.
2. **The equity idea.** Not built. It needs proper agreements and legal advice and should not be added until the core product works.
3. **Images.** Ideas show a drawn icon for their category. Real product photos need image upload and storage (for example S3 or Cloudflare R2).
4. **Push notifications.** Notifications live inside the app. Real push needs Apple's push service and `expo-notifications`.
5. **Admin screen.** Moderation uses API calls with your admin token, listed in `server/src/routes/admin.ts`.
6. **Android.** The app is written to run there, but only iOS was bundled and checked.
7. **Delivery tracking, disputes and founder verification.** Plan these once real orders start.

## API cheat sheet

`POST /api/v1/auth/otp/request`, `POST /api/v1/auth/otp/verify`, `GET|PATCH|DELETE /api/v1/me`, `GET /api/v1/ideas`, `POST /api/v1/ideas`, `POST /api/v1/ideas/:id/vouch`, `GET|POST /api/v1/ideas/:id/comments`, `POST /api/v1/ideas/:id/orders`, `POST /api/v1/orders/:id/verify`, `POST /api/v1/users/:id/follow`, `POST /api/v1/users/:id/block`, `POST /api/v1/ideas/:id/report`, `POST /webhooks/payments`, and admin routes under `/api/v1/admin` with the `x-admin-token` header.


## Share a test Android app through GitHub (no store needed)

1. `cd mobile && npm install -g eas-cli && eas login && eas init`
2. Set your API address in `eas.json` under `preview`, then run `eas build --platform android --profile preview`. This builds an installable `.apk`.
3. When it finishes, download the `.apk` from the link Expo shows.
4. On GitHub open your repo, Releases, Draft a new release, attach the `.apk`, publish. Share the release link.
5. Testers open the link on an Android phone, download the file, and allow installing from this source when the phone asks.

The app is not signed for Google Play, which is fine for testing. Do not put passwords or API keys in the repo. `.env` files are already ignored.
