-- Notion pages (#241): the pages and databases imported from Notion, kept as their own Documents list, apart from
-- essays. The tree is kept by Notion ids: parent_notion_id is the Notion id of the parent page or database, and it is
-- NULL for a top page. There is no foreign key on it, because a top page's parent (the workspace, or a page that is not
-- shared with the integration) is never imported. A page that is gone from Notion keeps its row with deleted_at set.
-- Safe to run again: the table and index are created only when missing.
-- No BEGIN/COMMIT here: the migration runner wraps each file in one (#83).
CREATE TABLE IF NOT EXISTS notion_pages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  notion_id text NOT NULL,
  parent_notion_id text,
  kind text NOT NULL DEFAULT 'page',
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  path text NOT NULL,
  notion_edited_at timestamptz NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT notion_pages_notion_id_key UNIQUE (notion_id),
  CONSTRAINT notion_pages_kind_check CHECK (kind IN ('page', 'database')),
  CONSTRAINT notion_pages_title_check CHECK (char_length(title) BETWEEN 1 AND 500),
  CONSTRAINT notion_pages_body_check CHECK (char_length(body) <= 2000000)
);

CREATE INDEX IF NOT EXISTS notion_pages_parent_idx ON notion_pages (parent_notion_id);
