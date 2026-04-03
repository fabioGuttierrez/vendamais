import type { FastifyInstance } from 'fastify';
import { getSupabase } from '../config/supabase.js';
import { invalidateEvolutionConfigCache } from '../config/evolution-config.js';

const EVOLUTION_CONFIG_KEYS = ['evolution_api_url', 'evolution_api_key', 'evolution_instance_name'];

export async function botConfigRoutes(app: FastifyInstance) {
  const supabase = getSupabase();

  app.get('/api/v1/bot-config', async () => {
    const { data, error } = await supabase.from('bot_config').select('*').order('key');
    if (error) throw error;
    return data;
  });

  app.put('/api/v1/bot-config/:key', async (request) => {
    const { key } = request.params as { key: string };
    const { value } = request.body as { value: unknown };

    const { data, error } = await supabase
      .from('bot_config')
      .upsert({ key, value }, { onConflict: 'key' })
      .select()
      .single();

    if (error) throw error;

    // Invalidate Evolution config cache when relevant keys change
    if (EVOLUTION_CONFIG_KEYS.includes(key)) {
      invalidateEvolutionConfigCache();
    }

    return data;
  });

}
