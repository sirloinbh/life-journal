-- Repeated tastings and visits of an item (#214). The item keeps its own completed date, rating, and review as the
-- first completion; each log is one more visit with its own date, an optional rating (0.5 to 5 in 0.5 steps), an
-- optional note (up to 500 characters), and an optional cost. The API allows logs on the categories in
-- LOG_CATEGORIES (shared/contract.ts) and keeps an item with logs in its category. A log goes with its item.
-- Safe to run again: the table and index are created only when missing.
-- No BEGIN/COMMIT here: the migration runner wraps each file in one (#83).
CREATE TABLE IF NOT EXISTS item_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_id bigint NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  logged_on date NOT NULL,
  rating numeric(2, 1)
    CONSTRAINT item_logs_rating_check
      CHECK (rating IS NULL OR (rating BETWEEN 0.5 AND 5 AND rating * 2 = floor(rating * 2))),
  note text
    CONSTRAINT item_logs_note_check CHECK (note IS NULL OR (btrim(note) <> '' AND char_length(note) <= 500)),
  cost_krw integer CONSTRAINT item_logs_cost_check CHECK (cost_krw IS NULL OR cost_krw >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS item_logs_item_id_idx ON item_logs (item_id, logged_on DESC, id DESC);
