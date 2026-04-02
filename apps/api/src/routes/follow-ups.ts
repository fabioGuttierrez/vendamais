import type { FastifyInstance } from 'fastify';
import { getSupabase } from '../config/supabase.js';

export async function followUpRoutes(app: FastifyInstance) {
  const supabase = getSupabase();

  app.get('/api/v1/follow-ups', async (request) => {
    const { status = 'pending' } = request.query as Record<string, string>;

    const { data, error } = await supabase
      .from('follow_ups')
      .select('*, contacts(name, phone), conversations(state)')
      .eq('status', status)
      .order('scheduled_for', { ascending: true });

    if (error) throw error;
    return data;
  });

  app.patch('/api/v1/follow-ups/:id', async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    const allowed = ['status', 'message_template', 'scheduled_for'];
    const filtered = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));

    const { data, error } = await supabase.from('follow_ups').update(filtered).eq('id', id).select().single();
    if (error) throw error;
    return data;
  });
}
