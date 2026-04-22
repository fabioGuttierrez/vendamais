ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS ai_input_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS ai_output_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS ai_cache_read_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS ai_cache_creation_tokens INTEGER;
