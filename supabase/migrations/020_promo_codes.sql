-- 020 : Codes promo par agence

CREATE TABLE IF NOT EXISTS promo_codes (
  id              UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       UUID     NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  code            TEXT     NOT NULL,
  label           TEXT     DEFAULT NULL,           -- description courte affichée au client
  discount_pct    DECIMAL(5,2) NOT NULL
                  CHECK (discount_pct > 0 AND discount_pct <= 100),
  min_order_amt   INTEGER  DEFAULT 0,              -- montant minimum de commande (FCFA)
  max_uses        INTEGER  DEFAULT NULL,           -- NULL = utilisations illimitées
  used_count      INTEGER  NOT NULL DEFAULT 0,
  valid_from      TIMESTAMPTZ DEFAULT now(),
  valid_until     TIMESTAMPTZ DEFAULT NULL,        -- NULL = pas d'expiration
  is_active       BOOLEAN  NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Index classique sur branch_id
CREATE INDEX IF NOT EXISTS idx_promo_codes_branch ON promo_codes(branch_id);

-- Unicité code par agence insensible à la casse (expression → index séparé obligatoire)
CREATE UNIQUE INDEX IF NOT EXISTS idx_promo_codes_branch_code
  ON promo_codes(branch_id, LOWER(code));

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
-- Le backend utilise la clé service role (bypass RLS) → règle permissive suffisante
CREATE POLICY "Service manage promo codes" ON promo_codes FOR ALL USING (true);
