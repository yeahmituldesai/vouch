# Vouch — Android Beta Release Checklist

Run this top to bottom for every beta APK. Every box needs an observed result, not an assumption. Attach a screenshot or command output for each P0 row.

| | |
|---|---|
| Applies to | Vouch Android beta, sideloaded APK, `com.vouchapp.vouch` |
| Current release under test | `beta-v3` / `versionCode 18` |
| Owners | Forge (build), Shield (QA), Relay (ops) |
| Last code audit | 2026-11-17 |
| Release rule | No beta ships with an open **P0**. A **P1** may ship only with a written waiver from the founder. |

**Severity:** **P0** = blocks release (cannot log in, cannot install, stuck update modal, data loss). **P1** = must pass or be explicitly waived. **P2** = check and record; fix later.

---

## 0. Release identity — fill this in before testing

| Field | `mobile/app.json` | `mobile/package.json` | `mobile/android/app/build.gradle` | `server/src/lib/appVersion.ts` |
|---|---|---|---|---|
| Version name | `expo.version` = `beta-v3` | `version` = `beta-v3` | `versionName "beta-v3"` | `versionName: 'beta-v3'` |
| Version code | `expo.android.versionCode` = **18** | — | `versionCode` = **17** ⚠️ | `versionCode: 18` |
| Download URL | — | — | — | `.../releases/download/beta-v3/vouch-beta.apk` |

Live endpoint on 2026-11-17 returned `{"versionCode":18,"versionName":"beta-v3","downloadUrl":".../beta-v3/vouch-beta.apk","forceUpdate":true}`.
GitHub Release `beta-v3` asset `vouch-beta.apk`: **90,321,343 bytes**, sha256 `2c0fcc47d98e18001bfda79f16c572b1fa18fc8a43d6fdf154148a2c3177140b`.

### 0.1 Open gaps found while writing this checklist

| # | Severity | Finding | Impact |
|---|---|---|---|
| 1 | **P0 (fixed in tree)** | `mobile/android/app/build.gradle` said `versionCode 17` while `mobile/app.json` and `server/src/lib/appVersion.ts` said **18**. Now aligned to 18 in the working tree. | Code is fixed. Remaining: rebuild the APK, replace the `vouch-beta.apk` asset on the `beta-v3` release tag, and verify the new build reports 18 (section 1). Until the asset is replaced, the live loop persists. |
| 2 | **P0 (legal link)** | `mobile/src/screens/Settings.tsx` links `/support`, `/security`, `/terms`, `/privacy` — **not `/refunds`**. `server/public/refunds.html` exists and is tested over HTTP, but no UI links to it. | Refund policy is unreachable from the app. Add a Settings row (e.g. "Refund policy") or get a written waiver while payments are off. |
| 3 | P1 | `build.gradle` lines 118–121: the `release` build type uses `signingConfigs.debug` (the checked-in `mobile/android/app/debug.keystore`). | Beta APKs are debug-signed. Google Cloud must have the **debug keystore SHA-1**, not a private release key. Moving to a private keystore later forces an uninstall (new signature) and a fresh SHA-1 registration. |
| 4 | P1 | No in-app version/build label anywhere in `mobile/src`. `updateCheck.tsx` knows the version but never displays the installed code. | Testers cannot confirm which build they run. Use `adb shell dumpsys package com.vouchapp.vouch`, or add a version row in Settings. |
| 5 | P1 | `server/src/lib/images.ts` enforces bytes + MIME + magic bytes only; it does **not** validate pixel dimensions. `mobile/src/imagePick.ts` resizes to 400×400 / 1500×500 before upload. | The dimension rule is client-side only. A direct API call can upload a 5000×5000 image under the byte cap. Accept for beta or add `sharp` dimension checks. |
| 6 | P1 | With R2 unset, `uploadImage` returns a base64 `data:` URL stored in `users.avatar_url`; `fetchIdeas` returns it on every feed row. | Feed payloads can carry full avatar images. Test feed load time after uploading two 400×400 avatars. |
| 7 | P2 | `mobile/src/updateCheck.tsx` never reads `forceUpdate`. The modal is compulsory for **any** versionCode greater than installed, and hardware back is trapped (`BackHandler`). | You cannot ship an optional update through this path. Do not publish a server version ahead of the APK. |
| 8 | P2 | `server/src/routes/social.ts` followers/following queries (`/users/:id/followers`, `/users/:id/following`) do not filter `is_banned` / `deleted_at`; `fetchIdeas` joins owners without a ban filter; `/users/search` does not exclude blocked users and `POST /users/:id/follow` does not check `blocks`. | A banned/deleted user can still appear in follower lists and old ideas can still appear in feeds. A blocked user can still be found and followed from search. Decide what is acceptable for beta and record it. |

---

## 1. Version consistency gate (P0)

The only forced-update kill switch is `server/src/lib/appVersion.ts`. Get this wrong and every tester is locked out of the app.

### 1.1 Decide the number

- [ ] Pick the new `versionCode` **N** (monotonically increasing, never reused) and label `beta-vN`.
- [ ] Pick a **new** GitHub release tag (e.g. `beta-v4`). Do not overwrite the asset on an existing tag — GitHub/CDN can serve the old file.

### 1.2 Update all four places to the same values

- [ ] `mobile/app.json` → `expo.version` and `expo.android.versionCode`.
- [ ] `mobile/package.json` → `version` (label only).
- [ ] `mobile/android/app/build.gradle` → `versionCode` and `versionName` in `defaultConfig`. **This is the one that actually lands in the APK.**
- [ ] `server/src/lib/appVersion.ts` → `versionCode`, `versionName`, `downloadUrl`, `changelog`.

> After `npx expo prebuild`, Expo can regenerate `build.gradle` from `app.json`. Re-check the file after prebuild, not before.

### 1.3 Build, then prove the APK's manifest

- [ ] Build the release APK (`cd mobile/android && ./gradlew assembleRelease`).
- [ ] Inspect the APK, not the source:

```powershell
aapt dump badging mobile\android\app\build\outputs\apk\release\app-release.apk |
  Select-String "package:"
# required: package: name='com.vouchapp.vouch' versionCode='N' versionName='beta-vN'
```

- [ ] Record size and hash:

```powershell
(Get-Item mobile\android\app\build\outputs\apk\release\app-release.apk).Length
Get-FileHash mobile\android\app\build\outputs\apk\release\app-release.apk -Algorithm SHA256
```

- [ ] Confirm the signing certificate matches the previous beta (section 2.2).

### 1.4 Publish, then point the server at it — in this order

- [ ] Upload `vouch-beta.apk` to the new tag. Verify the asset is public and downloadable in an incognito browser.
- [ ] `curl.exe -sIL <new downloadUrl>` → 200 and `content-length` equals the local byte count.
- [ ] **Only now** update `server/src/lib/appVersion.ts` (`downloadUrl`, `versionCode`, `versionName`, `changelog`) and deploy.
- [ ] Verify the live endpoint:

```powershell
Invoke-RestMethod https://vouch-api-9fpi.onrender.com/api/v1/app-version
# versionCode must equal N, downloadUrl must point at the tag you just uploaded
```

- [ ] Compare the served APK's manifest `versionCode` to the server value. They must be identical. If the served APK is lower, the modal can never clear.

### 1.5 Prove the loop is broken

- [ ] Install the **previous** beta on a clean device.
- [ ] Launch: the modal should appear exactly once and name the new version.
- [ ] Update and relaunch: modal does **not** reappear.
- [ ] Background/foreground the app 3×: modal still does not reappear.
- [ ] Kill and relaunch: modal still does not reappear.
- [ ] `adb shell dumpsys package com.vouchapp.vouch | Select-String versionCode` shows N.

> Ordering rule that caused the previous incident: if the server advertises N before an APK with N exists at `downloadUrl`, every client is forced to download the old APK and loops forever on next launch. APK first, server second, always.

---

## 2. Sideload install (P0)

### 2.1 Fresh install

- [ ] Download the APK on the phone (Chrome), not via USB, to test the real path.
- [ ] Android 8+: Settings → Apps → Vouch → **Install unknown apps** → Allow. On Android 7 and older: Settings → Security → Unknown sources.
- [ ] The package installer opens without "There was a problem parsing the package".
- [ ] Play Protect may warn that the app is unknown. Tap **Install anyway**; record the exact wording shown.
- [ ] App icon is the Vouch adaptive icon, name is "Vouch", splash is black.
- [ ] App opens to the Google sign-in screen (section 5).

### 2.2 Signature match (the upgrade requirement)

The release build is signed with `signingConfigs.debug`, so every beta so far uses `mobile/android/app/debug.keystore`.

- [ ] `apksigner verify --print-certs <apk>` and record the certificate SHA-256 for the release notes.
- [ ] The certificate digest must match the previous beta exactly, or the install will fail with `INSTALL_FAILED_UPDATE_INCOMPATIBLE`.
- [ ] Register/verify the **debug keystore SHA-1** in Google Cloud (section 5.1). Using a private release keystore here without registering its SHA-1 breaks Google sign-in.

```powershell
keytool -list -v -keystore mobile\android\app\debug.keystore `
  -alias androiddebugkey -storepass android -keypass android |
  Select-String "SHA1:|SHA256:"
```

### 2.3 Upgrade over the installed beta

- [ ] With the previous beta installed and logged in, install the new APK **over** it (tap the download, or `adb install -r <apk>`).
- [ ] Install completes without uninstalling; the Vouch session is still valid (SecureStore token survives).
- [ ] Profile, feed and notifications still load after the upgrade.
- [ ] A downgrade attempt (lower versionCode) is refused with `INSTALL_FAILED_VERSION_DOWNGRADE`. Do not force it — uninstalling wipes the token.

### 2.4 Device coverage

Test at minimum:

- [ ] One Android **13+** device (notification permission + package installer behaviour).
- [ ] One Android **11/12** device.
- [ ] One OEM with aggressive battery management (Xiaomi/Redmi, Oppo/Realme, Vivo, Samsung).
- [ ] Free storage ≥ 300 MB before updating (asset is ~90 MB; installer needs headroom).
- [ ] Portrait only; no layout break on a small screen (≤ 5.5") and a large screen (≥ 6.7").

---

## 3. In-app update (P0)

Code path: `mobile/src/updateCheck.tsx`.

- [ ] Modal appears only when `remote.versionCode > installed versionCode`. Equal or lower → no modal, no flash.
- [ ] Note: `forceUpdate` is ignored. Any newer version is treated as compulsory, and the Android back button is blocked. Decide per release whether that is intended.
- [ ] The installed value comes from `Constants.nativeBuildVersion`; if that is empty it falls back to `expoConfig.android.versionCode`. Confirm both are N.

### 3.1 Download

- [ ] Tap **Update Now**. Modal switches to DOWNLOADING; percentage and `x.x / y.y MB` update.
- [ ] Progress reaches 100% and the state becomes **UPDATE READY** ("Package verified & ready").
- [ ] Download file is `vouch-update-<versionCode>.apk` in the app cache. Confirm the version in the filename matches the target.
- [ ] Test the error path: airplane mode mid-download → "Download Interrupted". **Retry Download** works after reconnecting. **Open in browser** opens the GitHub URL.
- [ ] Test on mobile data (not just Wi-Fi). The APK is ~90 MB.
- [ ] Background the app during download, return, and record whether the transfer continues or restarts (no pause/resume is wired to `createDownloadResumable`).
- [ ] There is no Cancel button. Confirm that is acceptable; **Close App** only exists after the download finishes.

### 3.2 Install intent and restart

- [ ] **Restart & Install** opens the Android package installer (not a browser, not a blank screen).
- [ ] The installer shows the new version and asks to update the existing app.
- [ ] `REQUEST_INSTALL_PACKAGES` was granted (section 2.1). If it was not, the intent fails or silently bounces.
- [ ] Install completes; Vouch restarts (Android kills the process). Reopen the app.
- [ ] Play Protect warning path: tapping "Install anyway" still completes; record the flow.
- [ ] After relaunch: no update modal, logged-in state intact, feed loads.

### 3.3 Push-triggered update prompt

- [ ] `POST /api/v1/admin/notify-update` (section 10.6) sends `{ type: "app_update", versionCode, url }`.
- [ ] With the app in the background, tapping the notification opens Vouch **and** the update modal appears (the response listener calls `checkForUpdate`).
- [ ] With the app in the foreground, the banner appears and tapping it does the same.
- [ ] With the app killed, tapping the notification cold-starts Vouch and the modal appears.

### 3.4 Regression checks

- [ ] AppState resume (background → foreground) runs the version check; an offline app does not show an error dialog (failure is silent by design).
- [ ] If `/api/v1/app-version` is unreachable, no modal and the app remains usable.
- [ ] If the server version is **lower** than installed (dogfood build), no modal.
- [ ] Screenshot the modal for each state: idle, downloading, ready, error.

---

## 4. Push notifications, Android 13+ (P0)

Code path: `mobile/src/push.tsx`, registered from `mobile/src/auth.tsx` once a user is present.

### 4.1 Permission and token

- [ ] On a **physical device** (emulators return early via `Device.isDevice`), sign in for the first time.
- [ ] Android 13+ shows the system notification permission prompt. Denying it must not crash or block login.
- [ ] Confirm the merged manifest actually contains the permission (expo-notifications adds it even though it is not explicit in `AndroidManifest.xml`):

```powershell
aapt dump permissions mobile\android\app\build\outputs\apk\release\app-release.apk |
  Select-String "POST_NOTIFICATIONS"
```

- [ ] Notification channel `default` exists (Settings → Apps → Vouch → Notifications), importance High, light colour `#7C5CFF`.
- [ ] Token is saved server-side. Verify in the admin push response as `hadToken: true`, or:

```sql
SELECT id, push_token IS NOT NULL AS has_token FROM users WHERE email = '<tester>';
```

- [ ] Server push is configured. `POST /api/v1/admin/push` returns `pushConfigured: true`. If false, set `FCM_SERVICE_ACCOUNT_BASE64` on Render (or in the `app_config` table) — the service account must match `google-services.json` project `vouch-startup`.

### 4.2 Delivery matrix

Send a test push with the admin endpoint (section 10.6) for each row.

- [ ] **Foreground:** banner/alert appears while the app is open; no crash; notification also lands in the tray.
- [ ] **Background:** notification appears in the tray; app not open.
- [ ] **Killed:** swipe Vouch out of recents, send a push, notification appears within ~30 s.
- [ ] **Lock screen:** notification appears; tapping unlocks and opens Vouch.
- [ ] **Tap-to-open:** tapping a notification about an idea opens the app and routes to the right content (not a blank Home).
- [ ] **Tap-to-open (update):** `type: app_update` opens the update modal (section 3.3).
- [ ] **Permission denied:** re-enable via Settings → Notifications → Vouch (the Settings row opens system settings) and confirm a new token/registration works.
- [ ] **Two OEMs:** repeat foreground/background/killed on at least two manufacturers; battery saver may kill delivery on one.

### 4.3 Failure signatures to record

- `pushConfigured: false` → `FCM_SERVICE_ACCOUNT_BASE64` missing or unparsable.
- `delivery.status: 401/403` → service account key rejected.
- `delivery.status: 404` or `UNREGISTERED` → token stale; server clears it automatically.
- `hadToken: false` → registration never ran or `/me/push-token` failed. Registration errors are swallowed by design, so always check the admin response, not the UI.
- `pushConfigured` is only queried from the admin API; there is no health/status surface for push.

---

## 5. Login (P0)

### 5.1 Google sign-in on the release-signed build

- [ ] The APK is built with `EXPO_PUBLIC_GOOGLE_CLIENT_ID` set (`mobile/.env` currently has the web client `700553469092-3l4c...`).
- [ ] If that env var is missing at bundle time, the button is hidden and the screen says "Sign-in is not configured. Contact support." — this is an automatic fail.
- [ ] In Google Cloud, the **Android OAuth client** has:
  - package name `com.vouchapp.vouch`;
  - the SHA-1 of the keystore that signed the APK. Today that is `mobile/android/app/debug.keystore` (section 2.2), not a private release key.
- [ ] The Android client ID in the build (`EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`, fallback `700553469092-aaa23m9jhjtf2a95m25qp7aiu6vi79b3`) is the same client whose SHA-1 is registered.
- [ ] Server allows the audience: `GOOGLE_CLIENT_ID`, `GOOGLE_ANDROID_CLIENT_ID`, or the hardcoded fallback (see `server/src/routes/auth.ts` lines 97–102).
- [ ] Tap **Continue with Google** → account chooser → consent → returns to Vouch → lands in the app.
- [ ] Cancel the chooser: app returns to sign-in with no crash and no stuck spinner.
- [ ] Airplane mode: a readable error, not a crash.
- [ ] Sign out and sign back in: same account, no duplicate user.

Record error codes exactly if it fails:

| Symptom | Likely cause |
|---|---|
| Error 10 / DEVELOPER_ERROR | Package name + SHA-1 not registered for the Android OAuth client |
| Error 12500 | OAuth client misconfigured |
| Error 12501 | User cancelled the chooser (expected, not a bug) |
| HTTP 501 `GOOGLE_DISABLED` | Server `GOOGLE_CLIENT_ID` is empty |
| HTTP 401 `BAD_GOOGLE_AUDIENCE` | App's client ID is not in the server allowlist |
| HTTP 401 `EXPIRED_GOOGLE_TOKEN` | Device clock skew or slow consent flow |
| "Sign-in is not configured" in app | `EXPO_PUBLIC_GOOGLE_CLIENT_ID` missing from the build |

### 5.2 Phone OTP when SMS is unavailable

Phone sign-in is **disabled in production**: `phoneLoginEnabled = config.NODE_ENV !== 'production'`, so `/auth/otp/request` and `/auth/otp/verify` return **404 NOT_FOUND**. `mobile/src/screens/Phone.tsx` has no OTP form at all — only the Google button.

- [ ] On the production API, confirm `POST /api/v1/auth/otp/request` returns 404 and the app offers no phone entry point.
- [ ] Confirm every tester has a Google account; there is no SMS fallback and no support-side login bypass in production.
- [ ] For local/dev only: `SMS_PROVIDER=console` returns `devCode` in the response when `NODE_ENV !== production`; the 30-second resend cooldown and 5-attempt lockout still apply.
- [ ] `REVIEW_PHONE` / `REVIEW_CODE` do **not** work in production (`isReview` requires non-production). Do not rely on them for beta access.
- [ ] If a tester reports "SMS never arrived", the expected answer is: phone login is not part of the beta; use Google.

---

## 6. New features (P1)

### 6.1 Handle search

Endpoint: `GET /api/v1/users/search?q=` (`server/src/routes/social.ts` lines 37–54), auth required.

- [ ] Typing any text shows a **People** section above ideas; clearing the query hides it.
- [ ] `@alice` returns `@alice` **first**, even if another user's name contains "alice".
- [ ] `alice` ranks the exact handle above `alicefan` / `alice_smith`; then by follower count.
- [ ] Case-insensitive: `@ALICE`, `Alice`, `alice` return the same ordering.
- [ ] Name search ("Alice") returns people too, not only handles.
- [ ] `%`, `_` and `\` in the query do not act as SQL wildcards and do not 500.
- [ ] A single `@` returns "No people found.", not an error.
- [ ] 31+ characters returns a validation error (server max 30); the client does not crash.
- [ ] Your own row has no Follow button.
- [ ] **Follow** from search toggles to **Following**, increments the follower count, and the state survives leaving and returning to Explore.
- [ ] Follow from search creates a `follow` notification for the target.
- [ ] Tapping a result opens `UserProfile` with the same avatar and handle.
- [ ] Unauthenticated/token-expired requests do not render stale people rows.

### 6.2 Avatars

- [ ] Home: idea owner avatar + your own header avatar.
- [ ] Explore: avatar per person row.
- [ ] Profile (own) and UserProfile (other): header avatar.
- [ ] Followers and Following lists: avatar per row.
- [ ] EditProfile: current avatar preview, updates immediately after upload.
- [ ] Bonus surfaces to spot-check: Idea detail, Comments.
- [ ] Missing avatar renders initials, not a broken image or blank circle.
- [ ] A broken/expired avatar URL renders initials without crashing.
- [ ] Avatars render after a cold start (not only from cache).

### 6.3 X handle rules

Rules are enforced in three layers: UI input filter, `PATCH /me` zod regex, and migration `010_handle_rules.sql` (`CHECK (handle ~ '^[a-z0-9_]{4,15}$')` + unique index on `lower(handle)`).

| Case | Expected |
|---|---|
| `abcd` (4) | Accepted |
| `abc` (3) | Save disabled in UI; API returns 400 handle error |
| 15 chars | Accepted |
| 16 chars | Input capped at 15; API rejects |
| `Alice` | Lowercased to `alice` on save |
| `@alice` | `@` stripped by the input filter |
| `my handle` | Space stripped |
| `héllo` | Non-ASCII stripped |
| `a-b` | Hyphen stripped |
| `a_b_c` | Accepted (underscore allowed) |
| `_abcd` / `abcd_` | Accepted by the current regex (leading/trailing underscore allowed) — record as accepted behaviour |
| Duplicate `Alice` when `alice` exists | 409 `HANDLE_TAKEN`; UI shows "That handle is already taken" |
| Handle from Google signup (`user` + 6 hex) | Valid, 10 chars |

- [ ] Case-insensitive uniqueness holds in the database, not just the UI: create `alice`, then try `ALICE` from a second account.
- [ ] Existing users whose handles broke the rules were repaired by migration 010; spot-check 2–3 older accounts.
- [ ] `GET /users/by-handle/:handle` resolves case-insensitively and 404s for banned/deleted users.

---

## 7. Profile images (P1)

Client: `mobile/src/imagePick.ts`. Server: `server/src/lib/images.ts`.

| Image | Pixels | Max bytes | Client behaviour | Server behaviour |
|---|---|---|---|---|
| Avatar | 400×400 | 2 MB (2,097,152) | Crop 1:1, resize, JPEG q0.85 | 2 MB cap, MIME + magic bytes |
| Banner | 1500×500 | 5 MB (5,242,880) | Crop 3:1, resize, JPEG q0.85 | 5 MB cap, MIME + magic bytes |
| Idea photo | 1600×1600 | 5 MB | Crop 1:1, resize | 5 MB cap, MIME + magic bytes |

Accepted MIME types: JPEG, PNG, GIF, WebP. The JSON body limit for upload routes is 7 MB (`UPLOAD_BODY_LIMIT`); all other routes stay at 50 KB.

- [ ] Avatar: normal photo → uploads, appears on Profile/Home/search, survives restart.
- [ ] Avatar: file over 2 MB → client error "Profile photo must be under 2 MB"; nothing is uploaded.
- [ ] Banner: 5000×1000 photo under 5 MB → cropped to 3:1 and uploaded; header is not stretched.
- [ ] Banner: file over 5 MB → "Header photo must be under 5 MB".
- [ ] Wrong format: rename a PDF/EXE to `.jpg` and upload via the API → 415 "Use a JPEG, PNG, GIF or WebP image" or "File content does not match its image type".
- [ ] Empty/corrupt base64 → 400 `INVALID_IMAGE`, no server crash.
- [ ] Upload while R2 is unset → succeeds and stores an inline `data:` URL; confirm the avatar still renders after a cold start.
- [ ] Feed performance after two avatar uploads (inline data URLs can inflate `/ideas` responses).
- [ ] Photo library permission denied → readable error, no crash.
- [ ] Cancel the picker → no upload, no error toast.
- [ ] Note: the server does not verify pixel dimensions. Record whether that is accepted for the beta (gap 0.1 #5).

---

## 8. Moderation (P1)

### 8.1 Report flow

- [ ] Open someone else's idea → **⋯** → **Report idea**.
- [ ] Options are exactly: Spam or fake / Offensive or unsafe / Misleading / Cancel.
- [ ] Submitting shows "Thanks — we will review this idea."
- [ ] Submitting the same reason twice does not create a duplicate row (`ON CONFLICT DO NOTHING`).
- [ ] Reporting a removed idea returns 404; the app shows a readable error.
- [ ] Your own idea does not show the **⋯** menu.
- [ ] **Block founder** from the same menu returns to the previous screen, and the Home feed excludes that owner's ideas (the `/ideas` list applies a `blocks` filter). A direct idea link or the people search can still surface them — see gap 0.1 #8.

### 8.2 Admin review

Admin UI: `https://vouch-api-9fpi.onrender.com/admin` (token kept in the tab's session storage).
API header: `x-admin-token: <ADMIN_TOKEN>`. `ADMIN_TOKEN` must be ≥ 16 characters or admin routes return 403.

```powershell
$h = @{ 'x-admin-token' = $env:ADMIN_TOKEN }
Invoke-RestMethod -Uri "https://vouch-api-9fpi.onrender.com/api/v1/admin/reports" -Headers $h
```

- [ ] `/api/v1/admin/reports` returns `idea_id`, `name`, `status`, `reports`, `reasons`, ordered by report count, max 100.
- [ ] A missing/wrong token returns 403; the UI shows the error rather than an empty table.
- [ ] Token is not persisted to `localStorage` (session storage only).

### 8.3 Remove an idea

```powershell
Invoke-RestMethod -Method Post `
  -Uri "https://vouch-api-9fpi.onrender.com/api/v1/admin/ideas/<idea-id>/remove" `
  -Headers ($h + @{'content-type'='application/json'}) `
  -Body '{"reason":"policy: misleading claims"}'
```

- [ ] `reason` is required, 3–200 chars; a 2-char reason is rejected.
- [ ] Response includes `ok: true` and a `settlement` result.
- [ ] The idea disappears from Home, Explore, the owner's profile and its detail page.
- [ ] Removing it twice returns 404 `NOT_FOUND`.
- [ ] If payments are on, any paid orders are refunded by `runSettlement()`; in beta mode there is nothing to refund.

### 8.4 Ban / delete visibility

```powershell
Invoke-RestMethod -Method Post -Uri "https://vouch-api-9fpi.onrender.com/api/v1/admin/users/<user-id>/ban" -Headers $h
```

- [ ] Banned user is hidden from `/users/search` (`is_banned = false AND deleted_at IS NULL`).
- [ ] Banned user's profile and `/users/by-handle/:handle` return 404.
- [ ] Banned user cannot sign in again (403 `BANNED` on Google exchange).
- [ ] Deleted account (`DELETE /me`) is hidden from search; handle becomes `deleted_xxxxxxx`; profile 404s.
- [ ] Deleted account's **live** ideas are marked `removed` and disappear from feeds (already funded ideas are not rewritten).
- [ ] **Known gap:** check whether the banned/deleted user still appears in Followers/Following lists and whether their older ideas still appear in the feed. Record the observed behaviour and the decision (gap 0.1 #8).

---

## 9. Legal pages (P0 for links, P1 for content)

Pages are static HTML served by Express (`server/public/*.html`, `express.static` with extensionless URLs). Production host is `https://vouch-api-9fpi.onrender.com` (`mobile/src/config.ts`).

| URL | Expected H1 | Linked from Settings | Linked from Profile menu |
|---|---|---|---|
| `/terms` | Terms of Use (last updated 2026-11-15) | ✅ Terms of service | ✅ Terms |
| `/privacy` | Privacy Policy (last updated 2026-11-16) | ✅ Privacy policy | ✅ Privacy Policy |
| `/security` | Security (last updated 2026-11-16) | ✅ Security | ❌ |
| `/support` | Support (last updated 2026-11-16) | ✅ Help center | ✅ Contact support |
| `/refunds` | Refund Policy (last updated 2026-11-16) | ❌ **missing** | ❌ |

- [ ] Each URL returns HTTP 200 and renders styled content (not a 404 JSON body).
- [ ] `/terms` and `/privacy` are reachable from the sign-in screen before an account exists.
- [ ] **Add a Refund policy row to Settings** (gap 0.1 #2) or attach a written waiver. The page exists; only the link is missing.
- [ ] No `[[placeholders]]`, `TODO`, `lorem`, `example.com`, or fake emails. Current contact is `thedesaimitul@gmail.com` on every page.
- [ ] Content matches reality: Google-only sign-in, beta/payments-disabled wording, 13+ age limit, grievance officer (India), 30-day token expiry.
- [ ] Links open in the system browser (not an in-app webview that traps the user).
- [ ] Page titles and meta viewport are present on mobile.
- [ ] Re-check after any copy edit: the pages are plain HTML, so a typo ships without a build.

---

## 10. Ops (P0/P1)

### 10.1 Health

- [ ] `GET /health` returns `{"ok":true}` with HTTP 200. It runs `SELECT 1`; a DB outage returns 503 `{"ok":false}`.
- [ ] Check from a phone on mobile data, not only from the dev machine.
- [ ] Render health check path is `/health` (`render.yaml`), plan free, region Singapore.

### 10.2 App version endpoint

- [ ] `GET /api/v1/app-version` is public (no auth) and returns the four fields plus `forceUpdate`.
- [ ] Values match section 1 exactly.
- [ ] Response is not cached by a CDN/proxy in a way that serves the previous version after a deploy (test with a cache-busting query).

### 10.3 Migrations

Migrations run automatically on server start (`server/src/index.ts` → `migrate()`), each file in its own transaction under advisory lock `727274`.

- [ ] Deploy logs show `applied <file>` for any new migration, or no error.
- [ ] `schema_migrations` has all 10 files: `001_init` through `010_handle_rules`.
- [ ] `010_handle_rules.sql` is applied: `users_handle_lower_unique` index exists and the `users_handle_format` CHECK is present.
- [ ] No migration is edited after it ships. Add `011_*.sql` instead.
- [ ] A failed migration rolls back and stops the boot; the deploy must not report healthy in that state.

```sql
SELECT name FROM schema_migrations ORDER BY name;
```

### 10.4 Backup and restore drill

- [ ] Confirm the current backup window (Supabase daily backups / PITR) and who can restore.
- [ ] Restore the latest backup into a **scratch** project. Never restore over production to "test".
- [ ] Point a local server at the scratch `DATABASE_URL` with `DATABASE_SSL=true`.
- [ ] Verify `/health`, a Google login, the feed, an idea detail and an avatar load against the restored data.
- [ ] Record restore duration and data-loss window (RPO/RTO) in the release notes.
- [ ] Confirm the Render `DATABASE_URL` still points at production after the drill.

### 10.5 Keepalive

`.github/workflows/keepalive.yml` pings `https://vouch-api-9fpi.onrender.com/health` every 10 minutes (3 attempts, 20 s apart), keeping Render's free tier warm and Supabase active.

- [ ] Actions tab: the latest "Keep API awake" run is green and less than 15 minutes old.
- [ ] Manually run `workflow_dispatch` and confirm it exits 0.
- [ ] Note: GitHub disables scheduled workflows after ~60 days of repository inactivity; check the workflow is still enabled after quiet periods.
- [ ] Consider a second external pinger (cron-job.org) as a backup; a slept Render instance adds a cold-start delay to the first login.
- [ ] Confirm Supabase is not paused (project shows active) before releasing.

### 10.6 Admin push / notify-update

```powershell
# one user
Invoke-RestMethod -Method Post `
  -Uri "https://vouch-api-9fpi.onrender.com/api/v1/admin/push" `
  -Headers ($h + @{'content-type'='application/json'}) `
  -Body '{"email":"tester@example.com","title":"Vouch test","body":"Push check"}'

# every registered device
Invoke-RestMethod -Method Post `
  -Uri "https://vouch-api-9fpi.onrender.com/api/v1/admin/notify-update" `
  -Headers $h
```

- [ ] One-user push returns `pushConfigured`, `hadToken`, `delivery`.
- [ ] `notify-update` returns `targeted`, `delivered` and per-user deliveries; compare `delivered` to `targeted`.
- [ ] Do not run `notify-update` before the APK is live (it tells every device an update is ready).

### 10.7 Deploy hygiene

- [ ] Render deploy status is **live**, not "deploying" or "failed".
- [ ] Environment has `DATABASE_URL`, `DATABASE_SSL=true`, `JWT_SECRET`, `OTP_PEPPER`, `ADMIN_TOKEN`, `GOOGLE_CLIENT_ID`, `GOOGLE_ANDROID_CLIENT_ID`, `FCM_SERVICE_ACCOUNT_BASE64`, `SENTRY_DSN`.
- [ ] A Sentry test event from the app and one from the server are received.
- [ ] `CORS_ORIGINS` is appropriate (currently `*`, acceptable for the beta API).
- [ ] Global rate limit is 300 req/min/IP; OTP is 10 per 15 min; Google auth is 200 per 15 min with successful requests skipped.
- [ ] Server logs show no config-validation failure (`Invalid environment`) and no migration error.

---

## 11. Per-release sign-off

One row per device/test pass. Result: **PASS**, **FAIL**, or **BLOCKED**. Attach the evidence link in Notes.
Example build cell: `beta-v4 / 19 / beta-v4`.

| # | Build (versionName / code / tag) | Tester | Date | Device | Android version | Result | Notes / evidence |
|---|---|---|---|---|---|---|---|
| 1 |  |  |  |  |  |  |  |
| 2 |  |  |  |  |  |  |  |
| 3 |  |  |  |  |  |  |  |
| 4 |  |  |  |  |  |  |  |
| 5 |  |  |  |  |  |  |  |
| 6 |  |  |  |  |  |  |  |
| 7 |  |  |  |  |  |  |  |
| 8 |  |  |  |  |  |  |  |

**Release sign-off**

- Build verified by (Forge): ____________________  Date: __________
- QA verified by (Shield): ____________________  Date: __________
- Ops verified by (Relay): ____________________  Date: __________
- Approved by (Founder): ____________________  Date: __________
- Open P0s: __________  Open P1s + waivers: __________
- APK sha256: __________________________________________________
- Rollback owner for this release: ____________________

---

## 12. Rollback

There is no automatic rollback. Decide within 30 minutes of a P0 and write down which option was used.

**Triggers:** crash on launch for more testers than can be supported, nobody can sign in, the update modal loops or traps users, data loss/corruption, compromised admin token.

### 12.1 Fast unblock — server-side version valve

The only remote kill switch is `server/src/lib/appVersion.ts`.

1. Set `versionCode` to the value installed on affected devices (or lower than it), keep a working `downloadUrl`, deploy.
2. Force-quit and reopen the app (the check also runs on AppState resume). The modal should be gone.
3. Confirm `GET /api/v1/app-version` reflects the change.
4. This unblocks users but does not fix the APK. Publish the fix as the **next** versionCode (e.g. 19) and run section 1 again.

**Never** point `downloadUrl` at an older APK with a lower versionCode: the installer rejects downgrades and the modal returns.

### 12.2 Server-only regression

- Render dashboard → previous successful deploy → **Rollback**. Env-var changes are not versioned; re-check them manually.
- Or `git revert <commit>` and redeploy. Do not revert migration files.
- Verify `/health` and `/api/v1/app-version` after the rollback.

### 12.3 Database incident

- Migrations are forward-only and auto-apply at boot. Do not try to "undo" a migration in place.
- Restore the last good backup into a new Supabase project, then repoint Render's `DATABASE_URL` and redeploy.
- Announce the data-loss window (RPO) to testers.

### 12.4 App regression that cannot be fixed server-side

- Publish a hotfix with `versionCode + 1` and a new tag. Do not reuse the broken tag or overwrite its asset.
- If the broken build cannot install/launch at all, users must uninstall and sideload the previous APK — warn them that uninstalling clears the login token.
- Keep the previous APK and its sha256 in the release notes for exactly this case.

### 12.5 Communication

- Notify testers with `POST /api/v1/admin/push` (or a plain message if push is the broken system).
- State: what broke, what to do now (update / reinstall / wait), and whether data was affected.
- Post-incident: add the failure to this checklist as a numbered regression gate.

---

## Appendix — command cheat sheet

```powershell
$API = "https://vouch-api-9fpi.onrender.com"
$APK = "mobile\android\app\build\outputs\apk\release\app-release.apk"

# Live release metadata
Invoke-RestMethod "$API/api/v1/app-version"
Invoke-RestMethod "$API/health"

# APK identity + signature (build-tools in PATH or use the full aapt.exe path)
aapt dump badging $APK | Select-String "package:|uses-permission"
apksigner verify --print-certs $APK
(Get-Item $APK).Length
Get-FileHash $APK -Algorithm SHA256

# Installed build on a connected device
adb shell dumpsys package com.vouchapp.vouch | Select-String "versionCode|versionName|signatures"

# Upgrade in place
adb install -r $APK

# Debug keystore SHA-1 used by the current release signing config
keytool -list -v -keystore mobile\android\app\debug.keystore `
  -alias androiddebugkey -storepass android -keypass android |
  Select-String "SHA1:|SHA256:"

# Admin
$h = @{ 'x-admin-token' = $env:ADMIN_TOKEN }
Invoke-RestMethod "$API/api/v1/admin/reports" -Headers $h
```
