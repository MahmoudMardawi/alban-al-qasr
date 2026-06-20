-- ===== 0011_invoice_numbers.sql =====
-- Adds a human-friendly sequential invoice number to every visit.
-- Accountants need a reference they can quote ("invoice #42 from أبو سامي was unpaid").
-- The visit's UUID is internal-only and was hidden from the printed receipt in
-- migration era 0009-era work — this fills the gap left behind.
--
-- Design:
--   * Single global counter (not per-year) — simpler, no off-by-one at year boundaries.
--   * Existing visits get backfilled in chronological order (visited_at, then created_at).
--   * NEW visits get nextval() automatically via column DEFAULT.
--   * UNIQUE constraint so it's always safe to reference.

-- 1. Sequence
CREATE SEQUENCE IF NOT EXISTS visit_invoice_seq START 1;

-- 2. Column (NULL initially so we can backfill, then make NOT NULL)
ALTER TABLE visits ADD COLUMN IF NOT EXISTS invoice_no BIGINT;

-- 3. Backfill existing visits in chronological order
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY visited_at ASC, created_at ASC) AS rn
  FROM visits
  WHERE invoice_no IS NULL
)
UPDATE visits v SET invoice_no = o.rn
FROM ordered o
WHERE v.id = o.id;

-- 4. Advance the sequence past the highest backfilled value
SELECT setval('visit_invoice_seq', GREATEST((SELECT COALESCE(MAX(invoice_no), 0) FROM visits), 1));

-- 5. Lock it down: NOT NULL + DEFAULT + UNIQUE
ALTER TABLE visits ALTER COLUMN invoice_no SET NOT NULL;
ALTER TABLE visits ALTER COLUMN invoice_no SET DEFAULT nextval('visit_invoice_seq');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'visits_invoice_no_unique'
  ) THEN
    ALTER TABLE visits ADD CONSTRAINT visits_invoice_no_unique UNIQUE (invoice_no);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_visits_invoice_no ON visits(invoice_no);
