-- One journal entry per date (#210): an optional title up to 200 characters and plain text with line breaks up to
-- 10,000 characters (owner decision on #210, option B).
-- The API trims the title (a blank title is stored as NULL), normalizes line breaks, trims the text, and refuses dates after today (Asia/Seoul); the CHECK only stops
-- rows written another way. #211 links items to an entry by its id.
-- Safe to run again: the table is created only when missing.
-- No BEGIN/COMMIT here: the migration runner wraps each file in one (#83).
CREATE TABLE IF NOT EXISTS journal_entries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entry_date date NOT NULL,
  title text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT journal_entries_entry_date_key UNIQUE (entry_date),
  CONSTRAINT journal_entries_title_check CHECK (title IS NULL OR char_length(title) BETWEEN 1 AND 200),
  CONSTRAINT journal_entries_body_check CHECK (char_length(body) BETWEEN 1 AND 10000)
);
