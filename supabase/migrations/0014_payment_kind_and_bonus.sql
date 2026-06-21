-- ===== 0014_payment_kind_and_bonus.sql =====
-- 1) Add 'kind' to payments to distinguish receipt vouchers (سند قبض) from
--    disbursement vouchers (سند صرف). Both share the same row shape; the
--    sign of their impact on cash and on the client's account is determined
--    by kind, not by amount (amount is always positive).
--
--    receipt      → cash IN  · client debt DOWN
--    disbursement → cash OUT · client debt UP  (refund / damage compensation)
--
-- 2) Add 'bonus' to visit_lines.line_type so reps can record free-of-charge
--    units (promotional give-away) without inflating sales totals.

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'receipt'
  CHECK (kind IN ('receipt', 'disbursement'));

CREATE INDEX IF NOT EXISTS idx_payments_kind ON payments(kind);

-- Visit lines: extend the line_type CHECK with 'bonus'
ALTER TABLE visit_lines DROP CONSTRAINT IF EXISTS visit_lines_line_type_check;
ALTER TABLE visit_lines ADD CONSTRAINT visit_lines_line_type_check
  CHECK (line_type IN ('sale', 'replacement_out', 'return_in', 'bonus'));
