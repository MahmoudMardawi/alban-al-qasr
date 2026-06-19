-- ===== 0001_schema.sql =====
-- All tables for Alban Al-Qasr. UUIDs everywhere. Timestamps in TIMESTAMPTZ.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- USERS (mirrors auth.users.id; populated via trigger in 0002)
CREATE TABLE users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL CHECK (role IN ('admin','employee')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CLIENTS
CREATE TABLE clients (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     TEXT NOT NULL,
  type                     TEXT CHECK (type IN ('supermarket','market','individual')),
  phone                    TEXT,
  address                  TEXT,
  notes                    TEXT,
  added_by                 UUID REFERENCES users(id),
  is_approved              BOOLEAN NOT NULL DEFAULT true,
  merged_into_client_id    UUID REFERENCES clients(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clients_name           ON clients (name);
CREATE INDEX idx_clients_pending        ON clients (created_at DESC) WHERE is_approved = false;
CREATE INDEX idx_clients_not_merged     ON clients (id) WHERE merged_into_client_id IS NULL;

-- PRODUCTS
CREATE TABLE products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar     TEXT NOT NULL,
  name_en     TEXT,
  base_unit   TEXT NOT NULL CHECK (base_unit IN ('L','kg','piece')),
  base_price  NUMERIC(10,2) NOT NULL CHECK (base_price >= 0),
  base_cost   NUMERIC(10,2) CHECK (base_cost IS NULL OR base_cost >= 0),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PRODUCT PACKAGES (kartonas etc.)
CREATE TABLE product_packages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  package_name    TEXT NOT NULL,
  contains_qty    NUMERIC(10,2) NOT NULL CHECK (contains_qty > 0),
  package_price   NUMERIC(10,2) NOT NULL CHECK (package_price >= 0),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_packages_product ON product_packages (product_id);

-- VISITS
CREATE TABLE visits (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID NOT NULL REFERENCES clients(id),
  employee_id  UUID NOT NULL REFERENCES users(id),
  visited_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_visits_client    ON visits (client_id, visited_at DESC);
CREATE INDEX idx_visits_employee  ON visits (employee_id, visited_at DESC);

-- VISIT LINES (the heart of the two-ledger model)
CREATE TABLE visit_lines (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id    UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id),
  package_id  UUID REFERENCES product_packages(id),
  qty         NUMERIC(10,2) NOT NULL CHECK (qty > 0),
  base_qty    NUMERIC(10,2) NOT NULL CHECK (base_qty > 0),
  unit_price  NUMERIC(10,2),
  line_type   TEXT NOT NULL CHECK (line_type IN ('sale','replacement_out','return_in')),
  note        TEXT
);
CREATE INDEX idx_lines_visit          ON visit_lines (visit_id);
CREATE INDEX idx_lines_type_product   ON visit_lines (line_type, product_id);

-- PAYMENTS
CREATE TABLE payments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID NOT NULL REFERENCES clients(id),
  amount       NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  paid_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  method       TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash','transfer','other')),
  recorded_by  UUID REFERENCES users(id),
  note         TEXT
);
CREATE INDEX idx_payments_client ON payments (client_id, paid_at DESC);

-- EXPENSES
CREATE TABLE expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category     TEXT NOT NULL CHECK (category IN ('fuel','salary','rent','milk','other')),
  amount       NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  spent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  note         TEXT,
  receipt_url  TEXT,
  recorded_by  UUID REFERENCES users(id)
);
CREATE INDEX idx_expenses_period ON expenses (spent_at DESC);

-- PRODUCTION + WASTE
CREATE TABLE production (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES products(id),
  qty_produced  NUMERIC(10,2) NOT NULL CHECK (qty_produced >= 0),
  qty_wasted    NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (qty_wasted >= 0),
  produced_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  note          TEXT,
  recorded_by   UUID REFERENCES users(id)
);
CREATE INDEX idx_production_period ON production (produced_at DESC);

-- ACTIVITY LOG (feeds Majdi's notification bell)
CREATE TABLE activity_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        UUID NOT NULL REFERENCES users(id),
  action          TEXT NOT NULL,
  entity_type     TEXT,
  entity_id       UUID,
  summary_ar      TEXT,
  payload         JSONB,
  read_by_admin   BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_unread ON activity_log (created_at DESC) WHERE read_by_admin = false;
CREATE INDEX idx_activity_actor  ON activity_log (actor_id, created_at DESC);

-- PERIOD CLOSINGS (optional — used when admin "closes" a period)
CREATE TABLE period_closings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  product_id    UUID NOT NULL REFERENCES products(id),
  opening_qty   NUMERIC(10,2),
  closing_qty   NUMERIC(10,2),
  snapshot_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID REFERENCES users(id)
);
CREATE INDEX idx_closings_period ON period_closings (period_start, period_end);
