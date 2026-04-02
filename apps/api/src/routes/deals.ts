import type { FastifyInstance } from 'fastify';
import { getSupabase } from '../config/supabase.js';

export async function dealRoutes(app: FastifyInstance) {
  const supabase = getSupabase();

  // List deals (pipeline view)
  app.get('/api/v1/deals', async (request) => {
    const { stage } = request.query as Record<string, string>;

    let query = supabase
      .from('deals')
      .select('*, contacts(id, name, phone, event_type), products(name, slug)')
      .order('updated_at', { ascending: false });

    if (stage) {
      query = query.eq('stage', stage);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  });

  // Update deal (stage change from Kanban drag)
  app.patch('/api/v1/deals/:id', async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    const allowed = ['stage', 'title', 'estimated_value', 'product_id', 'notes'];
    const filtered = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));

    // Add timestamps for won/lost
    if (filtered.stage === 'won') filtered.won_at = new Date().toISOString();
    if (filtered.stage === 'lost') filtered.lost_at = new Date().toISOString();

    const { data, error } = await supabase.from('deals').update(filtered).eq('id', id).select().single();
    if (error) throw error;
    return data;
  });

  // Create deal manually
  app.post('/api/v1/deals', async (request) => {
    const body = request.body as Record<string, unknown>;

    const allowed = ['contact_id', 'conversation_id', 'product_id', 'title', 'stage', 'estimated_value'];
    const filtered = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));
    if (!filtered.contact_id || !filtered.title) throw { statusCode: 400, message: 'contact_id and title are required' };

    const { data, error } = await supabase.from('deals').insert(filtered).select().single();
    if (error) throw error;
    return data;
  });
}
