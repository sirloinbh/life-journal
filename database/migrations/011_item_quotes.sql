-- Quotes and highlights of reading items (#217), kept apart from the short review.
-- The text holds up to 1,000 characters; the page and a note (up to 500 characters) are optional. The API allows
-- quotes on reading items only and keeps an item with quotes in Reading. A quote goes when its item is deleted.
-- Safe to run again: the table and index are created only when missing.
-- No BEGIN/COMMIT here: the migration runner wraps each file in one (#83).
CREATE TABLE IF NOT EXISTS item_quotes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_id bigint NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  text text NOT NULL
    CONSTRAINT item_quotes_text_check CHECK (btrim(text) <> '' AND char_length(text) <= 1000),
  page integer CONSTRAINT item_quotes_page_check CHECK (page IS NULL OR page BETWEEN 1 AND 99999),
  note text
    CONSTRAINT item_quotes_note_check CHECK (note IS NULL OR (btrim(note) <> '' AND char_length(note) <= 500)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS item_quotes_item_id_idx ON item_quotes (item_id, id);
