-- ===== 0006_realtime_activity.sql =====
-- Enable Supabase Realtime broadcast on activity_log INSERT/UPDATE events.
-- The bell component subscribes to this channel to update unread count live.
ALTER PUBLICATION supabase_realtime ADD TABLE activity_log;
