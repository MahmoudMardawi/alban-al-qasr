-- ===== 0002_views_and_user_sync.sql =====

-- Money ledger: per client, total sales minus total payments.
CREATE VIEW v_client_money_balance AS
  SELECT v.client_id,
         COALESCE(SUM(vl.qty * vl.unit_price) FILTER (WHERE vl.line_type = 'sale'), 0)
         - COALESCE(
             (SELECT SUM(amount) FROM payments p WHERE p.client_id = v.client_id),
             0
           ) AS balance
  FROM visits v
  JOIN visit_lines vl ON vl.visit_id = v.id
  GROUP BY v.client_id;

-- Replacement ledger: per (client, product), units the factory owes the shop.
-- Always in base units so cartons and singles reconcile cleanly.
CREATE VIEW v_client_replacement_debt AS
  SELECT v.client_id,
         vl.product_id,
         SUM(CASE WHEN vl.line_type = 'return_in'        THEN  vl.base_qty
                  WHEN vl.line_type = 'replacement_out' THEN -vl.base_qty
                  ELSE 0 END) AS owed_base_qty
  FROM visits v
  JOIN visit_lines vl ON vl.visit_id = v.id
  WHERE vl.line_type IN ('return_in','replacement_out')
  GROUP BY v.client_id, vl.product_id
  HAVING SUM(CASE WHEN vl.line_type = 'return_in'        THEN  vl.base_qty
                  WHEN vl.line_type = 'replacement_out' THEN -vl.base_qty
                  ELSE 0 END) > 0;

-- Trigger: when a new auth.users row is created, mirror it into public.users.
-- Default role = 'employee'; admin role must be set manually (or via seed).
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'employee')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();
