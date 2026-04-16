-- Migration 006 — Driver PIN authentication + brand isolation
-- Adds pin_hash for driver login, brand_id for brand filtering

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS pin_hash  TEXT,
  ADD COLUMN IF NOT EXISTS brand_id  UUID REFERENCES brands(id) ON DELETE SET NULL;

-- Index for quick lookup by phone (login)
CREATE INDEX IF NOT EXISTS drivers_phone_idx ON drivers(phone);

-- Index for brand filtering
CREATE INDEX IF NOT EXISTS drivers_brand_idx ON drivers(brand_id);

-- Backfill brand_id from admin relationship where possible
UPDATE drivers d
SET brand_id = a.brand_id
FROM admins a
WHERE d.admin_id = a.id
  AND d.brand_id IS NULL;
