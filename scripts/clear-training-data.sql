-- =====================================================================
-- clear-training-data.sql
-- ---------------------------------------------------------------------
-- Wipes ALL operational/transactional data from Supabase. Run this once,
-- on the day you flip the app from "training/testing" mode to "live for
-- Majdi" — it gives him an empty, real-world starting state.
--
-- WHAT GETS DELETED (every row):
--   • clients          (training + any test-real clients you added)
--   • visits           (cascades: visit_lines, returns, replacements)
--   • payments
--   • expenses
--   • production
--   • activity_log     (notification feed)
--   • period_closings  (any closed-period snapshots)
--   • ai_chats         (AI assistant chat history)
--
-- WHAT IS PRESERVED:
--   • users            (Majdi's login + employee login + admin role)
--   • products         (لبن، لبنة، جبنة بيضاء — Majdi's actual product list)
--   • product_packages (كرتونة، عبوة، etc. — pricing tiers)
--   • All RLS policies + views + functions + indexes
--
-- HOW TO RUN:
--   Option A (recommended): Supabase Dashboard → SQL Editor → paste → Run
--   Option B: psql connection → \i scripts/clear-training-data.sql
--
-- IMPORTANT: This is irreversible. Make a Supabase backup first if you're
-- not 100% sure (Dashboard → Database → Backups → "Create backup now").
-- =====================================================================

BEGIN;

-- Order matters only where FK cascades don't fire automatically.
-- We TRUNCATE with CASCADE so child rows go with their parents and the
-- sequence/identity counters reset cleanly. Faster than DELETE on large tables.

TRUNCATE TABLE
  visit_lines,
  visits,
  payments,
  expenses,
  production,
  activity_log,
  period_closings,
  ai_chats,
  clients
RESTART IDENTITY CASCADE;

COMMIT;

-- Verification: every count below should be 0.
SELECT 'clients'         AS table_name, COUNT(*) AS rows FROM clients
UNION ALL SELECT 'visits',          COUNT(*) FROM visits
UNION ALL SELECT 'visit_lines',     COUNT(*) FROM visit_lines
UNION ALL SELECT 'payments',        COUNT(*) FROM payments
UNION ALL SELECT 'expenses',        COUNT(*) FROM expenses
UNION ALL SELECT 'production',      COUNT(*) FROM production
UNION ALL SELECT 'activity_log',    COUNT(*) FROM activity_log
UNION ALL SELECT 'period_closings', COUNT(*) FROM period_closings
UNION ALL SELECT 'ai_chats',        COUNT(*) FROM ai_chats
UNION ALL SELECT 'users (kept)',    COUNT(*) FROM users
UNION ALL SELECT 'products (kept)', COUNT(*) FROM products;
