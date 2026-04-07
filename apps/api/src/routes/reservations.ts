import type { FastifyInstance } from 'fastify';
import { getSupabase } from '../config/supabase.js';

export async function reservationRoutes(app: FastifyInstance) {
  const supabase = getSupabase();

  // Check availability for a product on a date
  app.get('/api/v1/reservations/availability', async (request) => {
    const { product_id, date } = request.query as Record<string, string>;

    if (!product_id || !date) {
      throw { statusCode: 400, message: 'product_id and date are required' };
    }

    // Get product for min_notice_hours
    const { data: product, error: prodErr } = await supabase
      .from('products')
      .select('id, name, min_notice_hours')
      .eq('id', product_id)
      .single();
    if (prodErr) throw prodErr;

    // Check min_notice_hours
    const eventDate = new Date(date + 'T00:00:00');
    const hoursUntil = (eventDate.getTime() - Date.now()) / (1000 * 60 * 60);
    const minNoticeOk = !product.min_notice_hours || hoursUntil >= product.min_notice_hours;

    // Check existing reservation
    const { data: existing } = await supabase
      .from('reservations')
      .select('id, status, contact_id, contacts(name)')
      .eq('product_id', product_id)
      .eq('event_date', date)
      .neq('status', 'cancelled')
      .maybeSingle();

    return {
      available: !existing,
      date,
      product_id,
      product_name: product.name,
      min_notice_ok: minNoticeOk,
      min_notice_hours: product.min_notice_hours,
      existing_reservation: existing ? { id: existing.id, status: existing.status } : null,
    };
  });

  // List reservations with filters
  app.get('/api/v1/reservations', async (request) => {
    const { month, product_id, status } = request.query as Record<string, string>;

    let query = supabase
      .from('reservations')
      .select('*, products(id, name, slug), contacts(id, name, phone)')
      .order('event_date', { ascending: true });

    if (month) {
      const [year, m] = month.split('-').map(Number);
      const firstDay = `${year}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(year, m, 0).toISOString().slice(0, 10);
      query = query.gte('event_date', firstDay).lte('event_date', lastDay);
    }
    if (product_id) query = query.eq('product_id', product_id);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  });

  // Get single reservation
  app.get('/api/v1/reservations/:id', async (request) => {
    const { id } = request.params as { id: string };
    const { data, error } = await supabase
      .from('reservations')
      .select('*, products(id, name, slug), contacts(id, name, phone), deals(id, title, stage)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  });

  // Create reservation (from dashboard)
  app.post('/api/v1/reservations', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const allowed = ['product_id', 'contact_id', 'deal_id', 'event_date', 'status', 'notes'];
    const filtered: Record<string, unknown> = Object.fromEntries(
      Object.entries(body).filter(([k]) => allowed.includes(k)),
    );

    if (!filtered.product_id || !filtered.event_date) {
      throw { statusCode: 400, message: 'product_id and event_date are required' };
    }

    filtered.created_by = 'dashboard';

    const { data: inserted, error } = await supabase.from('reservations').insert(filtered).select('id').single();

    if (error) {
      if (error.code === '23505') {
        return reply.status(409).send({
          error: 'conflict',
          message: 'Já existe uma reserva ativa para este produto nesta data',
        });
      }
      throw error;
    }

    // Re-fetch with joins so frontend gets product/contact data
    const { data } = await supabase
      .from('reservations')
      .select('*, products(id, name, slug), contacts(id, name, phone)')
      .eq('id', inserted.id)
      .single();

    return data;
  });

  // Update reservation (status change, notes)
  app.patch('/api/v1/reservations/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;
    const allowed = ['status', 'notes', 'cancelled_reason', 'contact_id', 'deal_id'];
    const filtered: Record<string, unknown> = Object.fromEntries(
      Object.entries(body).filter(([k]) => allowed.includes(k)),
    );

    // Auto-set timestamps on status changes
    if (filtered.status === 'confirmed') filtered.confirmed_at = new Date().toISOString();
    if (filtered.status === 'cancelled') filtered.cancelled_at = new Date().toISOString();

    const { data: updated, error } = await supabase
      .from('reservations')
      .update(filtered)
      .eq('id', id)
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        return reply.status(409).send({
          error: 'conflict',
          message: 'Já existe uma reserva ativa para este produto nesta data',
        });
      }
      throw error;
    }

    // Re-fetch with joins
    const { data } = await supabase
      .from('reservations')
      .select('*, products(id, name, slug), contacts(id, name, phone)')
      .eq('id', updated.id)
      .single();

    return data;
  });

  // Delete reservation
  app.delete('/api/v1/reservations/:id', async (request) => {
    const { id } = request.params as { id: string };
    const { error } = await supabase.from('reservations').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  });
}
