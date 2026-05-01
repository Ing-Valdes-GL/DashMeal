CREATE OR REPLACE FUNCTION get_ad_for_user(p_user_id UUID)
RETURNS TABLE (id UUID, title TEXT, image_url TEXT, brand_name TEXT)
LANGUAGE sql STABLE AS $func$
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
  LIMIT  1
$func$;
