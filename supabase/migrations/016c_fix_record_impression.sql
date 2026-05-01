CREATE OR REPLACE FUNCTION record_ad_impression(p_ad_id UUID, p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $func$
BEGIN
  INSERT INTO ad_impressions (ad_id, user_id)
  VALUES (p_ad_id, p_user_id)
  ON CONFLICT (ad_id, user_id) DO NOTHING;

  UPDATE ads
  SET impressions_count = impressions_count + 1,
      status = CASE
        WHEN impressions_count + 1 >= target_count THEN 'expired'::ad_status
        ELSE status
      END
  WHERE id = p_ad_id;
END;
$func$;
