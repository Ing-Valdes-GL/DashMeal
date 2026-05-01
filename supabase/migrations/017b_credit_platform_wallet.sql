CREATE OR REPLACE FUNCTION credit_platform_wallet_for_ad(
  p_amount      NUMERIC,
  p_brand_id    UUID,
  p_description TEXT
) RETURNS VOID LANGUAGE plpgsql AS $func$
BEGIN
  UPDATE platform_wallet
  SET    balance        = balance + p_amount,
         total_received = total_received + p_amount;

  INSERT INTO platform_wallet_transactions
    (type, amount, balance_after, description, brand_id)
  SELECT 'ad_payment', p_amount, balance, p_description, p_brand_id
  FROM   platform_wallet
  LIMIT  1;
END;
$func$;
