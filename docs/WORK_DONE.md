# Vouch — Work Done Ledger (Accountant Report)

Prepared by: Ledger (personal accountant agent)
Founder/CEO/Boss: You

## 2026-11-16 — beta-v2: X-parity profile photos

- Avatar/header rules now match X's published limits: avatar 400×400 px / max 2 MB, header 1500×500 px / max 5 MB, JPG/PNG/GIF/WebP with magic-byte validation so a renamed file cannot bypass the check.
- Photos are cropped to the right aspect and resized on the device with `expo-image-manipulator` before upload; the app rejects anything over the cap with a clear message.
- Upload routes (`/me/avatar`, `/me/banner`, `/ideas/:id/image`) accept a 7 MB JSON body; every other route stays at 50 KB. This fixes the previous ~38 KB effective cap caused by the global 50 KB parser.
- Profile photo buttons are hidden while image storage is unconfigured instead of failing with a 501.
- Version bumped to `beta-v2` / versionCode `16`.

## 2026-11-16 — beta-v1 relabel and rebuild

- Version relabelled from `0.0.10` to `beta-v1`; Android versionCode bumped `14` → `15` so the in-app update prompt fires.
- Changed in `mobile/app.json`, `mobile/package.json`, `mobile/android/app/build.gradle` and `server/src/lib/appVersion.ts`; Expo accepts the non-semver label.
- GitHub release tag renamed `v0.0.10` → `beta-v1`; download URL is now `releases/download/beta-v1/vouch-beta.apk`.
- Clean rebuild: 90,246,491 bytes, signature unchanged (`5e8f1606…`), mobile Sentry DSN and API URL verified inside the bundle, published asset hash matches the local build (`99DBAECE…`).

## 2026-11-16 — v0.0.10 audit and Android release

### Audit fixes shipped
- Home post rows: added the missing `flexDirection: 'row'` so avatar and body sit side by side.
- Removed dead Repost buttons and wired Reply to the Comments screen on Home and Profile.
- Own profile: safe-area handling, removed the dead back arrow, likes/comments now functional.
- Other profiles (`UserProfile`): rewritten as a scrollable X-style profile — back header, Share, Follow/Following, Block, Edit profile for yourself, banner, overlapping avatar, stats, tabs, single-column posts with working reply/like/share.
- Profiles open from a handle as well as an id: `GET /users/by-handle/:handle` plus `vouch://u/:handle` linking.
- Comment avatars: the API now returns `author.avatarUrl` on list and create, and the app renders it.
- Shared web URL: new `mobile/src/config.ts` with the real API host; all screens import it (no `vouch.example.com` fallbacks left in app code).
- Settings: Notifications opens system settings; Security link added; no "coming soon" alerts.
- Onboarding: demo charts show real-looking progress instead of 0% / dash.
- Image pickers updated to the current `mediaTypes: ['images']` API.
- Legal pages: real contact `thedesaimitul@gmail.com`, Google-only sign-in text, beta/no-payments wording. No `[[PLACEHOLDER]]` or fake emails remain.
- Sentry SDK installed in the app (`@sentry/react-native` config plugin), with the mobile DSN baked into v0.0.10 and verified by a test event.

### Release and CI
- Version bumped to `0.0.10` / versionCode `14` in `app.json`, `package.json`, `android/app/build.gradle` and `server/src/lib/appVersion.ts`.
- CI beta-mode failure fixed: `PAYMENTS_ENABLED` is set per test suite; the job-wide `true` no longer leaks into the beta suite.
- Removed the stuck self-hosted `android-build.yml` workflow (no runner exists; it queued forever).
- Mobile CI now exports Android only.
- Android release APK built locally and attached to GitHub Release `v0.0.10`.
- README and launch checklist rewritten to match the Android-only beta.
- Production API restored on 2026-11-16: stale Supabase password reset, Render `DATABASE_URL` rewritten without a stray leading tab, `SENTRY_DSN` added, redeployed `main`. `/health` returns 200 and `/api/v1/app-version` serves 0.0.10.

### Quality gates
- Server typecheck: clean.
- Mobile typecheck: clean.
- Server tests: 21 payments-mode + 4 beta-mode, run in CI against Postgres 16.

### Open items (external)
- Image storage (S3/R2) not configured, so uploads stay disabled.
- Beta APKs use the debug keystore; a public launch needs a private keystore and a fresh install.

## Earlier scope delivered
- X-like profile UI: banner, overlapping avatar, name/handle/bio, location/website/joined, following/followers, Edit profile + Share, tabs.
- Working Share and Edit profile actions; new UserProfile, Followers, Following and Settings screens.
- Profile fields: location, website, bannerUrl, avatar upload. Migration `009_profile_roles.sql`.
- Roles are stored by the server (member / founder / backer / admin) but self-service role switching was removed from the UI.
- Server: `GET /users/:id`, `/users/:id/ideas`, `/users/:id/followers`, `/users/:id/following`, `PATCH /me`, avatar and banner upload.
- Agentic team roster: `docs/AGENTS.md`.
