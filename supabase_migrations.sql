-- ═══════════════════════════════════════════════════════════════════════════════
-- DASH MEAL — MIGRATION COMPLÈTE
-- Exécuter dans Supabase > SQL Editor en une seule fois
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. OTP RATE LIMITING
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.otp_rate_limits (
  phone       text PRIMARY KEY,
  attempts    int  NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz
);
ALTER TABLE public.otp_rate_limits DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. PROMOTIONS / COUPONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.promotions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  branch_id       uuid REFERENCES public.branches(id) ON DELETE SET NULL, -- null = toutes agences
  code            text NOT NULL,
  type            text NOT NULL CHECK (type IN ('percent', 'fixed')),  -- percent ou fixed (FCFA)
  value           numeric(10,2) NOT NULL,                              -- 10 = 10% ou 10 = 10 FCFA
  min_order       numeric(10,2) NOT NULL DEFAULT 0,
  max_uses        int,                                                  -- null = illimité
  uses_count      int NOT NULL DEFAULT 0,
  max_uses_per_user int NOT NULL DEFAULT 1,
  starts_at       timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz,
  is_active       boolean NOT NULL DEFAULT true,
  description     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(brand_id, code)
);

CREATE TABLE IF NOT EXISTS public.promotion_usages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  order_id     uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  discount     numeric(10,2) NOT NULL,
  used_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(promotion_id, user_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_promotions_brand_id    ON public.promotions(brand_id);
CREATE INDEX IF NOT EXISTS idx_promotions_code        ON public.promotions(code);
CREATE INDEX IF NOT EXISTS idx_promotion_usages_promo ON public.promotion_usages(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usages_user  ON public.promotion_usages(user_id);

ALTER TABLE public.promotions       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_usages DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. PROGRAMME DE FIDÉLITÉ
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.loyalty_accounts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  points     int  NOT NULL DEFAULT 0,
  total_earned  int NOT NULL DEFAULT 0,
  total_redeemed int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type         text NOT NULL CHECK (type IN ('earn', 'redeem', 'expire', 'bonus')),
  points       int  NOT NULL,              -- positif = gain, négatif = dépense
  balance_after int NOT NULL,
  order_id     uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  description  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_user ON public.loyalty_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_order ON public.loyalty_transactions(order_id);

ALTER TABLE public.loyalty_accounts      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions  DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ZONES DE LIVRAISON
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name          text NOT NULL,
  delivery_fee  numeric(10,2) NOT NULL DEFAULT 0,
  min_order     numeric(10,2) NOT NULL DEFAULT 0,
  estimated_min int  NOT NULL DEFAULT 30,  -- minutes
  polygon       jsonb NOT NULL DEFAULT '[]',  -- array de {lat, lng}
  is_active     boolean NOT NULL DEFAULT true,
  color         text DEFAULT '#f97316',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_zones_branch ON public.delivery_zones(branch_id);
ALTER TABLE public.delivery_zones DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. DRIVER KYC DOCUMENTS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS kyc_status     text NOT NULL DEFAULT 'pending'
    CHECK (kyc_status IN ('pending', 'submitted', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS kyc_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS kyc_reviewed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS kyc_reject_reason text;

CREATE TABLE IF NOT EXISTS public.driver_documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id   uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('id_card', 'driving_license', 'photo', 'other')),
  url         text NOT NULL,
  filename    text,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_documents_driver ON public.driver_documents(driver_id);
ALTER TABLE public.driver_documents DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. FAVORIS PRODUITS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.favorites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user    ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_product ON public.favorites(product_id);
ALTER TABLE public.favorites DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. COMMANDES GROUPÉES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.group_carts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  branch_id   uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  share_code  text NOT NULL UNIQUE DEFAULT upper(substring(gen_random_uuid()::text, 1, 8)),
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'locked', 'ordered', 'expired')),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '2 hours'),
  order_id    uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_cart_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_cart_id uuid NOT NULL REFERENCES public.group_carts(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_id    uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity      int  NOT NULL DEFAULT 1 CHECK (quantity > 0),
  added_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_cart_id, user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_group_carts_share_code ON public.group_carts(share_code);
CREATE INDEX IF NOT EXISTS idx_group_carts_host       ON public.group_carts(host_user_id);
CREATE INDEX IF NOT EXISTS idx_group_cart_items_cart  ON public.group_cart_items(group_cart_id);

ALTER TABLE public.group_carts       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_cart_items  DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. GPS TRACKING LIVREUR (position temps réel)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.driver_locations (
  driver_id   uuid PRIMARY KEY REFERENCES public.drivers(id) ON DELETE CASCADE,
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  heading     double precision,
  speed       double precision,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.driver_locations DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. COLONNES SUPPLÉMENTAIRES ORDERS (promotion + loyalty)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS promotion_id   uuid REFERENCES public.promotions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discount       numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_earned  int NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. PARAMÈTRES UTILISATEUR
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id           uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  language          text NOT NULL DEFAULT 'fr',
  notifications_orders  boolean NOT NULL DEFAULT true,
  notifications_promos  boolean NOT NULL DEFAULT true,
  notifications_news    boolean NOT NULL DEFAULT false,
  default_address_id    uuid,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. AVIS PRODUITS (ratings)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_reviews (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  order_id   uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  rating     int  NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, user_id, order_id)
);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS avg_rating   numeric(3,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_count int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON public.product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_user    ON public.product_reviews(user_id);
ALTER TABLE public.product_reviews DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- FIN DE MIGRATION
-- ═══════════════════════════════════════════════════════════════════════════════
