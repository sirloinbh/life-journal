-- The coffee category (#74). Replaces the category CHECK of 002 so it also allows 'coffee'.
-- Safe to run again: the old constraint is dropped by name before the new one is added.
BEGIN;
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_category_check;
ALTER TABLE items ADD CONSTRAINT items_category_check
  CHECK (category IN ('reading', 'screen', 'stage', 'drink', 'travel', 'coffee'));
COMMIT;
