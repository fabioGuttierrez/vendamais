CREATE TABLE IF NOT EXISTS training_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Conversa sem título',
  outcome text NOT NULL CHECK (outcome IN ('positive', 'negative')),
  raw_text text NOT NULL,
  parsed_messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  message_count integer NOT NULL DEFAULT 0,
  analysis_status text NOT NULL DEFAULT 'pending' CHECK (analysis_status IN ('pending', 'analyzing', 'completed', 'failed')),
  analysis_error text,
  insights jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE training_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for service role" ON training_conversations
  FOR ALL USING (true) WITH CHECK (true);

-- Index for listing
CREATE INDEX idx_training_conversations_created_at ON training_conversations (created_at DESC);
