-- Migration 022 : Fix wallet_id NOT NULL on user_wallet_transactions
--
-- PROBLÈME : user_wallet_transactions.wallet_id est NOT NULL mais lors de
-- l'activation du wallet, la transaction "pending" est créée AVANT que le
-- wallet n'existe. On ne peut donc pas fournir de wallet_id à ce stade.
--
-- SOLUTION : Rendre wallet_id nullable (la contrainte FK est conservée —
-- quand la valeur n'est pas NULL elle doit référencer user_wallets(id)).
-- Les transactions complètes (topup, payment, etc.) continuent à avoir
-- un wallet_id non-null rempli par la logique applicative.

ALTER TABLE user_wallet_transactions
  ALTER COLUMN wallet_id DROP NOT NULL;

-- Vérification : les lignes existantes ne sont pas affectées
-- (toutes ont déjà un wallet_id valide).
