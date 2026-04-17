-- Add photo_url to drivers table
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS photo_url TEXT;
