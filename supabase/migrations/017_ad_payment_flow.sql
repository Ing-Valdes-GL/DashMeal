-- ─── Migration 017 : Paiement pub via Campay -> wallet plateforme ─────────────

CREATE TABLE IF NOT EXISTS ad_payment_intents (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id         UUID          NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  title            TEXT          NOT NULL,
  image_url        TEXT          NOT NULL,
  target_count     INT           NOT NULL CHECK (target_count >= 6),
  amount           NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  campay_reference TEXT          NOT NULL,
  payment_phone    TEXT          NOT NULL,
  status           TEXT          NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'paid', 'failed', 'expired')),
  ad_id            UUID,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ   NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes')
);

CREATE INDEX IF NOT EXISTS idx_ad_intents_ref    ON ad_payment_intents(campay_reference);
CREATE INDEX IF NOT EXISTS idx_ad_intents_brand  ON ad_payment_intents(brand_id);
CREATE INDEX IF NOT EXISTS idx_ad_intents_status ON ad_payment_intents(status);

ALTER TABLE platform_wallet_transactions
  DROP CONSTRAINT IF EXISTS platform_wallet_transactions_type_check;

ALTER TABLE platform_wallet_transactions
  ADD CONSTRAINT platform_wallet_transactions_type_check
  CHECK (type IN ('commission', 'ad_payment', 'withdrawal'));

ALTER TABLE platform_wallet_transactions
  ADD COLUMN IF NOT EXISTS campay_reference TEXT;
