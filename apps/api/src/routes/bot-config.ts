import type { FastifyInstance } from 'fastify';
import { getSupabase } from '../config/supabase.js';
import { invalidateEvolutionConfigCache } from '../config/evolution-config.js';
import { invalidateBotConfigCache } from '../services/conversation-engine.js';
import { BUILT_IN_PRESETS } from '../ai/agent-presets.js';

const EVOLUTION_CONFIG_KEYS = ['evolution_api_url', 'evolution_api_key', 'evolution_instance_name'];

const ALLOWED_CONFIG_KEYS = new Set([
  'greeting_message',
  'custom_prompt',
  'bot_default_active',
  'active_agent_preset_id',
  'custom_agent_presets',
  'admin_whatsapp_number',
  'usd_brl_rate',
  ...EVOLUTION_CONFIG_KEYS,
]);

export async function botConfigRoutes(app: FastifyInstance) {
  const supabase = getSupabase();

  app.get('/api/v1/agent-presets', async () => {
    return BUILT_IN_PRESETS;
  });

  app.get('/api/v1/bot-config', async () => {
    const { data, error } = await supabase.from('bot_config').select('*').order('key');
    if (error) throw error;
    return data;
  });

  app.put('/api/v1/bot-config/:key', async (request, reply) => {
    const { key } = request.params as { key: string };
    const { value } = request.body as { value: unknown };

    if (!ALLOWED_CONFIG_KEYS.has(key)) {
      return reply.status(400).send({ error: `Config key '${key}' is not allowed` });
    }

    const { data, error } = await supabase
      .from('bot_config')
      .upsert({ key, value }, { onConflict: 'key' })
      .select()
      .single();

    if (error) throw error;

    // Invalidate caches when relevant keys change
    if (EVOLUTION_CONFIG_KEYS.includes(key)) invalidateEvolutionConfigCache();
    invalidateBotConfigCache();

    return data;
  });

}
