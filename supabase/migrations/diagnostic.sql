-- Exécute ce diagnostic dans Supabase SQL Editor pour voir ce qui manque
SELECT name, exists FROM (
  VALUES
    ('TABLE: ads',                    (SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'ads' AND table_schema = 'public'))),
    ('TABLE: ad_impressions',         (SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'ad_impressions' AND table_schema = 'public'))),
    ('TABLE: ad_payment_intents',     (SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'ad_payment_intents' AND table_schema = 'public'))),
    ('TABLE: platform_wallet',        (SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'platform_wallet' AND table_schema = 'public'))),
    ('FUNC: get_ad_for_user',         (SELECT EXISTS(SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_ad_for_user' AND routine_schema = 'public'))),
    ('FUNC: record_ad_impression',    (SELECT EXISTS(SELECT 1 FROM information_schema.routines WHERE routine_name = 'record_ad_impression' AND routine_schema = 'public'))),
    ('FUNC: credit_platform_wallet_for_ad', (SELECT EXISTS(SELECT 1 FROM information_schema.routines WHERE routine_name = 'credit_platform_wallet_for_ad' AND routine_schema = 'public'))),
    ('FUNC: process_platform_withdrawal',   (SELECT EXISTS(SELECT 1 FROM information_schema.routines WHERE routine_name = 'process_platform_withdrawal' AND routine_schema = 'public'))),
    ('COL: platform_wallet_transactions.campay_reference', (SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'platform_wallet_transactions' AND column_name = 'campay_reference')))
) AS t(name, exists)
ORDER BY exists ASC, name;
