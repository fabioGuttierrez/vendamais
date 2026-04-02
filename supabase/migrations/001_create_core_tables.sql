-- Migration 001: Create core tables
-- Apply via Supabase MCP or Dashboard SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE TYPE conversation_state AS ENUM (
  'greeting', 'qualification', 'presentation', 'objection_handling',
  'closing', 'follow_up', 'human_takeover', 'completed', 'lost'
);

CREATE TYPE deal_stage AS ENUM (
  'new_lead', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'won', 'lost'
);

CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE message_sender_type AS ENUM ('customer', 'bot', 'human');
CREATE TYPE follow_up_status AS ENUM ('pending', 'sent', 'cancelled', 'completed');

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  features JSONB NOT NULL DEFAULT '[]',
  ideal_for TEXT,
  capacity TEXT,
  delivery_time TEXT,
  min_price_hint NUMERIC,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone TEXT NOT NULL,
  phone_normalized TEXT NOT NULL,
  name TEXT,
  email TEXT,
  company TEXT,
  city TEXT,
  state TEXT DEFAULT 'PR',
  event_type TEXT,
  event_date DATE,
  estimated_guests INTEGER,
  budget_range TEXT,
  source TEXT DEFAULT 'whatsapp',
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contacts_phone_normalized_unique UNIQUE (phone_normalized)
);

CREATE INDEX idx_contacts_phone ON contacts (phone_normalized);
CREATE INDEX idx_contacts_name_trgm ON contacts USING gin (name gin_trgm_ops);

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  state conversation_state NOT NULL DEFAULT 'greeting',
  is_bot_active BOOLEAN NOT NULL DEFAULT true,
  human_agent_id UUID REFERENCES auth.users(id),
  qualification_data JSONB DEFAULT '{}',
  ai_context JSONB DEFAULT '{}',
  last_message_at TIMESTAMPTZ,
  message_count INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversations_contact ON conversations (contact_id);
CREATE INDEX idx_conversations_state ON conversations (state);
CREATE INDEX idx_conversations_active ON conversations (is_bot_active, last_message_at DESC);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  direction message_direction NOT NULL,
  sender_type message_sender_type NOT NULL,
  content TEXT NOT NULL,
  media_type TEXT,
  media_url TEXT,
  evolution_message_id TEXT,
  ai_model TEXT,
  ai_tokens_used INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON messages (conversation_id, created_at);
CREATE INDEX idx_messages_contact ON messages (contact_id, created_at DESC);

CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id),
  title TEXT NOT NULL,
  stage deal_stage NOT NULL DEFAULT 'new_lead',
  product_id UUID REFERENCES products(id),
  event_date DATE,
  event_type TEXT,
  estimated_value NUMERIC,
  actual_value NUMERIC,
  probability INTEGER DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  lost_reason TEXT,
  won_at TIMESTAMPTZ,
  lost_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deals_contact ON deals (contact_id);
CREATE INDEX idx_deals_stage ON deals (stage);

CREATE TABLE follow_ups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id),
  deal_id UUID REFERENCES deals(id),
  scheduled_for TIMESTAMPTZ NOT NULL,
  message_template TEXT NOT NULL,
  status follow_up_status NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  created_by TEXT DEFAULT 'bot',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_follow_ups_scheduled ON follow_ups (scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_follow_ups_contact ON follow_ups (contact_id);

CREATE TABLE objections_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  objection_type TEXT NOT NULL,
  objection_text TEXT NOT NULL,
  response_text TEXT NOT NULL,
  response_technique TEXT,
  was_resolved BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_objections_type ON objections_log (objection_type);
CREATE INDEX idx_objections_conversation ON objections_log (conversation_id);

CREATE TABLE bot_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON deals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON follow_ups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON bot_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
