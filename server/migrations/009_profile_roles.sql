-- X-like profile + roles
ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_url text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS location text NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS website text NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member' CHECK (role IN ('member','founder','backer','admin'));
-- (following/followers counts are computed via subqueries; no denormalized column)