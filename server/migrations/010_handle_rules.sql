-- Normalize existing handles to lowercase.
UPDATE users SET handle = lower(handle);

-- Repair any handle that no longer matches X's rules (4-15 chars, a-z 0-9 _).
UPDATE users
   SET handle = 'user' || substr(md5(id::text), 1, 6)
 WHERE handle !~ '^[a-z0-9_]{4,15}$';

-- Drop the case-sensitive unique constraint and replace with a case-insensitive one.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_handle_key;
CREATE UNIQUE INDEX IF NOT EXISTS users_handle_lower_unique ON users (lower(handle));

-- Enforce X-style handle format at the database level.
ALTER TABLE users
  ADD CONSTRAINT users_handle_format CHECK (handle ~ '^[a-z0-9_]{4,15}$');
