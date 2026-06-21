-- ===== 0015_employee_expense_insert.sql =====
-- Allow employees to record an expense for themselves (e.g., meal allowance,
-- fuel money taken from their cash drawer). Originally 0003 restricted
-- expenses to admin only. This relaxes INSERT/SELECT for the employee's own
-- entries; UPDATE/DELETE stay admin-only.

DROP POLICY IF EXISTS expenses_emp_insert_own ON expenses;
CREATE POLICY expenses_emp_insert_own ON expenses FOR INSERT WITH CHECK (
  is_employee() AND recorded_by = auth.uid()
);

DROP POLICY IF EXISTS expenses_emp_read_own ON expenses;
CREATE POLICY expenses_emp_read_own ON expenses FOR SELECT USING (
  is_admin() OR (is_employee() AND recorded_by = auth.uid())
);
