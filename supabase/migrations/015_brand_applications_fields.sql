-- Ajout des colonnes manquantes pour les demandes de marque via landing page
ALTER TABLE brand_applications
  ADD COLUMN IF NOT EXISTS contact_name  TEXT,
  ADD COLUMN IF NOT EXISTS city          TEXT,
  ADD COLUMN IF NOT EXISTS description   TEXT,
  ADD COLUMN IF NOT EXISTS password_hash TEXT;
