# Vouch — Launch Checklist (external steps)

Code side is launch-ready for the Android beta. These steps need accounts, people or host access.

## P0 — blocking
- [ ] **Production API is returning HTTP 503.** Redeploy the Render service and check its logs. Likely cause: `DATABASE_URL` auth failure (`password authentication failed for user "postgres"`) or the free instance being suspended.
- [ ] Set the correct `DATABASE_URL` (Supabase Session pooler, port 5432) and `DATABASE_SSL=true` on Render, then confirm `GET /health` returns `{"ok":true}`.
- [x] CI beta-mode failure fixed: `PAYMENTS_ENABLED` is now set per test suite, so the beta suite runs with payments off.
- [x] Legal pages written (`server/public/*.html`) with the real contact email and Google-only sign-in text. Lawyer review skipped per instruction.
- [x] ~~Razorpay live KYC~~ — not needed. Beta mode: "I'm interested" replaces pre-orders.
- [x] ~~MSG91 DLT / SMS~~ — not needed. Google Sign-In is the only production sign-in.
- [x] ~~Apple Developer / TestFlight / iOS~~ — out of scope. Android only.

## P1 — release
- [x] Remove dead UI and fake data (Home post layout, repost/reply buttons, profile header, role pill, placeholder domains, Onboarding 0% chart).
- [x] X-style profiles: back header, Share/Edit profile, stats, tabs, single-column posts with working reply/like/share.
- [x] Handle deep links (`vouch://u/:handle` and `https://…/u/:handle`) resolve through `GET /users/by-handle/:handle`.
- [x] Comment avatars served and rendered.
- [x] Notifications row opens system settings; no "coming soon" dialogs left.
- [x] Sentry SDK installed in the app (`@sentry/react-native` plugin). Mobile DSN configured, APK rebuilt, and a test event accepted by Sentry.
- [x] Server project DSN added to `server/.env` and verified with a test event.
- [ ] Add the same `SENTRY_DSN` to Render and redeploy the API.
- [x] Android APK v0.0.10 built and attached to GitHub Releases.
- [ ] Install v0.0.10 on a real Android phone and smoke-test: Google sign-in, feed, create idea, vouch, comment, follow, edit profile, delete account.
- [ ] Keep the release keystore safe. Beta APKs currently use the debug keystore; a Play Store launch needs a private keystore and a fresh install.

## P2 — growth
- [ ] Configure S3/R2 credentials so image uploads work (`imagesEnabled` becomes true).
- [ ] Small private beta (20–50 people), then widen.
- [ ] Push notification delivery checked on at least two Android OEMs.
- [ ] Moderation rota: someone checks `GET /api/v1/admin/reports` daily.
- [ ] Play Store listing (only when leaving APK distribution): description, screenshots, support/privacy URLs, data-safety form, signed AAB.

## Code-side already done
- Typechecks (server + mobile) clean.
- Server test suite: 21 payments-mode tests + 4 beta-mode tests, run in CI against Postgres 16.
- Android Metro bundle and release APK build.
- Push taps open content; crash boundary; shared web pages for ideas and profiles.
