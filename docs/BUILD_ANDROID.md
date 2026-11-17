# Building the Vouch Android app

The React Native Android project lives under `mobile/android` and is **source-controlled**.
Do not run `expo prebuild` or `expo prebuild --clean` on this repo — it would overwrite
the hand-edited `build.gradle` (release signing, ABI splits, CMake staging) and the change
is hard to recover. If you ever need to regenerate the native project, stash or commit
`mobile/android` first.

## CI (recommended)

The workflow `.github/workflows/android-release.yml` builds the APK on GitHub Actions:
- Triggers: a pushed tag matching `v*`, or `workflow_dispatch` (manual, with an optional version name).
- JDK 17, Node 20, Gradle cache, `npm ci`, then `assembleRelease`.
- On a tag build, the APK is attached to the GitHub release as `vouch-beta.apk`.
- The workflow verifies the APK with `aapt`/`apksigner` and prints package, versionCode, versionName, signer DN, SHA-256 and size to the job summary.

### GitHub secrets and variables to create

Repository Settings → Secrets and variables → Actions.

Secrets (sensitive):
- `ANDROID_KEYSTORE_BASE64` — base64 of the upload keystore, with no line breaks (`base64 -w 0 vouch-upload.keystore`).
- `ANDROID_KEYSTORE_PASSWORD` — keystore password.
- `ANDROID_KEY_ALIAS` — key alias (e.g. `vouch-upload`).
- `ANDROID_KEY_PASSWORD` — key password.

Variables (public, optional — defaults are baked into the workflow):
- `EXPO_PUBLIC_API_URL` (default: `https://vouch-api-9fpi.onrender.com`)
- `EXPO_PUBLIC_WEB_URL`
- `EXPO_PUBLIC_GOOGLE_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
- `EXPO_PUBLIC_SENTRY_DSN`

If the keystore secret is absent, the workflow generates a throwaway debug keystore and
produces a debug-signed APK with a loud warning. That artifact builds, but it **cannot
update** an existing install and must never be distributed.

## Manual Windows build

The project was generated on Windows with a path-length problem: React Native's CMake
codegen produces object paths longer than 260 characters, which Ninja rejects. Two ways
around it:

1. Enable long paths (admin PowerShell, persists across reboots):
   ```
   reg add "HKLM\SYSTEM\CurrentControlSet\Control\FileSystem" /v LongPathsEnabled /t REG_DWORD /d 1 /f
   ```
2. Or map a short drive letter (temporary, redo after reboot):
   ```
   subst V: "D:\Apps\vouch-project\mobile"
   ```

Then build:
```
cd D:\Apps\vouch-project\mobile\android
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"
$env:VOUCH_SHORT_BUILD_ROOT = "C:\vbuild"   # only if you used subst or long paths are off
.\gradlew.bat assembleRelease --no-daemon
```

The APK is written to `mobile\android\app\build\outputs\apk\release\`:
- `app-universal-release.apk` — one file for every phone (rename to `vouch-beta.apk` and attach to the GitHub release).
- `app-arm64-v8a-release.apk` — much smaller, modern phones only.
- `app-armeabi-v7a-release.apk` — 32-bit phones.

## Release signing

Signing material lives outside the repo. Never commit a `.keystore` or `.jks` — the
ignore rules in `mobile/.gitignore` enforce this.

1. Generate the upload keystore once, outside the repo:
   ```
   keytool -genkeypair -v -storetype PKCS12 ^
     -keystore C:\Users\<you>\keys\vouch-upload.keystore ^
     -alias vouch-upload -keyalg RSA -keysize 2048 -validity 10000 ^
     -dname "CN=Vouch, OU=Mobile, O=Vouch, L=Surat, ST=Gujarat, C=IN"
   ```
2. Add the four keys to `C:\Users\<you>\.gradle\gradle.properties` (preferred, never committed) or as environment variables:
   ```
   VOUCH_UPLOAD_STORE_FILE=C:/Users/<you>/keys/vouch-upload.keystore
   VOUCH_UPLOAD_STORE_PASSWORD=<store password>
   VOUCH_UPLOAD_KEY_ALIAS=vouch-upload
   VOUCH_UPLOAD_KEY_PASSWORD=<key password>
   ```
3. If the keystore is not configured, `assembleRelease` falls back to `signingConfigs.debug` and prints a warning.

### Important: switching keys breaks in-place updates
The beta APKs shipped so far are signed with the **public Android debug key**. An APK
signed with the upload key will fail to install over them with
`INSTALL_FAILED_UPDATE_INCOMPATIBLE`. Either keep debug signing for the transition
release, or tell testers to uninstall once. Register the upload keystore's SHA-1 in
Google Cloud Console too, or Google sign-in will fail in the new build.

## Version discipline

`mobile/app.json` (`android.versionCode`), `mobile/android/app/build.gradle`
(`versionCode`) and `server/src/lib/appVersion.ts` (`versionCode`) must agree, and the
GitHub release asset must carry that same versionCode. A mismatch is what caused the
live forced-update loop: the server advertised 18 while the shipped APK was 17.
The mobile update checker only shows the compulsory modal when `remote.versionCode >
installed.versionCode`, so a correct build cannot loop even if the server is stale.

## Image storage (server)

If Render has no `R2_*` / S3 variables, `server/src/index.ts` logs a startup warning
and avatars are stored as base64 data URLs in Postgres. That works for a beta but grows
the DB and every list response. Set the storage env vars to switch to object storage.
