-- "I'd buy this": a free signal used while payments are switched off.
CREATE TABLE wants (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idea_id    uuid NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, idea_id)
);
CREATE INDEX wants_idea ON wants (idea_id);
