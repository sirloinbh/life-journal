-- Reference link of an item, opened by the user (#41). The server never fetches it.
ALTER TABLE items ADD COLUMN IF NOT EXISTS link text
  CHECK (link IS NULL OR (char_length(link) <= 2000 AND link ~* '^https?://'));
