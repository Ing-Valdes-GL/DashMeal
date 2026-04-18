-- ============================================================
-- DASH MEAL — Migration 014 : Wallet par Agence
-- Remplace brand_wallets par branch_wallets (un wallet par agence)
-- Le wallet admin = somme de ses agences
-- ============================================================

-- ─── Supprimer l'ancien système ──────────────────────────────────────────────

DROP TABLE IF EXISTS brand_wallet_transactions CASCADE;
DROP TABLE IF EXISTS brand_wallets CASCADE;
DROP FUNCTION IF EXISTS credit_brand_wallet CASCADE;
DROP FUNCTION IF EXISTS process_wallet_withdrawal CASCADE;

-- Adapter platform_wallet_transactions (supprimer l'ancien FK)
ALTER TABLE platform_wallet_transactions
  DROP COLUMN IF EXISTS brand_wallet_transaction_id,
  ADD COLUMN IF NOT EXISTS branch_wallet_transaction_id UUID;

-- ─── Wallet par agence ───────────────────────────────────────────────────────

CREATE TABLE branch_wallets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id       UUID UNIQUE NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  balance         NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  total_credited  NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_withdrawn NUMERIC(14,2) NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_branch_wallets_brand  ON branch_wallets(brand_id);
CREATE INDEX idx_branch_wallets_branch ON branch_wallets(branch_id);

CREATE TRIGGER set_branch_wallets_updated_at
  BEFORE UPDATE ON branch_wallets
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─── Transactions par agence ─────────────────────────────────────────────────

CREATE TABLE branch_wallet_transactions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id        UUID NOT NULL REFERENCES branch_wallets(id) ON DELETE CASCADE,
  branch_id        UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  brand_id         UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  type             TEXT NOT NULL CHECK (type IN ('credit', 'withdrawal')),
  amount           NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  balance_after    NUMERIC(14,2) NOT NULL,
  description      TEXT NOT NULL,
  order_id         UUID REFERENCES orders(id),
  payment_id       UUID REFERENCES payments(id),
  campay_reference TEXT,
  platform_fee     NUMERIC(14,2),
  net_payout       NUMERIC(14,2),
  status           TEXT NOT NULL DEFAULT 'completed'
                   CHECK (status IN ('pending', 'completed', 'failed')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bwt_brand_date   ON branch_wallet_transactions(brand_id,  created_at DESC);
CREATE INDEX idx_bwt_branch_date  ON branch_wallet_transactions(branch_id, created_at DESC);
CREATE INDEX idx_bwt_order        ON branch_wallet_transactions(order_id);

-- Ajouter la contrainte FK après la création de la table
ALTER TABLE platform_wallet_transactions
  ADD CONSTRAINT fk_pwt_branch_txn
  FOREIGN KEY (branch_wallet_transaction_id)
  REFERENCES branch_wallet_transactions(id);

-- ─── Fonction : créditer le wallet d'une agence ──────────────────────────────

CREATE OR REPLACE FUNCTION credit_branch_wallet(
  p_branch_id   UUID,
  p_brand_id    UUID,
  p_amount      NUMERIC,
  p_payment_id  UUID,
  p_order_id    UUID,
  p_description TEXT
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_wallet_id   UUID;
  v_new_balance NUMERIC;
BEGIN
  -- Créer le wallet si inexistant
  INSERT INTO branch_wallets (branch_id, brand_id)
  VALUES (p_branch_id, p_brand_id)
  ON CONFLICT (branch_id) DO NOTHING;

  -- Incrémenter et récupérer l'id + nouveau solde
  UPDATE branch_wallets
  SET balance        = balance + p_amount,
      total_credited = total_credited + p_amount
  WHERE branch_id = p_branch_id
  RETURNING id, balance INTO v_wallet_id, v_new_balance;

  INSERT INTO branch_wallet_transactions
    (wallet_id, branch_id, brand_id, type, amount, balance_after,
     description, payment_id, order_id, status)
  VALUES
    (v_wallet_id, p_branch_id, p_brand_id, 'credit', p_amount, v_new_balance,
     p_description, p_payment_id, p_order_id, 'completed');
END;
$$;

-- ─── Fonction : retrait depuis une agence avec commission superadmin ──────────

CREATE OR REPLACE FUNCTION process_branch_withdrawal(
  p_branch_id        UUID,
  p_brand_id         UUID,
  p_amount           NUMERIC,
  p_platform_fee     NUMERIC,
  p_net_payout       NUMERIC,
  p_description      TEXT,
  p_campay_reference TEXT
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_wallet_id        UUID;
  v_current_balance  NUMERIC;
  v_new_balance      NUMERIC;
  v_txn_id           UUID;
  v_platform_id      UUID;
  v_platform_balance NUMERIC;
BEGIN
  SELECT id, balance INTO v_wallet_id, v_current_balance
  FROM branch_wallets WHERE branch_id = p_branch_id FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'WALLET_NOT_FOUND';
  END IF;

  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
  END IF;

  v_new_balance := v_current_balance - p_amount;

  UPDATE branch_wallets
  SET balance         = v_new_balance,
      total_withdrawn = total_withdrawn + p_amount
  WHERE id = v_wallet_id;

  INSERT INTO branch_wallet_transactions
    (wallet_id, branch_id, brand_id, type, amount, balance_after, description,
     campay_reference, platform_fee, net_payout, status)
  VALUES
    (v_wallet_id, p_branch_id, p_brand_id, 'withdrawal', p_amount, v_new_balance,
     p_description, p_campay_reference, p_platform_fee, p_net_payout, 'completed')
  RETURNING id INTO v_txn_id;

  IF p_platform_fee > 0 THEN
    SELECT id, balance INTO v_platform_id, v_platform_balance
    FROM platform_wallet LIMIT 1 FOR UPDATE;

    UPDATE platform_wallet
    SET balance        = balance + p_platform_fee,
        total_received = total_received + p_platform_fee
    WHERE id = v_platform_id;

    INSERT INTO platform_wallet_transactions
      (type, amount, balance_after, description, brand_id, branch_wallet_transaction_id)
    VALUES
      ('commission', p_platform_fee, v_platform_balance + p_platform_fee,
       p_description, p_brand_id, v_txn_id);
  END IF;

  RETURN v_txn_id;
END;
$$;
