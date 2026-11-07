CREATE TABLE users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       text NOT NULL UNIQUE,
  name        text NOT NULL DEFAULT '',
  handle      text NOT NULL UNIQUE,
  bio         text NOT NULL DEFAULT '',
  is_banned   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE otps (
  phone       text PRIMARY KEY,
  code_hash   text NOT NULL,
  attempts    int  NOT NULL DEFAULT 0,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ideas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       uuid NOT NULL REFERENCES users(id),
  name           text NOT NULL,
  category       text NOT NULL CHECK (category IN ('Snacks','Skincare','Clothing','Apps')),
  description    text NOT NULL,
  price_paise    int  NOT NULL CHECK (price_paise > 0),
  goal           int  NOT NULL CHECK (goal > 0),
  status         text NOT NULL DEFAULT 'live' CHECK (status IN ('live','funded','failed','removed')),
  settled_qty    int,
  removed_reason text,
  deadline       timestamptz NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ideas_status_deadline ON ideas (status, deadline);
CREATE INDEX ideas_owner ON ideas (owner_id);

CREATE TABLE vouches (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idea_id    uuid NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, idea_id)
);
CREATE INDEX vouches_idea ON vouches (idea_id);

CREATE TABLE comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id    uuid NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comments_idea ON comments (idea_id, created_at DESC);

CREATE TABLE follows (
  follower_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);

CREATE TABLE orders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id),
  idea_id             uuid NOT NULL REFERENCES ideas(id),
  qty                 int  NOT NULL CHECK (qty BETWEEN 1 AND 9),
  amount_paise        int  NOT NULL CHECK (amount_paise > 0),
  status              text NOT NULL DEFAULT 'created' CHECK (status IN ('created','paid','refunded','failed')),
  provider            text NOT NULL,
  provider_order_id   text UNIQUE,
  provider_payment_id text UNIQUE,
  refund_id           text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  paid_at             timestamptz,
  refunded_at         timestamptz
);
CREATE INDEX orders_idea_status ON orders (idea_id, status);
CREATE INDEX orders_user ON orders (user_id, created_at DESC);

CREATE TABLE reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idea_id     uuid NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  reason      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reporter_id, idea_id)
);

CREATE TABLE notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       text NOT NULL,
  title      text NOT NULL,
  body       text NOT NULL DEFAULT '',
  data       jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user ON notifications (user_id, created_at DESC);
