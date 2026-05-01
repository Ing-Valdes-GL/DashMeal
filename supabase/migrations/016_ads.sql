-- ─── Publicités ──────────────────────────────────────────────────────────────

CREATE TYPE ad_status AS ENUM ('pending', 'approved', 'rejected', 'active', 'expired');

CREATE TABLE ads (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id          UUID        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  title             TEXT        NOT NULL,
  image_url         TEXT        NOT NULL,
  target_count      INT         NOT NULL CHECK (target_count >= 6),
  amount_paid       NUMERIC(14,2) NOT NULL CHECK (amount_paid > 0),
  status            ad_status   NOT NULL DEFAULT 'pending',
  rejection_reason  TEXT,
  impressions_count INT         NOT NULL DEFAULT 0,
  reviewed_by       UUID        REFERENCES super_admins(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  activated_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Une ligne par (pub × utilisateur) — garantit qu'un user ne voit une pub qu'une fois
CREATE TABLE ad_impressions (
  id       UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  ad_id    UUID        NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  user_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shown_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ad_id, user_id)
);

CREATE INDEX idx_ads_brand_id ON ads(brand_id);
CREATE INDEX idx_ads_status   ON ads(status);
CREATE INDEX idx_ad_impressions_ad_id   ON ad_impressions(ad_id);
CREATE INDEX idx_ad_impressions_user_id ON ad_impressions(user_id);

-- ─── Fonction : récupérer une pub active non vue par un utilisateur ───────────
CREATE OR REPLACE FUNCTION get_ad_for_user(p_user_id UUID)
RETURNS TABLE (id UUID, title TEXT, image_url TEXT, brand_name TEXT)
LANGUAGE sql STABLE AS $$
  SELECT a.id, a.title, a.image_url, b.name AS brand_name
  FROM   ads a
  JOIN   brands b ON b.id = a.brand_id
  WHERE  a.status = 'active'
    AND  a.impressions_count < a.target_count
    AND  NOT EXISTS (
           SELECT 1 FROM ad_impressions ai
           WHERE  ai.ad_id = a.id AND ai.user_id = p_user_id
         )
  ORDER  BY a.activated_at ASC
  LIMIT  1;
$$;

-- ─── Fonction : enregistrer une impression ────────────────────────────────────
CREATE OR REPLACE FUNCTION record_ad_impression(p_ad_id UUID, p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO ad_impressions (ad_id, user_id)
  VALUES (p_ad_id, p_user_id)
  ON CONFLICT (ad_id, user_id) DO NOTHING;

  UPDATE ads
  SET    impressions_count = impressions_count + 1,
         status = CASE
           WHEN impressions_count + 1 >= target_count THEN 'expired'::ad_status
           ELSE status
         END
  WHERE  id = p_ad_id;
END;
$$;
