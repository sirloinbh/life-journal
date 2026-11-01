-- Terms the user marked as learned (#69). The terms themselves live in backend/src/terms-data.ts.
CREATE TABLE IF NOT EXISTS learned_terms (
  term_id text PRIMARY KEY,
  learned_at timestamptz NOT NULL DEFAULT now()
);
