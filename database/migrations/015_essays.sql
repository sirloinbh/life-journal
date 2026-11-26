-- Essays (#239): longer writing with a title, a Markdown body, the date it was written, a status (draft or done) and
-- tags. The body may be empty while a draft is being started; the API fills a blank title with "Untitled", trims
-- the title, normalizes line breaks, and merges tags that differ only in letter case, so the CHECKs only stop rows
-- written another way. Tags follow the same rules as item tags (item_names_valid, migration 010).
-- Safe to run again: the table and index are created only when missing.
-- No BEGIN/COMMIT here: the migration runner wraps each file in one (#83).
CREATE TABLE IF NOT EXISTS essays (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  written_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT essays_title_check CHECK (char_length(title) BETWEEN 1 AND 200),
  CONSTRAINT essays_body_check CHECK (char_length(body) <= 50000),
  CONSTRAINT essays_status_check CHECK (status IN ('draft', 'done')),
  CONSTRAINT essays_tags_check CHECK (item_names_valid(tags))
);

CREATE INDEX IF NOT EXISTS essays_written_date_idx ON essays (written_date DESC, id DESC);
