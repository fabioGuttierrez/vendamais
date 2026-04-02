import type { FastifyInstance } from 'fastify';
import { getSupabase } from '../config/supabase.js';

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
    return data;
  });

  // Products CRUD
  app.get('/api/v1/products', async () => {
    const { data, error } = await supabase.from('products').select('*').order('sort_order');
    if (error) throw error;
    return data;
  });

  app.patch('/api/v1/products/:id', async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    const allowed = ['name', 'description', 'features', 'price_range', 'active', 'sort_order'];
    const filtered = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));

    const { data, error } = await supabase.from('products').update(filtered).eq('id', id).select().single();
    if (error) throw error;
    return data;
  });
}
