-- Add 'pending' to delivery_status enum (hidden from drivers until order is ready)
ALTER TYPE delivery_status ADD VALUE IF NOT EXISTS 'pending' BEFORE 'assigned';

-- Backfill: activate deliveries for orders already at 'ready' status
-- (rows created before this migration have status='assigned' by default — leave them)
-- New rows created after backend change will have status='pending' and need no backfill here.
-- This is a safety net for any future re-runs or partial states.
UPDATE deliveries d
SET status = 'assigned'
FROM orders o
WHERE d.order_id = o.id
  AND o.status = 'ready'
  AND o.type = 'delivery'
  AND d.status::text = 'pending'
  AND d.driver_id IS NULL;
