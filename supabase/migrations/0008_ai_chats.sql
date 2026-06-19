-- ===== 0008_ai_chats.sql =====
-- Persistent storage for the AI assistant's chat history.
-- Each chat is owned by one user (typically Majdi); RLS restricts access to the owner.
-- Messages are JSONB for flexibility (no separate child table; chats are small + bounded).

CREATE TABLE IF NOT EXISTS ai_chats (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'محادثة جديدة',
  messages    JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_chats_owner_updated
  ON ai_chats (owner_id, updated_at DESC);

ALTER TABLE ai_chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_chats_owner_all ON ai_chats;
CREATE POLICY ai_chats_owner_all ON ai_chats
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
