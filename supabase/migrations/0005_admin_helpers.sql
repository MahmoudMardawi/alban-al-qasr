-- ===== 0005_admin_helpers.sql =====

-- ----- Atomic client merge -----
-- Moves all visits + payments from `duplicate_ids` to `primary_id`,
-- then soft-merges the duplicates (sets merged_into_client_id).
-- Returns the count of duplicates merged.
-- All-or-nothing: Postgres function runs in an implicit transaction.
CREATE OR REPLACE FUNCTION fn_merge_clients(primary_id UUID, duplicate_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER  -- runs as caller; RLS still applies; admin-only via underlying table policies
AS $$
DECLARE
  moved_count INTEGER := 0;
BEGIN
  IF primary_id IS NULL OR array_length(duplicate_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'primary_id and at least one duplicate_id required';
  END IF;

  IF primary_id = ANY(duplicate_ids) THEN
    RAISE EXCEPTION 'primary cannot be in duplicates list';
  END IF;

  UPDATE visits   SET client_id = primary_id WHERE client_id = ANY(duplicate_ids);
  UPDATE payments SET client_id = primary_id WHERE client_id = ANY(duplicate_ids);
  UPDATE clients
     SET merged_into_client_id = primary_id
   WHERE id = ANY(duplicate_ids)
     AND merged_into_client_id IS NULL;

  GET DIAGNOSTICS moved_count = ROW_COUNT;
  RETURN moved_count;
END;
$$;

-- Restrict execution to authenticated users; the underlying tables enforce admin-only writes via existing RLS (0003).
REVOKE EXECUTE ON FUNCTION fn_merge_clients FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_merge_clients TO authenticated;

-- ----- Storage bucket: receipts (private — admin-only) -----
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (admin-only). Drop first so the migration is idempotent.
DROP POLICY IF EXISTS receipts_admin_select ON storage.objects;
CREATE POLICY receipts_admin_select ON storage.objects
  FOR SELECT USING (bucket_id = 'receipts' AND is_admin());

DROP POLICY IF EXISTS receipts_admin_insert ON storage.objects;
CREATE POLICY receipts_admin_insert ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'receipts' AND is_admin());

DROP POLICY IF EXISTS receipts_admin_delete ON storage.objects;
CREATE POLICY receipts_admin_delete ON storage.objects
  FOR DELETE USING (bucket_id = 'receipts' AND is_admin());
