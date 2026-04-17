-- Add brand_id to deliveries for fast driver-scoped filtering
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id);

-- Backfill from the order's branch
UPDATE deliveries d
SET brand_id = b.brand_id
FROM orders o
JOIN branches b ON b.id = o.branch_id
WHERE d.order_id = o.id
  AND d.brand_id IS NULL;

CREATE INDEX IF NOT EXISTS deliveries_brand_available_idx
  ON deliveries(brand_id, status)
  WHERE status = 'assigned' AND driver_id IS NULL;
