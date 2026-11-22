-- Explicit names for every CHECK on items (#145). 002-005 left them unnamed, so PostgreSQL generated names such as
-- items_check or items_check1 that depend on the order the constraints were created. Each CHECK is found by the
-- columns it uses and renamed to the name below, so later migrations can drop or replace it by name.
-- A rename does not re-check the rows. If an expected CHECK is missing, the migration fails instead of skipping it.
-- Safe to run again: a CHECK that already has its name is left alone.
-- No BEGIN/COMMIT here: the migration runner wraps each file in one (#83).
DO $$
DECLARE
  target record;
  candidates text[];
  stale record;
BEGIN
  -- 007 dropped the old category CHECK only by its usual generated name. If it had another name, it still rejects
  -- 'coffee'; items_category_check from 007 allows every category, so an older category-only CHECK is dropped.
  FOR stale IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ALL (c.conkey)
    WHERE c.conrelid = 'items'::regclass AND c.contype = 'c'
      AND c.conname <> 'items_category_check'
      AND cardinality(c.conkey) = 1 AND a.attname = 'category'
      AND pg_get_constraintdef(c.oid) NOT LIKE '%''coffee''%'
  LOOP
    EXECUTE format('ALTER TABLE items DROP CONSTRAINT %I', stale.conname);
  END LOOP;

  FOR target IN
    SELECT *
    FROM (VALUES
      ('items_category_check', ARRAY['category']),
      ('items_title_check', ARRAY['title']),
      ('items_status_check', ARRAY['status']),
      ('items_cost_krw_check', ARRAY['cost_krw']),
      ('items_details_check', ARRAY['details']),
      ('items_status_dates', ARRAY['completed_date', 'status']),
      ('items_rating_check', ARRAY['rating', 'status']),
      ('items_sub_ratings_check', ARRAY['status', 'sub_ratings']),
      ('items_review_check', ARRAY['review', 'status']),
      ('items_link_check', ARRAY['link'])
    ) AS wanted(name, columns)
  LOOP
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'items'::regclass AND contype = 'c' AND conname = target.name
    );
    -- Only CHECKs that do not already carry one of the names above can be renamed.
    SELECT array_agg(c.conname ORDER BY c.conname) INTO candidates
    FROM pg_constraint c
    WHERE c.conrelid = 'items'::regclass AND c.contype = 'c'
      AND c.conname NOT IN ('items_category_check', 'items_title_check', 'items_status_check',
        'items_cost_krw_check', 'items_details_check', 'items_status_dates', 'items_rating_check',
        'items_sub_ratings_check', 'items_review_check', 'items_link_check')
      AND (SELECT array_agg(a.attname::text ORDER BY a.attname::text)
           FROM unnest(c.conkey) AS k(attnum)
           JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) = target.columns;
    IF candidates IS NULL THEN
      RAISE EXCEPTION 'items has no CHECK on (%) to name %', array_to_string(target.columns, ', '), target.name;
    END IF;
    IF cardinality(candidates) > 1 THEN
      RAISE EXCEPTION 'items has more than one CHECK on (%): %', array_to_string(target.columns, ', '),
        array_to_string(candidates, ', ');
    END IF;
    EXECUTE format('ALTER TABLE items RENAME CONSTRAINT %I TO %I', candidates[1], target.name);
  END LOOP;
END
$$;
