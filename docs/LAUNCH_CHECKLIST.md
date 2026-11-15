# Vouch — Launch Checklist (external steps)

Code side is launch-ready. These steps need accounts/people:

## P0
- [ ] Run DB tests in CI (workflow `.github/workflows/ci.yml`) — push to GitHub and confirm green.
- [x] Legal pages written (`server/public/*.html`): terms, privacy, refunds, support, security. Lawyer review skipped per instruction.
- [x] ~~Razorpay live KYC~~ — SKIPPED. Running in beta mode (no money). "I'm interested" replaces pre-orders. No payment account, refunds, or payout work needed. (See README beta note.)
- [x] ~~MSG91 DLT / SMS~~ — NOT NEEDED. Sign-in is Google-only in production (phone/OTP disabled). No SMS provider required.

## P1
- [x] ~~Apple Developer Program / bundle id~~ — SKIPPED. Shipping Android only (APK via EAS preview profile). iOS store release deferred. Bundle id stays `com.vouchapp.vouch`.
- [x] EAS Android build complete — APK downloaded to `vouch-beta.apk` (84 MB). Upload to GitHub Releases manually (no `gh` CLI available). iOS/TestFlight skipped.
- [x] ~~APNs / iOS push~~ — SKIPPED (iOS not shipping). Android push uses FCM (google-services.json already configured).
- [ ] Sentry mobile: `cd mobile && npx expo install @sentry/react-native`, set `SENTRY_DSN`, upload source maps.
- [ ] Error monitoring verified end-to-end.

## P2
- [ ] TestFlight beta on ≥3 real iPhones.
- [ ] End-to-end refund test in Razorpay test mode, then small live payment.
- [ ] App Store listing: description, screenshots, support/privacy URLs, age rating, review notes (REVIEW_PHONE/CODE).
- [ ] Submit for review.

## Code-side already done
- Typechecks (server + mobile) clean.
- Android + iOS Metro bundles build.
- Push taps open content; crash boundary; shared web pages for ideas/profiles.