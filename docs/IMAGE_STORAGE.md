# Image storage (avatars, banners, idea photos)

## Three backends

`server/src/lib/images.ts` supports three storage backends, chosen automatically from env vars
(R2 wins over Supabase if both are configured):

1. **Cloudflare R2 / S3-compatible** — images are uploaded as objects and served from a public URL. Free tier: 10 GB storage, 10M reads/month. **Requires a payment method on file** even for the free tier.
2. **Supabase Storage** (recommended for this project) — S3-compatible, included in the Supabase free tier with **no credit card required**. Uses the project's service-role key. This is what production uses.
3. **Postgres base64 data URLs** (automatic fallback) — the compressed image is stored inline in `users.avatar_url`, `users.banner_url` and `ideas.image_url`. Works with zero configuration, which is why the beta ships this way, but it bloats the database and every list response that embeds an avatar.

`r2Enabled()` returns true only when **all five** variables below are set. A partial set is rejected at startup (config validation) so a half-configured bucket can never silently fall back to the database.

## Enabling Supabase Storage (no card required)

1. In the Supabase dashboard: **Storage → New bucket**, name it `vouch-images`, and toggle **Public bucket** on.
2. Set these on Render (and in your local `.env`):

| Variable | Value |
|---|---|
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | The `service_role` JWT (Dashboard → Project Settings → API → service_role). Server-side only — never ship in the app. |
| `SUPABASE_STORAGE_BUCKET` | `vouch-images` |

The code uses Supabase's Storage REST API, so no S3 access keys are needed. Redeploy and the startup warning disappears; new uploads go to Supabase and the public URL is returned.

## Enabling R2

Set these on Render (Dashboard → service → Environment) and in your local `.env`:

| Variable | Example | Notes |
|---|---|---|
| `R2_ACCOUNT_ID` | `a1b2c3d4e5f6...` | Cloudflare account ID (R2 → Overview) |
| `R2_ACCESS_KEY` | `...` | R2 API token access key (R2 → Manage R2 API Tokens) |
| `R2_SECRET_KEY` | `...` | R2 API token secret |
| `R2_BUCKET` | `vouch-images` | Create the bucket first; enable public access |
| `R2_PUBLIC_URL` | `https://pub-xxxx.r2.dev` | The bucket's public (r2.dev) URL, or your custom domain |

Recommended token permissions: Object Read & Write on the single bucket only. Do **not** reuse an all-account token.

After setting them, redeploy. `GET /health` stays 200; the startup warning `[images] Object storage is not configured...` disappears from the logs. New uploads go to R2; existing base64 rows are untouched.

## Migrating existing images

Rows already stored as `data:` URLs keep working (the app renders them fine), but they keep bloating the DB. To move them:

```
cd server
npm run migrate:images            # real run
npm run migrate:images -- --dry-run   # preview counts, no writes
```

The script is idempotent: it only touches rows whose column starts with `data:`, so re-running is safe. It logs per-row successes/failures and exits non-zero if any failed. Verify a few migrated URLs in the app before dropping anything.

## Limits enforced server-side

- Avatar: 400×400, max 2 MB
- Banner: 1500×500, max 5 MB
- Idea photo: 1600×1600, max 5 MB
- Formats: JPEG, PNG, GIF (static), WebP. Content is sniffed, not trusted from the MIME header.

## Notes

- The client compresses and crops before upload, so even the database fallback stays small.
- `R2_PUBLIC_URL` must be publicly readable; R2 buckets are private by default — enable public access or attach a custom domain.
- Switching backends does not require a code change or redeploy beyond the env vars; `storageBackend()` reflects the active backend.
