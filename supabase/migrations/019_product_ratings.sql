-- 019 : Product ratings + avg_rating / ratings_count denormalized columns

-- ── Products: add rating stats ─────────────────────────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS avg_rating    DECIMAL(3,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ratings_count INTEGER      DEFAULT 0;

-- ── Branches: add rating stats ─────────────────────────────────────────────
ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS avg_rating    DECIMAL(3,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ratings_count INTEGER      DEFAULT 0;

-- ── product_ratings table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_ratings (
  id          UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID     NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id     UUID     NOT NULL,
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (product_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_product_ratings_product ON product_ratings(product_id);
CREATE INDEX IF NOT EXISTS idx_product_ratings_user    ON product_ratings(user_id);

ALTER TABLE product_ratings ENABLE ROW LEVEL SECURITY;

-- Backend uses service role (bypasses RLS); open read for analytics
DROP POLICY IF EXISTS "Public read ratings"   ON product_ratings;
DROP POLICY IF EXISTS "Service write ratings" ON product_ratings;

CREATE POLICY "Public read ratings"   ON product_ratings FOR SELECT USING (true);
CREATE POLICY "Service write ratings" ON product_ratings FOR ALL   USING (true);

-- ── Trigger: keep avg_rating + ratings_count up to date ────────────────────
CREATE OR REPLACE FUNCTION refresh_product_rating_stats()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_pid UUID;
BEGIN
  v_pid := COALESCE(NEW.product_id, OLD.product_id);
  UPDATE products
  SET
    avg_rating    = COALESCE((
      SELECT ROUND(AVG(rating::DECIMAL), 2)
      FROM   product_ratings
      WHERE  product_id = v_pid
    ), 0),
    ratings_count = (
      SELECT COUNT(*)
      FROM   product_ratings
      WHERE  product_id = v_pid
    )
  WHERE id = v_pid;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_product_rating_stats ON product_ratings;
CREATE TRIGGER trg_refresh_product_rating_stats
AFTER INSERT OR UPDATE OR DELETE ON product_ratings
FOR EACH ROW EXECUTE FUNCTION refresh_product_rating_stats();
