-- ============================================================
-- DASH MEAL — Migration 003 : Fonction generate_branch_slots
-- Génère les créneaux Click & Collect pour une agence et une date
-- Compatible avec le nouveau format opening_hours.days (par jour)
-- ============================================================

-- ─── SUPPRESSION DE L'ANCIENNE VERSION (si elle existe) ──────────────────────
DROP FUNCTION IF EXISTS generate_branch_slots(UUID, DATE);

-- ─── FONCTION PRINCIPALE ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_branch_slots(
  p_branch_id UUID,
  p_date      DATE
)
RETURNS SETOF time_slots
LANGUAGE plpgsql
AS $$
DECLARE
  v_branch          RECORD;
  v_opening_hours   JSONB;
  v_day_name        TEXT;
  v_day_schedule    JSONB;
  v_slot_duration   INT;
  v_slot_capacity   INT;
  v_open_time       TIME;
  v_close_time      TIME;
  v_current_time    TIME;
  v_end_time        TIME;
  v_new_slot        time_slots;
BEGIN
  -- Récupérer l'agence et ses horaires d'ouverture
  SELECT * INTO v_branch
  FROM branches
  WHERE id = p_branch_id AND is_active = TRUE;

  IF NOT FOUND THEN
    RETURN; -- Agence introuvable ou inactive
  END IF;

  v_opening_hours := v_branch.opening_hours;

  IF v_opening_hours IS NULL THEN
    RETURN; -- Pas d'horaires configurés
  END IF;

  -- Déterminer le nom du jour en anglais (minuscules) selon la date
  v_day_name := LOWER(TO_CHAR(p_date, 'Day'));
  -- TO_CHAR avec 'Day' produit ex: "Monday  " → trim
  v_day_name := TRIM(v_day_name);

  -- Paramètres globaux (avec valeurs par défaut)
  v_slot_duration := COALESCE((v_opening_hours->>'slot_duration')::INT, 30);
  v_slot_capacity := COALESCE((v_opening_hours->>'slot_capacity')::INT, 5);

  -- ── Nouveau format : opening_hours.days.{monday,tuesday,...} ─────────────────
  IF v_opening_hours ? 'days' THEN
    v_day_schedule := v_opening_hours->'days'->v_day_name;

    -- Vérifier que le jour est activé
    IF v_day_schedule IS NULL OR NOT (v_day_schedule->>'enabled')::BOOLEAN THEN
      RETURN; -- Jour fermé
    END IF;

    v_open_time  := (v_day_schedule->>'open')::TIME;
    v_close_time := (v_day_schedule->>'close')::TIME;

  -- ── Ancien format plat : opening_hours.open / opening_hours.close ─────────────
  ELSIF v_opening_hours ? 'open' THEN
    v_open_time  := (v_opening_hours->>'open')::TIME;
    v_close_time := (v_opening_hours->>'close')::TIME;

  ELSE
    RETURN; -- Format non reconnu
  END IF;

  -- Générer les créneaux entre v_open_time et v_close_time
  v_current_time := v_open_time;
  WHILE v_current_time + (v_slot_duration || ' minutes')::INTERVAL <= v_close_time LOOP
    v_end_time := v_current_time + (v_slot_duration || ' minutes')::INTERVAL;

    -- Insérer le créneau (ignorer si déjà existant)
    INSERT INTO time_slots (branch_id, date, start_time, end_time, capacity, booked)
    VALUES (p_branch_id, p_date, v_current_time, v_end_time, v_slot_capacity, 0)
    ON CONFLICT (branch_id, date, start_time) DO NOTHING
    RETURNING * INTO v_new_slot;

    IF FOUND THEN
      RETURN NEXT v_new_slot;
    END IF;

    v_current_time := v_end_time;
  END LOOP;

  RETURN;
END;
$$;

-- ─── INDEX UNIQUE SUR TIME_SLOTS POUR ON CONFLICT ─────────────────────────────
-- Requis pour que ON CONFLICT (branch_id, date, start_time) fonctionne
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_time_slots_branch_date_start'
  ) THEN
    ALTER TABLE time_slots
      ADD CONSTRAINT uq_time_slots_branch_date_start
      UNIQUE (branch_id, date, start_time);
  END IF;
END $$;

-- ─── COMMENTAIRE ──────────────────────────────────────────────────────────────
COMMENT ON FUNCTION generate_branch_slots(UUID, DATE) IS
  'Génère les créneaux Click & Collect pour une agence et une date donnée.
   Compatible avec opening_hours.days (format hebdomadaire) et l''ancien format plat.
   Retourne les créneaux insérés (les existants sont ignorés via ON CONFLICT).';
