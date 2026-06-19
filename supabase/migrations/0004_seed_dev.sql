-- ===== 0004_seed_dev.sql =====
-- Idempotent: safe to re-run.
-- Assumes 2 auth users already exist (majdi@alqasr.test, emp@alqasr.test)
-- and the trigger from 0002 has mirrored them into public.users.

-- Promote majdi to admin
UPDATE users
   SET role = 'admin', full_name = 'مجدي أبو جلبوش'
 WHERE email = 'majdi@alqasr.test';

-- Friendly name for the seed employee
UPDATE users
   SET full_name = 'موظف التوزيع'
 WHERE email = 'emp@alqasr.test';

-- Sample products (skip if already inserted)
INSERT INTO products (name_ar, name_en, base_unit, base_price, base_cost)
SELECT 'لبن',     'Yogurt',     'L',     5.00, 2.50
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name_ar = 'لبن');

INSERT INTO products (name_ar, name_en, base_unit, base_price, base_cost)
SELECT 'لبنة',    'Labneh',     'kg',   18.00, 9.00
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name_ar = 'لبنة');

INSERT INTO products (name_ar, name_en, base_unit, base_price, base_cost)
SELECT 'جبنة بيضاء','White Cheese','kg',   25.00, 13.00
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name_ar = 'جبنة بيضاء');

-- Sample package: carton of 24 L yogurt @ 110 ILS (bulk discount)
INSERT INTO product_packages (product_id, package_name, contains_qty, package_price)
SELECT p.id, 'كرتونة (24 لتر)', 24, 110
FROM products p
WHERE p.name_ar = 'لبن'
  AND NOT EXISTS (
    SELECT 1 FROM product_packages pp
    WHERE pp.product_id = p.id AND pp.package_name = 'كرتونة (24 لتر)'
  );

-- Sample clients (admin-added so is_approved=true)
INSERT INTO clients (name, type, phone, added_by, is_approved)
SELECT 'سوبر ماركت الأخوة', 'supermarket', '0599000001',
       (SELECT id FROM users WHERE email = 'majdi@alqasr.test'), true
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE name = 'سوبر ماركت الأخوة');

INSERT INTO clients (name, type, phone, added_by, is_approved)
SELECT 'بقالة النور', 'market', '0599000002',
       (SELECT id FROM users WHERE email = 'majdi@alqasr.test'), true
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE name = 'بقالة النور');
