-- ===== 0013_cash_box_sessions.sql =====
-- Daily cash-drawer reconciliation per employee.
--
-- Flow:
--   1. Rep arrives at factory, opens a session with the float they're carrying
--      (e.g., 200 ₪ for change, factory loan, etc.).
--   2. Throughout the day:
--        + Cash payments collected from customers (linked via visits.employee_id)
--        - Cash expenses paid out (recorded by this employee in expenses)
--   3. End of day, rep counts their cash and closes the session.
--      Expected = opening_float + cash_collected - cash_spent
--      Diff = expected - actual  →  positive = shortage, negative = extra
--
-- This complements truck-load reconciliation: trucks track product flow,
-- cash boxes track money flow. Together they catch theft, miscalculation,
-- or unrecorded transactions.

CREATE TABLE cash_box_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES users(id),
  session_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  opening_float   NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (opening_float >= 0),
  closing_actual  NUMERIC(10,2),                                    -- NULL until close
  closed_at       TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cash_box_employee_date ON cash_box_sessions (employee_id, session_date DESC);
CREATE INDEX idx_cash_box_status        ON cash_box_sessions (status, session_date DESC);

-- Only one OPEN session per employee per day
CREATE UNIQUE INDEX idx_one_open_cash_box_per_employee_per_day
  ON cash_box_sessions (employee_id, session_date)
  WHERE status = 'open';

ALTER TABLE cash_box_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY cash_box_owner_or_admin ON cash_box_sessions FOR ALL
  USING      (is_admin() OR (is_employee() AND employee_id = auth.uid()))
  WITH CHECK (is_admin() OR (is_employee() AND employee_id = auth.uid()));
