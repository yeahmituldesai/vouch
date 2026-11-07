-- Optional image support (Cloudflare R2 / S3 compatible). URL stored; null = use category icon.
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text;