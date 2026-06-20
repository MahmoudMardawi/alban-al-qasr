-- ===== 0012_allow_admin_sell.sql =====
-- Admin should also be able to record visits/sales (not just employees).
-- Original 0003 policy restricted INSERT to is_employee() only — admins got
-- 'permission denied for table visits' if they tried to use the /visit/new form.
-- Other tables (visit_lines, payments) already grant admin via existing policies.

DROP POLICY IF EXISTS visits_emp_insert ON visits;
DROP POLICY IF EXISTS visits_insert     ON visits;

CREATE POLICY visits_insert ON visits FOR INSERT WITH CHECK (
  (is_employee() OR is_admin()) AND employee_id = auth.uid()
);
