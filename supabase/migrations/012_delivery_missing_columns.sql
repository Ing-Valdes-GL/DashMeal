-- Add missing columns to deliveries table
ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS phone      TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill created_at from the related order's created_at for existing rows
UPDATE deliveries d
SET created_at = o.created_at
FROM orders o
WHERE d.order_id = o.id;

CREATE INDEX IF NOT EXISTS deliveries_created_at_idx ON deliveries(created_at DESC);
