-- Bucket-list items and completed records of the five categories (#22).
-- Category-specific fields live in details and are validated per category by the API.
CREATE TABLE IF NOT EXISTS items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category text NOT NULL CHECK (category IN ('reading', 'screen', 'stage', 'drink', 'travel')),
  subtype text,
  title text NOT NULL CHECK (btrim(title) <> ''),
  status text NOT NULL DEFAULT 'wishlist' CHECK (status IN ('wishlist', 'done')),
  cost_krw integer CHECK (cost_krw >= 0),
  planned_date date,
  completed_date date,
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'done') = (completed_date IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS items_created_at_idx ON items (created_at DESC, id DESC);
