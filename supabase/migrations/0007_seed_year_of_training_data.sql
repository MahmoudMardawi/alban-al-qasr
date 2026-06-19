-- ===== 0007_seed_year_of_training_data.sql =====
-- Inserts 1 year of realistic dummy data so Majdi can train on a non-empty app:
--   • 5 training clients (different types, varied addresses)
--   • ~700 visits across the year (random ~35%/day/client)
--   • Mixed line items: ~78% sales, ~13% returns, ~9% replacements
--   • ~150 expenses across all categories
--   • ~1000 production entries (one per product per day at ~85%)
--   • ~60 payments (random partials)
--
-- Idempotent: detects the sentinel client name and skips if already seeded.
-- All names start with "محل التدريب " — easy to identify and clean later if needed.

DO $$
DECLARE
  v_majdi_id        UUID;
  v_emp_id          UUID;
  v_laban_id        UUID;
  v_labneh_id       UUID;
  v_cheese_id       UUID;
  v_yogurt_carton_id UUID;
  v_client_ids      UUID[];
  v_visit_id        UUID;
  v_client_id       UUID;
  v_visit_date      DATE;
  v_idx             INT;
  v_total_visits    INT := 0;
  v_product_id      UUID;
  v_qty             NUMERIC;
  v_line_type       INT;
  v_lines_per_visit INT;
BEGIN
  -- Resolve seed user IDs (from 0004_seed_dev.sql)
  SELECT id INTO v_majdi_id FROM users WHERE email = 'majdi@alqasr.test';
  SELECT id INTO v_emp_id   FROM users WHERE email = 'emp@alqasr.test';
  IF v_majdi_id IS NULL THEN
    RAISE EXCEPTION 'Seed user majdi@alqasr.test not found. Apply 0004_seed_dev first.';
  END IF;
  IF v_emp_id IS NULL THEN
    RAISE EXCEPTION 'Seed user emp@alqasr.test not found.';
  END IF;

  -- Resolve product IDs
  SELECT id INTO v_laban_id         FROM products WHERE name_ar = 'لبن';
  SELECT id INTO v_labneh_id        FROM products WHERE name_ar = 'لبنة';
  SELECT id INTO v_cheese_id        FROM products WHERE name_ar = 'جبنة بيضاء';
  SELECT id INTO v_yogurt_carton_id FROM product_packages WHERE package_name = 'كرتونة (24 لتر)';

  IF v_laban_id IS NULL OR v_labneh_id IS NULL OR v_cheese_id IS NULL THEN
    RAISE EXCEPTION 'Seed products not found. Apply 0004_seed_dev first.';
  END IF;

  -- Idempotency check
  IF EXISTS (SELECT 1 FROM clients WHERE name LIKE 'محل التدريب %') THEN
    RAISE NOTICE 'Training data already seeded — skipping.';
    RETURN;
  END IF;

  -- Insert 5 training clients, capture their IDs
  WITH inserted AS (
    INSERT INTO clients (name, type, phone, address, notes, added_by, is_approved)
    VALUES
      ('محل التدريب 1 — سوبر ماركت الفجر',     'supermarket', '0599100001', 'عرّابة، الشارع الرئيسي',    'بيانات تدريب — يمكن حذفها لاحقاً', v_majdi_id, true),
      ('محل التدريب 2 — بقالة أبو سامي',          'market',      '0599100002', 'عرّابة، الحارة الشرقية',     'بيانات تدريب', v_majdi_id, true),
      ('محل التدريب 3 — جمعية النور التعاونية',   'market',      '0599100003', 'جنين، شارع المدينة',          'بيانات تدريب', v_majdi_id, true),
      ('محل التدريب 4 — مطعم البلدة',             'individual',  '0599100004', 'عرّابة، قرب المسجد الكبير',  'بيانات تدريب', v_majdi_id, true),
      ('محل التدريب 5 — كافتيريا الجامعة',       'individual',  '0599100005', 'جنين، جامعة العلوم',           'بيانات تدريب', v_majdi_id, true)
    RETURNING id
  )
  SELECT array_agg(id ORDER BY id) INTO v_client_ids FROM inserted;

  RAISE NOTICE 'Created % training clients', array_length(v_client_ids, 1);

  -- Generate visits across the past year
  FOR v_visit_date IN
    SELECT day::date FROM generate_series((CURRENT_DATE - 365)::date, CURRENT_DATE, '1 day'::interval) AS day
  LOOP
    FOR v_idx IN 1..array_length(v_client_ids, 1) LOOP
      -- ~35% chance of visit per client per day
      IF random() < 0.35 THEN
        v_client_id := v_client_ids[v_idx];

        INSERT INTO visits (client_id, employee_id, visited_at)
        VALUES (v_client_id, v_emp_id, v_visit_date + INTERVAL '8 hours' + (random() * INTERVAL '8 hours'))
        RETURNING id INTO v_visit_id;

        v_total_visits := v_total_visits + 1;
        v_lines_per_visit := 1 + floor(random() * 3)::int;  -- 1-4 lines

        FOR i IN 1..v_lines_per_visit LOOP
          v_product_id := CASE floor(random() * 3)::int
            WHEN 0 THEN v_laban_id
            WHEN 1 THEN v_labneh_id
            ELSE v_cheese_id
          END;

          v_line_type := floor(random() * 100)::int;

          IF v_line_type < 78 THEN
            -- SALE (78%)
            IF v_product_id = v_laban_id THEN
              IF random() < 0.25 THEN
                -- Yogurt by carton
                v_qty := 1 + floor(random() * 2)::int;
                INSERT INTO visit_lines (visit_id, product_id, package_id, qty, base_qty, unit_price, line_type)
                VALUES (v_visit_id, v_laban_id, v_yogurt_carton_id, v_qty, v_qty * 24, 110, 'sale');
              ELSE
                v_qty := 3 + floor(random() * 10)::int;
                INSERT INTO visit_lines (visit_id, product_id, qty, base_qty, unit_price, line_type)
                VALUES (v_visit_id, v_laban_id, v_qty, v_qty, 5, 'sale');
              END IF;
            ELSIF v_product_id = v_labneh_id THEN
              v_qty := 0.5 + floor(random() * 6)::int * 0.5;
              INSERT INTO visit_lines (visit_id, product_id, qty, base_qty, unit_price, line_type)
              VALUES (v_visit_id, v_labneh_id, v_qty, v_qty, 18, 'sale');
            ELSE
              v_qty := 0.25 + floor(random() * 5)::int * 0.25;
              INSERT INTO visit_lines (visit_id, product_id, qty, base_qty, unit_price, line_type)
              VALUES (v_visit_id, v_cheese_id, v_qty, v_qty, 25, 'sale');
            END IF;
          ELSIF v_line_type < 91 THEN
            -- RETURN (13%)
            v_qty := CASE
              WHEN v_product_id = v_laban_id THEN (1 + floor(random() * 3)::int)::numeric
              WHEN v_product_id = v_labneh_id THEN 0.5 + floor(random() * 3)::int * 0.5
              ELSE 0.25 + floor(random() * 2)::int * 0.25
            END;
            INSERT INTO visit_lines (visit_id, product_id, qty, base_qty, line_type, note)
            VALUES (v_visit_id, v_product_id, v_qty, v_qty, 'return_in', 'تالف/منتهي');
          ELSE
            -- REPLACEMENT (9%)
            v_qty := CASE
              WHEN v_product_id = v_laban_id THEN (1 + floor(random() * 2)::int)::numeric
              ELSE 0.5 + floor(random() * 2)::int * 0.5
            END;
            INSERT INTO visit_lines (visit_id, product_id, qty, base_qty, line_type, note)
            VALUES (v_visit_id, v_product_id, v_qty, v_qty, 'replacement_out', 'بدل لمرتجع سابق');
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Created % visits with line items', v_total_visits;

  -- ===== Expenses: ~3 per week (every 2 days, 70% chance) =====
  INSERT INTO expenses (category, amount, spent_at, note, recorded_by)
  SELECT
    CASE floor(random() * 5)::int
      WHEN 0 THEN 'fuel'
      WHEN 1 THEN 'milk'
      WHEN 2 THEN 'salary'
      WHEN 3 THEN 'rent'
      ELSE 'other'
    END,
    CASE floor(random() * 5)::int
      WHEN 0 THEN (100 + floor(random() * 200)::int)::numeric
      WHEN 1 THEN (200 + floor(random() * 500)::int)::numeric
      WHEN 2 THEN 1500
      WHEN 3 THEN 800
      ELSE (50 + floor(random() * 250)::int)::numeric
    END,
    day::timestamp + INTERVAL '8 hours' + (random() * INTERVAL '8 hours'),
    'بيانات تدريب',
    v_majdi_id
  FROM generate_series((CURRENT_DATE - 365)::date, CURRENT_DATE, '2 days'::interval) AS day
  WHERE random() < 0.7;

  -- ===== Production: one per product per day at ~85% chance =====
  INSERT INTO production (product_id, qty_produced, qty_wasted, produced_at, note, recorded_by)
  SELECT
    p.id,
    CASE
      WHEN p.name_ar = 'لبن'  THEN (50 + floor(random() * 80)::int)::numeric
      WHEN p.name_ar = 'لبنة' THEN (10 + floor(random() * 20)::int)::numeric
      ELSE (5 + floor(random() * 15)::int)::numeric
    END,
    floor(random() * 4)::int,  -- 0-3 waste
    day::timestamp + INTERVAL '6 hours',
    'بيانات تدريب',
    v_majdi_id
  FROM products p
  CROSS JOIN generate_series((CURRENT_DATE - 365)::date, CURRENT_DATE, '1 day'::interval) AS day
  WHERE p.is_active = true AND random() < 0.85;

  -- ===== Payments: random partials every 4 days, 60% chance =====
  INSERT INTO payments (client_id, amount, paid_at, method, recorded_by, note)
  SELECT
    v_client_ids[1 + floor(random() * array_length(v_client_ids, 1))::int],
    100 + floor(random() * 600)::int,
    day::timestamp + INTERVAL '8 hours' + (random() * INTERVAL '8 hours'),
    CASE WHEN random() < 0.85 THEN 'cash' ELSE 'transfer' END,
    v_majdi_id,
    'بيانات تدريب'
  FROM generate_series((CURRENT_DATE - 365)::date, CURRENT_DATE, '4 days'::interval) AS day
  WHERE random() < 0.6;

  RAISE NOTICE 'Seed complete. To remove training data later, see comment block at top of this file.';
END $$;

-- =====================================================================
-- TO REMOVE TRAINING DATA LATER:
-- =====================================================================
-- BEGIN;
--   DELETE FROM visit_lines WHERE visit_id IN (
--     SELECT id FROM visits WHERE client_id IN (
--       SELECT id FROM clients WHERE name LIKE 'محل التدريب %'
--     )
--   );
--   DELETE FROM visits WHERE client_id IN (
--     SELECT id FROM clients WHERE name LIKE 'محل التدريب %'
--   );
--   DELETE FROM payments WHERE client_id IN (
--     SELECT id FROM clients WHERE name LIKE 'محل التدريب %'
--   );
--   DELETE FROM clients WHERE name LIKE 'محل التدريب %';
--   DELETE FROM expenses    WHERE note = 'بيانات تدريب';
--   DELETE FROM production  WHERE note = 'بيانات تدريب';
--   DELETE FROM activity_log WHERE summary_ar LIKE '%بيانات تدريب%';
-- COMMIT;
-- =====================================================================
