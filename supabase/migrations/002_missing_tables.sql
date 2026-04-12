-- ============================================================
-- DASH MEAL — Migration 002 : Tables manquantes
-- saved_addresses, push_tokens, driver_positions
-- ============================================================

-- ─── ADRESSES ENREGISTRÉES DES UTILISATEURS ──────────────────────────────────

CREATE TABLE saved_addresses (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,                       -- ex: "Maison", "Bureau"
  address    TEXT NOT NULL,
  lat        DOUBLE PRECISION NOT NULL,
  lng        DOUBLE PRECISION NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_saved_addresses_user ON saved_addresses(user_id);

-- Garantie : un seul is_default par utilisateur
-- (géré applicativement dans users.controller.ts via UPDATE ... WHERE is_default = TRUE)

-- ─── TOKENS PUSH EXPO DES UTILISATEURS ───────────────────────────────────────

CREATE TABLE push_tokens (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL,
  locale     TEXT NOT NULL DEFAULT 'fr' CHECK (locale IN ('fr', 'en')),
  platform   TEXT CHECK (platform IN ('ios', 'android', 'web')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, token)
);
CREATE INDEX idx_push_tokens_user ON push_tokens(user_id);

CREATE TRIGGER set_push_tokens_updated_at
  BEFORE UPDATE ON push_tokens
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─── POSITIONS DES LIVREURS (UNE LIGNE PAR LIVRAISON ACTIVE) ─────────────────

CREATE TABLE driver_positions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id UUID UNIQUE NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  driver_id   UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  lat         DOUBLE PRECISION NOT NULL,
  lng         DOUBLE PRECISION NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_driver_positions_driver ON driver_positions(driver_id);

CREATE TRIGGER set_driver_positions_updated_at
  BEFORE UPDATE ON driver_positions
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─── RLS SUR LES NOUVELLES TABLES ────────────────────────────────────────────

ALTER TABLE saved_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
-- driver_positions : pas de RLS, accès uniquement via service_role (backend)

-- ─── INDEX UNIQUE POUR BRAND_DOCUMENTS (application_id + type) ───────────────
-- Requis par l'upsert dans documents.controller.ts

ALTER TABLE brand_documents
  ADD CONSTRAINT uq_brand_documents_application_type UNIQUE (application_id, type);
