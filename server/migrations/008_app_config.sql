-- Private key/value configuration (service connection only).
-- RLS is enabled with no policies so Supabase's public API can never read it.
CREATE TABLE IF NOT EXISTS app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
