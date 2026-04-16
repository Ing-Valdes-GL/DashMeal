-- ============================================================
-- DASH MEAL — Migration 005 : Fonctionnalités utilisateur
-- avatar, paiement par défaut, favoris, chat média, notation
-- ============================================================

-- ─── UTILISATEURS : champs supplémentaires ────────────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_url               TEXT,
  ADD COLUMN IF NOT EXISTS default_payment_phone    TEXT,
  ADD COLUMN IF NOT EXISTS default_payment_method   TEXT
    CHECK (default_payment_method IN ('orange_money', 'mtn_mobile_money'));

-- ─── FAVORIS AGENCES ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS branch_favorites (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  branch_id  UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, branch_id)
);
CREATE INDEX IF NOT EXISTS idx_branch_favorites_user   ON branch_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_branch_favorites_branch ON branch_favorites(branch_id);
ALTER TABLE branch_favorites ENABLE ROW LEVEL SECURITY;

-- ─── CHAT : support médias (photos, notes vocales) ───────────────────────────

-- Rendre content nullable pour les messages purement médias
ALTER TABLE messages
  ALTER COLUMN content DROP NOT NULL;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'image', 'voice')),
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS duration_s INTEGER; -- durée en secondes pour les vocaux

-- Contrainte : text doit avoir content, image/voice peuvent avoir media_url
-- (vérifiée applicativement dans le controller)

-- ─── COMMANDES : notation agence ─────────────────────────────────────────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS rating         INTEGER CHECK (rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_comment TEXT,
  ADD COLUMN IF NOT EXISTS rated_at       TIMESTAMPTZ;

-- ─── CONVERSATIONS : type explicite ──────────────────────────────────────────
-- conversation_type ENUM existe déjà ('client_driver', 'client_support')
-- Rien à changer.
