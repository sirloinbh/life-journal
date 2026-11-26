-- Items linked to a journal entry (#211), such as "the play I saw tonight". Deleting the entry or the item removes
-- the link. Only items completed on the entry's date can be linked (owner decision pending, see #211): the API
-- checks that when linking, and the trigger below removes a link when its item's completed date moves to another
-- day or the item is marked as not done.
-- Safe to run again: the table and index are created only when missing, the function is replaced, and the trigger
-- is dropped by name before it is created.
-- No BEGIN/COMMIT here: the migration runner wraps each file in one (#83).
CREATE TABLE IF NOT EXISTS journal_entry_items (
  entry_id bigint NOT NULL REFERENCES journal_entries (id) ON DELETE CASCADE,
  item_id bigint NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  linked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT journal_entry_items_pkey PRIMARY KEY (entry_id, item_id)
);

CREATE INDEX IF NOT EXISTS journal_entry_items_item_id_idx ON journal_entry_items (item_id);

CREATE OR REPLACE FUNCTION journal_entry_items_unlink_moved() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM journal_entry_items AS link
  USING journal_entries AS entry
  WHERE link.item_id = NEW.id
    AND entry.id = link.entry_id
    AND (NEW.completed_date IS NULL OR entry.entry_date <> NEW.completed_date);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS items_unlink_moved_journal ON items;
CREATE TRIGGER items_unlink_moved_journal
  AFTER UPDATE OF completed_date ON items
  FOR EACH ROW
  WHEN (OLD.completed_date IS DISTINCT FROM NEW.completed_date)
  EXECUTE FUNCTION journal_entry_items_unlink_moved();
