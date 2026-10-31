-- Overall and per-criterion ratings of completed items (#27). The API validates criteria per category.
ALTER TABLE items ADD COLUMN IF NOT EXISTS rating numeric(2, 1)
  CHECK (
    rating IS NULL
    OR (rating BETWEEN 0.5 AND 5 AND rating * 2 = floor(rating * 2) AND status = 'done')
  );

ALTER TABLE items ADD COLUMN IF NOT EXISTS sub_ratings jsonb NOT NULL DEFAULT '{}'::jsonb
  CHECK (jsonb_typeof(sub_ratings) = 'object' AND (status = 'done' OR sub_ratings = '{}'::jsonb));
