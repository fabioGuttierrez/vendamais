-- Migration 002: RLS policies + Realtime

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE objections_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_config ENABLE ROW LEVEL SECURITY;

-- Authenticated users can manage all data (dashboard users)
CREATE POLICY "auth_manage_products" ON products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_manage_contacts" ON contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_manage_conversations" ON conversations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_manage_messages" ON messages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_manage_deals" ON deals FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_manage_follow_ups" ON follow_ups FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_manage_objections" ON objections_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_manage_bot_config" ON bot_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enable Realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE deals;
ALTER PUBLICATION supabase_realtime ADD TABLE contacts;
