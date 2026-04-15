-- ============================================================
-- DASH MEAL — Migration 004 : Payment Intents
-- Table intermédiaire pour stocker les données de commande
-- AVANT que le paiement soit confirmé
-- ============================================================

CREATE TABLE payment_intents (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reference    TEXT NOT NULL UNIQUE,          -- référence CamPay
  amount       INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'paid', 'failed', 'expired')),
  order_data   JSONB NOT NULL,               -- données de commande (items, branch, slot...)
  order_id     UUID REFERENCES orders(id),   -- rempli une fois la commande créée
  ussd_code    TEXT,
  operator     TEXT,
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '15 minutes',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_intents_reference ON payment_intents(reference);
CREATE INDEX idx_payment_intents_user      ON payment_intents(user_id);

CREATE TRIGGER set_payment_intents_updated_at
  BEFORE UPDATE ON payment_intents
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
