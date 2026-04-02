import type { FastifyInstance } from 'fastify';
import { getSupabase } from '../config/supabase.js';

export async function analyticsRoutes(app: FastifyInstance) {
  const supabase = getSupabase();

  app.get('/api/v1/analytics/overview', async () => {
    const [contactsRes, dealsRes, messagesRes, conversationsRes] = await Promise.all([
      supabase.from('contacts').select('id', { count: 'exact', head: true }),
      supabase.from('deals').select('stage, estimated_value'),
      supabase.from('messages').select('id, direction, sender_type', { count: 'exact', head: true }),
      supabase
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .not('state', 'in', '("completed","lost")'),
    ]);

    const deals = dealsRes.data || [];
    const wonDeals = deals.filter((d) => d.stage === 'won');
    const totalValue = wonDeals.reduce((sum, d) => sum + (d.estimated_value || 0), 0);
    const conversionRate = deals.length > 0 ? (wonDeals.length / deals.length) * 100 : 0;

    return {
      total_contacts: contactsRes.count || 0,
      total_deals: deals.length,
      active_conversations: conversationsRes.count || 0,
      total_messages: messagesRes.count || 0,
      won_deals: wonDeals.length,
      total_revenue: totalValue,
      conversion_rate: Math.round(conversionRate * 10) / 10,
      pipeline_value: deals
        .filter((d) => !['won', 'lost'].includes(d.stage))
        .reduce((sum, d) => sum + (d.estimated_value || 0), 0),
    };
  });

  app.get('/api/v1/analytics/funnel', async () => {
    const { data, error } = await supabase.rpc('analytics_conversion_funnel' as any).select();
    // Fallback if view doesn't work as RPC
    if (error) {
      const { data: deals } = await supabase.from('deals').select('stage, estimated_value');
      const stages = ['new_lead', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'won', 'lost'];
      return stages.map((stage) => {
        const stageDeals = (deals || []).filter((d) => d.stage === stage);
        return {
          stage,
          deal_count: stageDeals.length,
          total_value: stageDeals.reduce((s, d) => s + (d.estimated_value || 0), 0),
        };
      });
    }
    return data;
  });

  app.get('/api/v1/analytics/objections', async () => {
    const { data } = await supabase
      .from('objections_log')
      .select('objection_type, was_resolved');

    const grouped: Record<string, { total: number; resolved: number }> = {};
    for (const row of data || []) {
      if (!grouped[row.objection_type]) grouped[row.objection_type] = { total: 0, resolved: 0 };
      grouped[row.objection_type].total++;
      if (row.was_resolved) grouped[row.objection_type].resolved++;
    }

    return Object.entries(grouped).map(([type, stats]) => ({
      objection_type: type,
      occurrence_count: stats.total,
      resolved_count: stats.resolved,
      resolution_rate: stats.total > 0 ? Math.round((stats.resolved / stats.total) * 1000) / 10 : 0,
    }));
  });

  app.get('/api/v1/analytics/messages-daily', async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data } = await supabase
      .from('messages')
      .select('direction, created_at')
      .gte('created_at', thirtyDaysAgo);

    const daily: Record<string, { inbound: number; outbound: number }> = {};
    for (const msg of data || []) {
      const day = msg.created_at.slice(0, 10);
      if (!daily[day]) daily[day] = { inbound: 0, outbound: 0 };
      daily[day][msg.direction as 'inbound' | 'outbound']++;
    }

    return Object.entries(daily)
      .map(([day, counts]) => ({ day, ...counts, total: counts.inbound + counts.outbound }))
      .sort((a, b) => b.day.localeCompare(a.day));
  });
}
