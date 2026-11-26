-- Free tags and companions of an item (#215), such as "birthday" or the name of a friend.
-- Each list holds at most 20 names of 1 to 50 characters with no surrounding spaces, and no name twice when letter case
-- is ignored. The API trims names and merges duplicates first, so these CHECKs only stop rows written another way.
-- Companion names are personal data: they stay in this DB and are not sent to the AI tools (backend/src/items.ts).
-- Safe to run again: the function is replaced and each CHECK is dropped by name before it is added.
-- No BEGIN/COMMIT here: the migration runner wraps each file in one (#83).
CREATE OR REPLACE FUNCTION item_names_valid(names text[]) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_ndims(names), 1) = 1
    AND array_position(names, NULL) IS NULL
    AND cardinality(names) <= 20
    AND NOT EXISTS (
      SELECT 1 FROM unnest(names) AS name
      WHERE name <> btrim(name) OR name = '' OR char_length(name) > 50
    )
    AND (SELECT count(DISTINCT lower(name)) FROM unnest(names) AS name) = cardinality(names)
$$;

ALTER TABLE items ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE items ADD COLUMN IF NOT EXISTS companions text[] NOT NULL DEFAULT '{}';

ALTER TABLE items DROP CONSTRAINT IF EXISTS items_tags_check;
ALTER TABLE items ADD CONSTRAINT items_tags_check CHECK (item_names_valid(tags));
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_companions_check;
ALTER TABLE items ADD CONSTRAINT items_companions_check CHECK (item_names_valid(companions));
