-- Short review of a completed item (#28). The API also limits it to 5 lines.
ALTER TABLE items ADD COLUMN IF NOT EXISTS review text
  CHECK (review IS NULL OR (char_length(review) <= 500 AND status = 'done'));
