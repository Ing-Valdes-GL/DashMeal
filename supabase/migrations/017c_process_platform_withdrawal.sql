CREATE OR REPLACE FUNCTION process_platform_withdrawal(
  p_amount            NUMERIC,
  p_campay_reference  TEXT,
  p_description       TEXT
) RETURNS VOID LANGUAGE plpgsql AS $func$
BEGIN
  UPDATE platform_wallet
  SET    balance = balance - p_amount
  WHERE  balance >= p_amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
  END IF;

  INSERT INTO platform_wallet_transactions
    (type, amount, balance_after, description, campay_reference)
  SELECT 'withdrawal', p_amount, balance, p_description, p_campay_reference
  FROM   platform_wallet
  LIMIT  1;
END;
$func$;
