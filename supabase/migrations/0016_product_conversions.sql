-- ===== 0016_product_conversions.sql =====
-- Some damaged stock isn't really "waste" — it gets converted into another
-- saleable product. E.g.,:
--   - Damaged laban → cheese (boil into curds)
--   - Cheese → grated cheese (sold for pastries)
--
-- This table records each such conversion event so:
--   1. Inventory shows the source decreasing and the target increasing
--      without needing a normal "production" entry.
--   2. The accountant can see the recycling stream separately from
--      genuine waste cost.

CREATE TABLE product_conversions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_product_id  UUID NOT NULL REFERENCES products(id),
  source_qty         NUMERIC(10,2) NOT NULL CHECK (source_qty > 0),
  target_product_id  UUID NOT NULL REFERENCES products(id),
  target_qty         NUMERIC(10,2) NOT NULL CHECK (target_qty > 0),
  converted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes              TEXT,
  recorded_by        UUID REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversions_source_date ON product_conversions(source_product_id, converted_at DESC);
CREATE INDEX idx_conversions_target_date ON product_conversions(target_product_id, converted_at DESC);
CREATE INDEX idx_conversions_recent      ON product_conversions(converted_at DESC);

ALTER TABLE product_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversions_admin ON product_conversions FOR ALL
  USING      (is_admin())
  WITH CHECK (is_admin());
