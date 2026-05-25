-- 021 : User Wallet — portefeuille électronique client

-- ── 1. user_wallets ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_wallets (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID    NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  card_number       CHAR(8) NOT NULL UNIQUE,
  card_name         TEXT    NOT NULL,
  balance           DECIMAL(12,2) NOT NULL DEFAULT 0,
  pin_hash          TEXT    NOT NULL,
  biometric_enabled BOOLEAN NOT NULL DEFAULT false,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  -- Interdit les soldes négatifs
  CONSTRAINT user_wallets_balance_non_negative CHECK (balance >= 0)
);

-- ── 2. commission_wallet (superadmin — agrège les frais de retrait 2% + transfert 1%) ──
CREATE TABLE IF NOT EXISTS commission_wallet (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  balance               DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_fees_collected  DECIMAL(12,2) NOT NULL DEFAULT 0,
  updated_at            TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT commission_wallet_balance_non_negative CHECK (balance >= 0)
);
-- Enregistrement unique
INSERT INTO commission_wallet (balance, total_fees_collected)
SELECT 0, 0 WHERE NOT EXISTS (SELECT 1 FROM commission_wallet);

-- ── 3. user_wallet_transactions ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_wallet_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id         UUID NOT NULL REFERENCES user_wallets(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type              TEXT NOT NULL CHECK (type IN (
    'activation',   -- dépôt initial d'activation
    'topup',        -- recharge via Mobile Money
    'payment',      -- paiement commande avec wallet
    'withdrawal',   -- retrait vers Mobile Money (frais 2%)
    'transfer_in',  -- transfert reçu d'un autre wallet (frais 1% à la charge de l'envoyeur)
    'transfer_out', -- transfert envoyé vers un autre wallet
    'refund'        -- remboursement commande
  )),
  amount            DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  fee_amount        DECIMAL(12,2) NOT NULL DEFAULT 0,
  balance_before    DECIMAL(12,2) NOT NULL,
  balance_after     DECIMAL(12,2) NOT NULL,
  reference         TEXT,                          -- référence Campay
  order_id          UUID REFERENCES orders(id) ON DELETE SET NULL,
  related_wallet_id UUID REFERENCES user_wallets(id) ON DELETE SET NULL,
  related_user_name TEXT,                          -- nom affiché dans l'historique
  description       TEXT NOT NULL,
  metadata          JSONB NOT NULL DEFAULT '{}',
  status            TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','completed','failed')),
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- ── 4. shared_carts (partage de panier entre utilisateurs) ───────────────────
CREATE TABLE IF NOT EXISTS shared_carts (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  token           TEXT    NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  owner_id        UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_name      TEXT    NOT NULL,
  branch_id       UUID    NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  branch_name     TEXT    NOT NULL,
  items           JSONB   NOT NULL,   -- [{product_id,product_name,unit_price,quantity}]
  order_type      TEXT    NOT NULL DEFAULT 'collect' CHECK (order_type IN ('collect','delivery')),
  promo_id        UUID    REFERENCES promo_codes(id) ON DELETE SET NULL,
  promo_code      TEXT,
  promo_pct       DECIMAL(5,2),
  subtotal        DECIMAL(12,2) NOT NULL,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount    DECIMAL(12,2) NOT NULL,
  status          TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired')),
  paid_by_user_id UUID    REFERENCES users(id) ON DELETE SET NULL,
  paid_by_name    TEXT,
  order_id        UUID    REFERENCES orders(id) ON DELETE SET NULL,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '24 hours',
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── Index ──────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_wallets_user   ON user_wallets(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_wallets_card ON user_wallets(card_number);
CREATE INDEX IF NOT EXISTS idx_uwt_wallet          ON user_wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_uwt_user            ON user_wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_uwt_type            ON user_wallet_transactions(type);
CREATE INDEX IF NOT EXISTS idx_uwt_created         ON user_wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_carts_token  ON shared_carts(token);
CREATE INDEX IF NOT EXISTS idx_shared_carts_owner  ON shared_carts(owner_id);
CREATE INDEX IF NOT EXISTS idx_shared_carts_status ON shared_carts(status);

-- ── RLS (backend utilise service role → bypass RLS, mais on l'active) ─────────
ALTER TABLE user_wallets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_wallet        ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_carts             ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service manage user_wallets"   ON user_wallets             FOR ALL USING (true);
CREATE POLICY "Service manage uwt"            ON user_wallet_transactions FOR ALL USING (true);
CREATE POLICY "Service manage commission"     ON commission_wallet        FOR ALL USING (true);
CREATE POLICY "Service manage shared_carts"   ON shared_carts             FOR ALL USING (true);

-- ════════════════════════════════════════════════════════════════════════════
-- FUNCTION 1 : Transfert wallet-à-wallet (atomique, anti-race-condition)
-- Frais : 1% sur le montant, prélevé en plus chez l'envoyeur → commission_wallet
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION user_wallet_transfer(
  p_from_wallet_id UUID,
  p_to_wallet_id   UUID,
  p_amount         DECIMAL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_from_balance  DECIMAL;
  v_to_balance    DECIMAL;
  v_from_user_id  UUID;
  v_to_user_id    UUID;
  v_from_name     TEXT;
  v_to_name       TEXT;
  v_fee           DECIMAL;
  v_total_debit   DECIMAL;
BEGIN
  IF p_from_wallet_id = p_to_wallet_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'SELF_TRANSFER_FORBIDDEN');
  END IF;

  -- Verrous en ordre croissant pour éviter les deadlocks
  IF p_from_wallet_id < p_to_wallet_id THEN
    SELECT w.balance, w.user_id, u.name
      INTO v_from_balance, v_from_user_id, v_from_name
      FROM user_wallets w JOIN users u ON u.id = w.user_id
     WHERE w.id = p_from_wallet_id FOR UPDATE;

    SELECT w.balance, w.user_id, u.name
      INTO v_to_balance, v_to_user_id, v_to_name
      FROM user_wallets w JOIN users u ON u.id = w.user_id
     WHERE w.id = p_to_wallet_id FOR UPDATE;
  ELSE
    SELECT w.balance, w.user_id, u.name
      INTO v_to_balance, v_to_user_id, v_to_name
      FROM user_wallets w JOIN users u ON u.id = w.user_id
     WHERE w.id = p_to_wallet_id FOR UPDATE;

    SELECT w.balance, w.user_id, u.name
      INTO v_from_balance, v_from_user_id, v_from_name
      FROM user_wallets w JOIN users u ON u.id = w.user_id
     WHERE w.id = p_from_wallet_id FOR UPDATE;
  END IF;

  v_fee        := GREATEST(ROUND(p_amount * 0.01, 0), 1); -- min 1 FCFA
  v_total_debit := p_amount + v_fee;

  IF v_from_balance < v_total_debit THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'INSUFFICIENT_BALANCE',
      'required', v_total_debit, 'available', v_from_balance
    );
  END IF;

  -- Débit envoyeur (montant + frais)
  UPDATE user_wallets SET balance = balance - v_total_debit, updated_at = now()
   WHERE id = p_from_wallet_id;

  -- Crédit receveur (montant brut)
  UPDATE user_wallets SET balance = balance + p_amount, updated_at = now()
   WHERE id = p_to_wallet_id;

  -- Frais → commission_wallet
  UPDATE commission_wallet
     SET balance = balance + v_fee,
         total_fees_collected = total_fees_collected + v_fee,
         updated_at = now();

  -- Log sortant
  INSERT INTO user_wallet_transactions
    (wallet_id, user_id, type, amount, fee_amount, balance_before, balance_after,
     related_wallet_id, related_user_name, description)
  VALUES
    (p_from_wallet_id, v_from_user_id, 'transfer_out', p_amount, v_fee,
     v_from_balance, v_from_balance - v_total_debit,
     p_to_wallet_id, v_to_name, 'Transfert envoyé à ' || v_to_name);

  -- Log entrant
  INSERT INTO user_wallet_transactions
    (wallet_id, user_id, type, amount, fee_amount, balance_before, balance_after,
     related_wallet_id, related_user_name, description)
  VALUES
    (p_to_wallet_id, v_to_user_id, 'transfer_in', p_amount, 0,
     v_to_balance, v_to_balance + p_amount,
     p_from_wallet_id, v_from_name, 'Transfert reçu de ' || v_from_name);

  RETURN jsonb_build_object(
    'success', true, 'amount', p_amount, 'fee', v_fee,
    'new_balance', v_from_balance - v_total_debit
  );
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- FUNCTION 2 : Retrait vers Mobile Money (atomique)
-- Frais : 2% prélevés sur le montant retiré → commission_wallet
-- L'utilisateur reçoit : montant - 2%
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION user_wallet_withdraw(
  p_wallet_id UUID,
  p_amount    DECIMAL,
  p_phone     TEXT,
  p_reference TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance  DECIMAL;
  v_user_id  UUID;
  v_fee      DECIMAL;
  v_net      DECIMAL;
BEGIN
  SELECT balance, user_id INTO v_balance, v_user_id
    FROM user_wallets WHERE id = p_wallet_id FOR UPDATE;

  v_fee := GREATEST(ROUND(p_amount * 0.02, 0), 1);
  v_net := p_amount - v_fee;

  IF v_balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'INSUFFICIENT_BALANCE',
      'required', p_amount, 'available', v_balance
    );
  END IF;

  UPDATE user_wallets SET balance = balance - p_amount, updated_at = now()
   WHERE id = p_wallet_id;

  UPDATE commission_wallet
     SET balance = balance + v_fee,
         total_fees_collected = total_fees_collected + v_fee,
         updated_at = now();

  INSERT INTO user_wallet_transactions
    (wallet_id, user_id, type, amount, fee_amount,
     balance_before, balance_after, reference, description, metadata)
  VALUES
    (p_wallet_id, v_user_id, 'withdrawal', p_amount, v_fee,
     v_balance, v_balance - p_amount, p_reference,
     'Retrait Mobile Money',
     jsonb_build_object('phone', p_phone, 'net_amount', v_net));

  RETURN jsonb_build_object(
    'success', true, 'amount', p_amount, 'fee', v_fee,
    'net_sent', v_net, 'new_balance', v_balance - p_amount
  );
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- FUNCTION 3 : Paiement commande avec wallet (atomique)
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION user_wallet_pay_order(
  p_wallet_id UUID,
  p_amount    DECIMAL,
  p_order_id  UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance DECIMAL;
  v_user_id UUID;
BEGIN
  SELECT balance, user_id INTO v_balance, v_user_id
    FROM user_wallets WHERE id = p_wallet_id FOR UPDATE;

  IF v_balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'INSUFFICIENT_BALANCE',
      'required', p_amount, 'available', v_balance,
      'missing',  p_amount - v_balance
    );
  END IF;

  UPDATE user_wallets SET balance = balance - p_amount, updated_at = now()
   WHERE id = p_wallet_id;

  INSERT INTO user_wallet_transactions
    (wallet_id, user_id, type, amount, fee_amount,
     balance_before, balance_after, order_id, description)
  VALUES
    (p_wallet_id, v_user_id, 'payment', p_amount, 0,
     v_balance, v_balance - p_amount, p_order_id, 'Paiement commande');

  RETURN jsonb_build_object(
    'success', true, 'amount', p_amount, 'new_balance', v_balance - p_amount
  );
END;
$$;
