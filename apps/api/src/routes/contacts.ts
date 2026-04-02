import type { FastifyInstance } from 'fastify';
import { getSupabase } from '../config/supabase.js';

export async function contactRoutes(app: FastifyInstance) {
  const supabase = getSupabase();

  // List contacts with search and pagination
  app.get('/api/v1/contacts', async (request) => {
    const { search, tag, page = '1', limit = '20' } = request.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase
      .from('contacts')
      .select('*, deals(id, stage, estimated_value)', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
    }
    if (tag) {
      query = query.contains('tags', [tag]);
    }

    const { data, count, error } = await query;
    if (error) throw error;
    return { data, total: count, page: parseInt(page), limit: parseInt(limit) };
  });

  // Get single contact with full history
  app.get('/api/v1/contacts/:id', async (request) => {
    const { id } = request.params as { id: string };

    const [contactRes, conversationsRes, dealsRes] = await Promise.all([
      supabase.from('contacts').select('*').eq('id', id).single(),
      supabase.from('conversations').select('*').eq('contact_id', id).order('created_at', { ascending: false }),
      supabase.from('deals').select('*, products(name, slug)').eq('contact_id', id).order('created_at', { ascending: false }),
    ]);

    if (contactRes.error) throw contactRes.error;
    return { contact: contactRes.data, conversations: conversationsRes.data, deals: dealsRes.data };
  });

  // Update contact
  app.patch('/api/v1/contacts/:id', async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    // Only allow known fields
    const allowed = ['name', 'email', 'event_type', 'event_date', 'estimated_guests', 'budget_range', 'city', 'tags', 'notes'];
    const filtered = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));
    if (Object.keys(filtered).length === 0) throw { statusCode: 400, message: 'No valid fields provided' };

    const { data, error } = await supabase.from('contacts').update(filtered).eq('id', id).select().single();
    if (error) throw error;
    return data;
  });
}
