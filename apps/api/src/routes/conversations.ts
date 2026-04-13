import type { FastifyInstance } from 'fastify';
import { getSupabase } from '../config/supabase.js';

export async function conversationRoutes(app: FastifyInstance) {
  const supabase = getSupabase();

  // List conversations
  app.get('/api/v1/conversations', async (request) => {
    const { state, active_only = 'true', page = '1', limit = '30' } = request.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase
      .from('conversations')
      .select('*, contacts(id, name, phone, phone_normalized)', { count: 'exact' })
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (state) {
      query = query.eq('state', state);
    }
    if (active_only === 'true') {
      query = query.not('state', 'in', '("completed","lost")');
    }

    const { data, count, error } = await query;
    if (error) throw error;
    return { data, total: count, page: parseInt(page), limit: parseInt(limit) };
  });

  // Get conversation with messages
  app.get('/api/v1/conversations/:id', async (request) => {
    const { id } = request.params as { id: string };

    const [convRes, messagesRes] = await Promise.all([
      supabase.from('conversations').select('*, contacts(*)').eq('id', id).single(),
      supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true }),
    ]);

    if (convRes.error) throw convRes.error;
    return { conversation: convRes.data, messages: messagesRes.data };
  });

  // Update conversation (human takeover toggle, state change)
  app.patch('/api/v1/conversations/:id', async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    const allowed = ['state', 'is_bot_active'];
    const filtered = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));
    if (Object.keys(filtered).length === 0) throw { statusCode: 400, message: 'No valid fields provided' };

    const { data, error } = await supabase.from('conversations').update(filtered).eq('id', id).select().single();
    if (error) throw error;
    return data;
  });
}
