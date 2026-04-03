import type { FastifyInstance } from 'fastify';
import { getSupabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

const ALLOWED_FIELDS = [
  'name', 'description', 'features', 'ideal_for', 'capacity', 'delivery_time',
  'min_price_hint', 'video_url', 'pricing_info', 'technical_specs', 'faq',
  'coverage_area', 'min_notice_hours', 'package_includes', 'restrictions',
  'active', 'sort_order',
];

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function productRoutes(app: FastifyInstance) {
  const supabase = getSupabase();

  // List all products
  app.get('/api/v1/products', async () => {
    const { data, error } = await supabase.from('products').select('*').order('sort_order');
    if (error) {
      logger.error({ error }, 'Failed to list products');
      throw error;
    }
    return data;
  });

  // Get single product
  app.get('/api/v1/products/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
    if (error) {
      logger.error({ error, id }, 'Failed to get product');
      return reply.status(404).send({ error: 'Product not found' });
    }
    return data;
  });

  // Create product
  app.post('/api/v1/products', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const filtered = Object.fromEntries(Object.entries(body).filter(([k]) => ALLOWED_FIELDS.includes(k)));

    if (!filtered.name) {
      return reply.status(400).send({ error: 'name is required' });
    }
    if (!filtered.description) {
      filtered.description = '';
    }

    filtered.slug = slugify(filtered.name as string);

    logger.info({ name: filtered.name, slug: filtered.slug }, 'Creating product');

    const { data, error } = await supabase.from('products').insert(filtered).select().single();
    if (error) {
      logger.error({ error, filtered }, 'Failed to create product');
      throw error;
    }
    logger.info({ id: data.id, name: data.name }, 'Product created');
    return reply.status(201).send(data);
  });

  // Update product
  app.put('/api/v1/products/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;
    const filtered = Object.fromEntries(Object.entries(body).filter(([k]) => ALLOWED_FIELDS.includes(k)));

    // Update name → also update slug
    if (filtered.name) {
      filtered.slug = slugify(filtered.name as string);
    }

    const { data, error } = await supabase
      .from('products')
      .update({ ...filtered, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error({ error, id }, 'Failed to update product');
      if (error.code === 'PGRST116') {
        return reply.status(404).send({ error: 'Product not found' });
      }
      throw error;
    }
    return data;
  });

  // Deactivate product (soft delete)
  app.delete('/api/v1/products/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { error } = await supabase.from('products').update({ active: false }).eq('id', id);
    if (error) {
      logger.error({ error, id }, 'Failed to deactivate product');
      throw error;
    }
    return reply.status(204).send();
  });
}
