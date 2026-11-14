-- Push notification tokens (Expo push tokens on Android).
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token text;