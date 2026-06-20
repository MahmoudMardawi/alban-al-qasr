-- ===== 0009_payments_visit_link.sql =====
-- Link payments to the specific visit they paid for (when applicable).
--   • visit_id is nullable: a payment can be a "later debt clearing" with no visit attached.
--   • When a visit is deleted, the FK becomes NULL (we keep the payment record for the books).
-- Enables: receipt page can show "paid X of Y", accountant report can distinguish
-- cash-at-delivery from later cash drops.

ALTER TABLE payments ADD COLUMN IF NOT EXISTS visit_id UUID REFERENCES visits(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_visit ON payments(visit_id) WHERE visit_id IS NOT NULL;

-- Employees need to record payment-at-delivery for their own visits, and read
-- those payments back when viewing the receipt. Original 0003 only allowed admin.
DROP POLICY IF EXISTS payments_emp_insert_own_visit ON payments;
CREATE POLICY payments_emp_insert_own_visit ON payments FOR INSERT WITH CHECK (
  is_employee()
  AND visit_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM visits v WHERE v.id = visit_id AND v.employee_id = auth.uid())
);

DROP POLICY IF EXISTS payments_emp_read_own_visit ON payments;
CREATE POLICY payments_emp_read_own_visit ON payments FOR SELECT USING (
  is_admin()
  OR (is_employee()
      AND visit_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM visits v WHERE v.id = visit_id AND v.employee_id = auth.uid()))
);
