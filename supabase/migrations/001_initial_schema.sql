-- ============================================================
-- DASH MEAL — Migration initiale
-- Version : 001
-- ============================================================

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── IDENTITÉS ───────────────────────────────────────────────────────────────

CREATE TABLE super_admins (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE NOT NULL,
  phone         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE admins (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username      TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  phone         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  brand_id      UUID, -- FK ajoutée après création de brands
  role          TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'superadmin')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT NOT NULL,
  phone            TEXT UNIQUE NOT NULL,
  password_hash    TEXT NOT NULL,
  is_verified      BOOLEAN NOT NULL DEFAULT FALSE,
  preferred_locale TEXT NOT NULL DEFAULT 'fr' CHECK (preferred_locale IN ('fr', 'en')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- OTP pour vérification téléphone
CREATE TABLE otp_codes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone      TEXT NOT NULL,
  code       TEXT NOT NULL,
  is_used    BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_otp_phone ON otp_codes(phone);

-- ─── STRUCTURE COMMERCIALE ───────────────────────────────────────────────────

CREATE TABLE brands (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  logo_url    TEXT,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Maintenant qu'on a brands, on peut ajouter la FK sur admins
ALTER TABLE admins
  ADD CONSTRAINT fk_admins_brand
  FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL;

CREATE TABLE branches (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id   UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  address    TEXT NOT NULL,
  city       TEXT NOT NULL DEFAULT '',
  lat        DOUBLE PRECISION NOT NULL,
  lng        DOUBLE PRECISION NOT NULL,
  phone      TEXT,
  hours      JSONB DEFAULT '{}',
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_branches_brand ON branches(brand_id);
CREATE INDEX idx_branches_location ON branches(lat, lng);

CREATE TABLE drivers (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  phone      TEXT UNIQUE NOT NULL,
  admin_id   UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  branch_id  UUID REFERENCES branches(id) ON DELETE SET NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE delivery_zones (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id       UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  polygon_coords  JSONB NOT NULL DEFAULT '[]',
  delivery_fee    INTEGER NOT NULL DEFAULT 0, -- en FCFA
  min_order       INTEGER NOT NULL DEFAULT 0, -- en FCFA
  is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

-- ─── CATALOGUE ───────────────────────────────────────────────────────────────

CREATE TABLE categories (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name_fr    TEXT NOT NULL,
  name_en    TEXT NOT NULL,
  icon       TEXT,
  parent_id  UUID REFERENCES categories(id) ON DELETE SET NULL,
  brand_id   UUID REFERENCES brands(id) ON DELETE CASCADE, -- null = global
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_categories_brand ON categories(brand_id);

CREATE TABLE products (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id       UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  category_id    UUID REFERENCES categories(id) ON DELETE SET NULL,
  name_fr        TEXT NOT NULL,
  name_en        TEXT NOT NULL,
  description_fr TEXT,
  description_en TEXT,
  price          INTEGER NOT NULL CHECK (price >= 0), -- en FCFA
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_products_brand ON products(brand_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_name ON products USING gin(to_tsvector('french', name_fr));

CREATE TABLE product_images (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE product_variants (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id     UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name_fr        TEXT NOT NULL,
  name_en        TEXT NOT NULL,
  price_modifier INTEGER NOT NULL DEFAULT 0, -- +/- sur prix de base
  is_active      BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE branch_stock (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id  UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  stock_qty  INTEGER NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (branch_id, product_id, variant_id)
);
CREATE INDEX idx_stock_branch ON branch_stock(branch_id);

-- ─── COMMANDES ───────────────────────────────────────────────────────────────

CREATE TABLE carts (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id  UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, branch_id)
);

CREATE TABLE cart_items (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id    UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity   INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0)
);

CREATE TYPE order_status AS ENUM (
  'pending', 'confirmed', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled'
);
CREATE TYPE order_type AS ENUM ('collect', 'delivery');

CREATE TABLE orders (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  branch_id    UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  type         order_type NOT NULL,
  status       order_status NOT NULL DEFAULT 'pending',
  subtotal     INTEGER NOT NULL DEFAULT 0,
  delivery_fee INTEGER NOT NULL DEFAULT 0,
  total        INTEGER NOT NULL DEFAULT 0,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_branch ON orders(branch_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

CREATE TABLE order_items (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  unit_price INTEGER NOT NULL,
  subtotal   INTEGER NOT NULL
);

CREATE TABLE order_status_history (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id       UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status         order_status NOT NULL,
  changed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by     UUID NOT NULL,
  changed_by_role TEXT NOT NULL,
  note           TEXT
);

CREATE TABLE time_slots (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id  UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time   TIME NOT NULL,
  capacity   INTEGER NOT NULL DEFAULT 10,
  booked     INTEGER NOT NULL DEFAULT 0 CHECK (booked >= 0),
  CONSTRAINT slots_booked_lte_capacity CHECK (booked <= capacity)
);
CREATE INDEX idx_slots_branch_date ON time_slots(branch_id, date);

CREATE TABLE collect_orders (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      UUID UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  slot_id       UUID NOT NULL REFERENCES time_slots(id) ON DELETE RESTRICT,
  qr_code       TEXT UNIQUE NOT NULL,
  pickup_status TEXT NOT NULL DEFAULT 'waiting' CHECK (pickup_status IN ('waiting', 'picked_up')),
  picked_up_at  TIMESTAMPTZ
);

CREATE TYPE delivery_status AS ENUM (
  'assigned', 'picked_up', 'on_the_way', 'delivered', 'failed'
);

CREATE TABLE deliveries (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id     UUID UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  driver_id    UUID REFERENCES drivers(id) ON DELETE SET NULL,
  address      TEXT NOT NULL,
  lat          DOUBLE PRECISION NOT NULL,
  lng          DOUBLE PRECISION NOT NULL,
  status       delivery_status NOT NULL DEFAULT 'assigned',
  started_at   TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

-- ─── PAIEMENT ─────────────────────────────────────────────────────────────────

CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
CREATE TYPE payment_method AS ENUM ('mobile_money', 'cash_on_delivery', 'wallet');

CREATE TABLE payments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  method       payment_method NOT NULL,
  amount       INTEGER NOT NULL,
  status       payment_status NOT NULL DEFAULT 'pending',
  provider_ref TEXT,
  provider     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_payments_order ON payments(order_id);

CREATE TABLE invoices (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id     UUID UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  pdf_url      TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── SAAS & COMMISSIONS ───────────────────────────────────────────────────────

CREATE TYPE application_status AS ENUM ('pending', 'approved', 'rejected', 'suspended');
CREATE TYPE document_type AS ENUM ('niu', 'logo', 'online_presence', 'rccm', 'other');

CREATE TABLE brand_applications (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_name       TEXT NOT NULL,
  contact_email    TEXT NOT NULL,
  contact_phone    TEXT NOT NULL,
  status           application_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  submitted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at      TIMESTAMPTZ,
  reviewed_by      UUID REFERENCES super_admins(id) ON DELETE SET NULL
);

CREATE TABLE brand_documents (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES brand_applications(id) ON DELETE CASCADE,
  type           document_type NOT NULL,
  url            TEXT NOT NULL,
  is_verified    BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TYPE commission_type AS ENUM ('online', 'inperson');

CREATE TABLE commissions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id   UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  brand_id     UUID NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  type         commission_type NOT NULL,
  rate         NUMERIC(5, 4) NOT NULL, -- ex: 0.0200 pour 2%
  amount       INTEGER NOT NULL,       -- montant en FCFA
  is_settled   BOOLEAN NOT NULL DEFAULT FALSE,
  settled_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_commissions_brand ON commissions(brand_id);
CREATE INDEX idx_commissions_settled ON commissions(is_settled);

-- ─── CHAT ────────────────────────────────────────────────────────────────────

CREATE TYPE conversation_type AS ENUM ('client_driver', 'client_support');

CREATE TABLE conversations (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  type       conversation_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, type)
);

CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL,
  sender_role     TEXT NOT NULL,
  content         TEXT NOT NULL,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at);

-- ─── EXTRAS ───────────────────────────────────────────────────────────────────

CREATE TABLE promotions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id   UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  code       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('percentage', 'fixed')),
  value      INTEGER NOT NULL,
  min_order  INTEGER,
  max_uses   INTEGER,
  uses_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (brand_id, code)
);

CREATE TABLE loyalty_points (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points     INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title_fr   TEXT NOT NULL,
  title_en   TEXT NOT NULL,
  body_fr    TEXT NOT NULL,
  body_en    TEXT NOT NULL,
  type       TEXT NOT NULL,
  data       JSONB,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notifications_user ON notifications(user_id);

CREATE TABLE reviews (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  branch_id  UUID REFERENCES branches(id) ON DELETE CASCADE,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT review_target CHECK (product_id IS NOT NULL OR branch_id IS NOT NULL)
);

CREATE TABLE activity_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id      UUID NOT NULL,
  actor_role    TEXT NOT NULL,
  action        TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id   UUID,
  metadata      JSONB,
  ip_address    INET,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_logs_actor ON activity_logs(actor_id);
CREATE INDEX idx_logs_created ON activity_logs(created_at DESC);

-- ─── FONCTIONS UTILITAIRES ───────────────────────────────────────────────────

-- Incrémenter le compteur de réservation d'un créneau
CREATE OR REPLACE FUNCTION increment_slot_booking(slot_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE time_slots
  SET booked = booked + 1
  WHERE id = slot_id AND booked < capacity;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Créneau complet ou introuvable';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─── ROW LEVEL SECURITY (RLS) ────────────────────────────────────────────────
-- Note: Le backend utilise service_role qui bypasse RLS.
-- RLS protège en cas d'accès direct à Supabase depuis le client.

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Les politiques RLS seront configurées dans le dashboard Supabase
-- ou dans des migrations séparées selon l'évolution des besoins.

-- ─── INDEXES SUPPLÉMENTAIRES ─────────────────────────────────────────────────

CREATE INDEX idx_orders_type ON orders(type);
CREATE INDEX idx_products_active ON products(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_branches_active ON branches(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_brand_applications_status ON brand_applications(status);
