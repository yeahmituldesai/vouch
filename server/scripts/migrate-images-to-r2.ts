// One-time migration: move images stored as base64 data URLs in Postgres into
// Cloudflare R2 (or any S3-compatible store). Idempotent — rows whose URL is
// already a normal http(s) URL are skipped, so it is safe to re-run.
//
// Usage:
//   npm run migrate:images        (uses .env)
//   tsx --env-file=.env scripts/migrate-images-to-r2.ts
//
// Requires R2_* to be fully configured (see docs/IMAGE_STORAGE.md). Does NOT
// delete the old data URLs until you verify the new URLs resolve; run with
// --dry-run to preview counts without writing anything.

import { config } from '../src/config';
import { pool, q } from '../src/db';
import { r2Enabled, storageBackend, supabaseStorageEnabled, uploadImage } from '../src/lib/images';

const DRY_RUN = process.argv.includes('--dry-run');

type Row = { table: string; id: string; column: string; url: string; prefix: string; kind: 'avatar' | 'banner' | 'idea' };

async function collect(): Promise<Row[]> {
  const out: Row[] = [];

  const users = await q<{ id: string; avatar_url: string | null; banner_url: string | null }>(
    `SELECT id, avatar_url, banner_url FROM users WHERE avatar_url LIKE 'data:%' OR banner_url LIKE 'data:%'`,
  );
  for (const u of users.rows) {
    if (u.avatar_url?.startsWith('data:')) out.push({ table: 'users', id: u.id, column: 'avatar_url', url: u.avatar_url, prefix: 'avatars', kind: 'avatar' });
    if (u.banner_url?.startsWith('data:')) out.push({ table: 'users', id: u.id, column: 'banner_url', url: u.banner_url, prefix: 'banners', kind: 'banner' });
  }

  const ideas = await q<{ id: string; image_url: string | null }>(
    `SELECT id, image_url FROM ideas WHERE image_url LIKE 'data:%'`,
  );
  for (const i of ideas.rows) {
    if (i.image_url?.startsWith('data:')) out.push({ table: 'ideas', id: i.id, column: 'image_url', url: i.image_url, prefix: 'ideas', kind: 'idea' });
  }

  return out;
}

async function main() {
  if (!r2Enabled() && !supabaseStorageEnabled()) {
    console.error('[migrate-images] No object storage configured. Set R2_* or SUPABASE_* env vars first (see docs/IMAGE_STORAGE.md).');
    process.exit(1);
  }
  console.log(`[migrate-images] backend = ${storageBackend()}, dry-run = ${DRY_RUN}`);

  const rows = await collect();
  console.log(`[migrate-images] found ${rows.length} data-URL image(s) to migrate`);

  let ok = 0;
  let failed = 0;
  for (const r of rows) {
    try {
      if (DRY_RUN) {
        console.log(`  [dry-run] ${r.table}.${r.column} ${r.id} (${r.kind}, ${r.url.length} chars)`);
        ok++;
        continue;
      }
      const newUrl = await uploadImage(r.url, r.prefix, r.kind);
      await q(`UPDATE ${r.table} SET ${r.column} = $1 WHERE id = $2`, [newUrl, r.id]);
      console.log(`  migrated ${r.table}.${r.column} ${r.id} -> ${newUrl}`);
      ok++;
    } catch (e: any) {
      failed++;
      console.error(`  FAILED ${r.table}.${r.column} ${r.id}:`, e?.message ?? e);
    }
  }

  console.log(`[migrate-images] done: ${ok} migrated, ${failed} failed`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error('[migrate-images] fatal:', e);
  process.exit(1);
});
