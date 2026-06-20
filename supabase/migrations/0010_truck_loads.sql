-- ===== 0010_truck_loads.sql =====
-- Track what the delivery employee loaded into the truck each morning, and what
-- came back at end of day. Enables reconciliation:
--   loaded - sold (via visits) - returned = shortage/leftover
-- That number is the only honest way to catch theft, breakage, or unrecorded
-- sales for a route-based dairy distribution business.

CREATE TABLE truck_loads (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES users(id),
  loaded_at    DATE NOT NULL DEFAULT CURRENT_DATE,
  closed_at    TIMESTAMPTZ,
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE truck_load_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id      UUID NOT NULL REFERENCES truck_loads(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES products(id),
  qty_loaded   NUMERIC(10,2) NOT NULL CHECK (qty_loaded >= 0),
  qty_returned NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (qty_returned >= 0),
  note         TEXT,
  UNIQUE (load_id, product_id)
);

CREATE INDEX idx_truck_loads_employee_date ON truck_loads (employee_id, loaded_at DESC);
CREATE INDEX idx_truck_load_items_load     ON truck_load_items (load_id);

-- Only one OPEN load per employee per day; previous days can stay open
-- (in case end-of-day closeout was skipped) but you can't double-load today.
CREATE UNIQUE INDEX idx_one_open_load_per_employee_per_day
  ON truck_loads (employee_id, loaded_at)
  WHERE status = 'open';

-- ===== RLS =====
ALTER TABLE truck_loads      ENABLE ROW LEVEL SECURITY;
ALTER TABLE truck_load_items ENABLE ROW LEVEL SECURITY;

-- Employees see + manage only their own loads. Admins see + manage all.
CREATE POLICY truck_loads_owner_or_admin ON truck_loads FOR ALL
  USING      (is_admin() OR (is_employee() AND employee_id = auth.uid()))
  WITH CHECK (is_admin() OR (is_employee() AND employee_id = auth.uid()));

-- Items inherit through their parent load.
CREATE POLICY truck_load_items_via_load ON truck_load_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM truck_loads l
    WHERE l.id = load_id AND (is_admin() OR l.employee_id = auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM truck_loads l
    WHERE l.id = load_id AND (is_admin() OR l.employee_id = auth.uid())
  ));
