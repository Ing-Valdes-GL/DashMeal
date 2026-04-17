-- Migration 007 — Driver push token + brand_id in delivery flow

-- Push token for driver notifications
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Index for fast token lookup by brand
CREATE INDEX IF NOT EXISTS drivers_brand_active_idx ON drivers(brand_id, is_active)
  WHERE is_active = true;
