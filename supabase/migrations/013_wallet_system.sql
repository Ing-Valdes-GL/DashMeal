-- ============================================================
-- DASH MEAL — Migration 013 : Système Wallet
-- brand_wallets, brand_wallet_transactions,
-- platform_wallet, platform_wallet_transactions
-- ============================================================

-- ─── Wallet des marques ───────────────────────────────────────────────────────

CREATE TABLE brand_wallets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id        UUID UNIQUE NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  balance         NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  total_credited  NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_withdrawn NUMERIC(14,2) NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_brand_wallets_brand ON brand_wallets(brand_id);

CREATE TRIGGER set_brand_wallets_updated_at
  BEFORE UPDATE ON brand_wallets
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─── Transactions du wallet marque ────────────────────────────────────────────

CREATE TABLE brand_wallet_transactions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id        UUID NOT NULL REFERENCES brand_wallets(id) ON DELETE CASCADE,
  type             TEXT NOT NULL CHECK (type IN ('credit', 'withdrawal')),
  amount           NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  balance_after    NUMERIC(14,2) NOT NULL,
  description      TEXT NOT NULL,
  order_id         UUID REFERENCES orders(id),
  payment_id       UUID REFERENCES payments(id),
  campay_reference TEXT,
  platform_fee     NUMERIC(14,2),     -- montant prélevé pour le superadmin (retrait uniquement)
  net_payout       NUMERIC(14,2),     -- montant réellement envoyé à l'agence (retrait uniquement)
  status           TEXT NOT NULL DEFAULT 'completed'
                   CHECK (status IN ('pending', 'completed', 'failed')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bwt_wallet_date ON brand_wallet_transactions(wallet_id, created_at DESC);
CREATE INDEX idx_bwt_order       ON brand_wallet_transactions(order_id);

-- ─── Wallet plateforme (superadmin) ──────────────────────────────────────────

CREATE TABLE platform_wallet (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  balance        NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  total_received NUMERIC(14,2) NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_platform_wallet_updated_at
  BEFORE UPDATE ON platform_wallet
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Seed : une seule ligne
INSERT INTO platform_wallet DEFAULT VALUES;

-- ─── Transactions wallet plateforme ──────────────────────────────────────────

CREATE TABLE platform_wallet_transactions (
  id                           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type                         TEXT NOT NULL CHECK (type IN ('commission')),
  amount                       NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  balance_after                NUMERIC(14,2) NOT NULL,
  description                  TEXT NOT NULL,
  brand_id                     UUID REFERENCES brands(id),
  brand_wallet_transaction_id  UUID REFERENCES brand_wallet_transactions(id),
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pwt_created  ON platform_wallet_transactions(created_at DESC);
CREATE INDEX idx_pwt_brand    ON platform_wallet_transactions(brand_id);

-- ─── Fonction : créditer le wallet d'une marque (paiement commande) ──────────

CREATE OR REPLACE FUNCTION credit_brand_wallet(
  p_brand_id   UUID,
  p_amount     NUMERIC,
  p_payment_id UUID,
  p_order_id   UUID,
  p_description TEXT
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_wallet_id      UUID;
  v_new_balance    NUMERIC;
BEGIN
  -- Créer le wallet si inexistant
  INSERT INTO brand_wallets (brand_id) VALUES (p_brand_id)
  ON CONFLICT (brand_id) DO NOTHING;

  -- Verrouiller + incrémenter
  UPDATE brand_wallets
  SET balance        = balance + p_amount,
      total_credited = total_credited + p_amount
  WHERE brand_id = p_brand_id
  RETURNING id, balance INTO v_wallet_id, v_new_balance;

  -- Enregistrer la transaction
  INSERT INTO brand_wallet_transactions
    (wallet_id, type, amount, balance_after, description, payment_id, order_id, status)
  VALUES
    (v_wallet_id, 'credit', p_amount, v_new_balance, p_description, p_payment_id, p_order_id, 'completed');
END;
$$;

-- ─── Fonction : retrait avec commission superadmin ────────────────────────────

CREATE OR REPLACE FUNCTION process_wallet_withdrawal(
  p_brand_id        UUID,
  p_amount          NUMERIC,   -- montant demandé par l'agence
  p_platform_fee    NUMERIC,   -- 1.5% du montant
  p_net_payout      NUMERIC,   -- montant envoyé à l'agence (après frais)
  p_description     TEXT,
  p_campay_reference TEXT
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_wallet_id          UUID;
  v_current_balance    NUMERIC;
  v_new_balance        NUMERIC;
  v_txn_id             UUID;
  v_platform_id        UUID;
  v_platform_balance   NUMERIC;
BEGIN
  -- Verrouiller le wallet marque
  SELECT id, balance INTO v_wallet_id, v_current_balance
  FROM brand_wallets WHERE brand_id = p_brand_id FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'WALLET_NOT_FOUND';
  END IF;

  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
  END IF;

  v_new_balance := v_current_balance - p_amount;

  -- Débiter le wallet marque
  UPDATE brand_wallets
  SET balance         = v_new_balance,
      total_withdrawn = total_withdrawn + p_amount
  WHERE id = v_wallet_id;

  INSERT INTO brand_wallet_transactions
    (wallet_id, type, amount, balance_after, description,
     campay_reference, platform_fee, net_payout, status)
  VALUES
    (v_wallet_id, 'withdrawal', p_amount, v_new_balance, p_description,
     p_campay_reference, p_platform_fee, p_net_payout, 'completed')
  RETURNING id INTO v_txn_id;

  -- Créditer le wallet plateforme uniquement si les frais sont > 0
  IF p_platform_fee > 0 THEN
    SELECT id, balance INTO v_platform_id, v_platform_balance
    FROM platform_wallet LIMIT 1 FOR UPDATE;

    UPDATE platform_wallet
    SET balance        = balance + p_platform_fee,
        total_received = total_received + p_platform_fee
    WHERE id = v_platform_id;

    INSERT INTO platform_wallet_transactions
      (type, amount, balance_after, description, brand_id, brand_wallet_transaction_id)
    VALUES
      ('commission', p_platform_fee, v_platform_balance + p_platform_fee,
       p_description, p_brand_id, v_txn_id);
  END IF;

  RETURN v_txn_id;
END;
$$;
