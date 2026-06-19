-- ===== 0003_rls.sql =====
-- Enable RLS on every public table and define the role-aware policies.

-- Helper: returns current authed user's role (or NULL if not logged in)
CREATE OR REPLACE FUNCTION auth_role() RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
  SELECT auth_role() = 'admin';
$$;

CREATE OR REPLACE FUNCTION is_employee() RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
  SELECT auth_role() = 'employee';
$$;

-- ===== USERS =====
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_self_read   ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY users_admin_all   ON users FOR ALL    USING (is_admin()) WITH CHECK (is_admin());

-- ===== CLIENTS =====
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY clients_read_all    ON clients FOR SELECT USING (is_admin() OR is_employee());
CREATE POLICY clients_emp_insert  ON clients FOR INSERT WITH CHECK (
  is_employee() AND is_approved = false AND added_by = auth.uid()
);
CREATE POLICY clients_admin_write ON clients FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ===== PRODUCTS + PACKAGES =====
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY products_read       ON products FOR SELECT USING (is_admin() OR is_employee());
CREATE POLICY products_admin      ON products FOR ALL USING (is_admin()) WITH CHECK (is_admin());

ALTER TABLE product_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY packages_read       ON product_packages FOR SELECT USING (is_admin() OR is_employee());
CREATE POLICY packages_admin      ON product_packages FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ===== VISITS =====
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY visits_emp_read_own ON visits FOR SELECT USING (
  is_admin() OR (is_employee() AND employee_id = auth.uid())
);
CREATE POLICY visits_emp_insert   ON visits FOR INSERT WITH CHECK (
  is_employee() AND employee_id = auth.uid()
);
CREATE POLICY visits_emp_update_own ON visits FOR UPDATE USING (
  (is_employee() AND employee_id = auth.uid() AND created_at > now() - interval '24 hours')
  OR is_admin()
) WITH CHECK (
  (is_employee() AND employee_id = auth.uid())
  OR is_admin()
);
CREATE POLICY visits_admin_delete ON visits FOR DELETE USING (is_admin());

-- ===== VISIT LINES (inherit visit's permissions via subquery) =====
ALTER TABLE visit_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY lines_read ON visit_lines FOR SELECT USING (
  EXISTS (SELECT 1 FROM visits v WHERE v.id = visit_lines.visit_id
          AND (is_admin() OR v.employee_id = auth.uid()))
);
CREATE POLICY lines_write ON visit_lines FOR ALL USING (
  EXISTS (SELECT 1 FROM visits v WHERE v.id = visit_lines.visit_id
          AND (is_admin() OR (v.employee_id = auth.uid()
               AND v.created_at > now() - interval '24 hours')))
) WITH CHECK (
  EXISTS (SELECT 1 FROM visits v WHERE v.id = visit_lines.visit_id
          AND (is_admin() OR v.employee_id = auth.uid()))
);

-- ===== PAYMENTS, EXPENSES, PRODUCTION (admin-only writes; employees may need read for receipts later) =====
ALTER TABLE payments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE production   ENABLE ROW LEVEL SECURITY;

CREATE POLICY payments_admin   ON payments   FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY expenses_admin   ON expenses   FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY production_admin ON production FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ===== ACTIVITY LOG =====
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY activity_admin_read   ON activity_log FOR SELECT USING (is_admin());
CREATE POLICY activity_emp_insert   ON activity_log FOR INSERT WITH CHECK (
  (is_admin() OR is_employee()) AND actor_id = auth.uid()
);
CREATE POLICY activity_admin_update ON activity_log FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

-- ===== PERIOD CLOSINGS =====
ALTER TABLE period_closings ENABLE ROW LEVEL SECURITY;
CREATE POLICY closings_admin ON period_closings FOR ALL USING (is_admin()) WITH CHECK (is_admin());
