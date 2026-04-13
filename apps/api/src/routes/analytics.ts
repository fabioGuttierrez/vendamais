import type { FastifyInstance } from 'fastify';
import { getSupabase } from '../config/supabase.js';
import { calculateCostBRL, DEFAULT_USD_BRL_RATE } from '@vendamais/shared';

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
    const { data, error } = await supabase
      .from('analytics_daily_messages')
      .select('day, inbound, outbound');

    if (error) throw error;

    return (data || []).map((row: any) => ({
      day: row.day,
      inbound: Number(row.inbound),
      outbound: Number(row.outbound),
      total: Number(row.inbound) + Number(row.outbound),
    })).sort((a: any, b: any) => b.day.localeCompare(a.day));
  });

  app.get('/api/v1/analytics/pending-reservations', async () => {
    const { data, error } = await supabase
      .from('reservations')
      .select('*, products(id, name, slug), contacts(id, name, phone)')
      .in('status', ['pending', 'in_analysis'])
      .order('event_date', { ascending: true });

    if (error) throw error;
    return data;
  });

  app.get('/api/v1/analytics/conversation-costs', async (request) => {
    const query = request.query as { limit?: string };
    const limit = Math.min(parseInt(query.limit || '50', 10), 200);

    // Get USD/BRL rate from bot_config (fallback to default)
    const { data: rateConfig } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', 'usd_brl_rate')
      .single();
    const usdBrlRate = (rateConfig?.value as number) || DEFAULT_USD_BRL_RATE;

    // Query messages with AI tokens from last 90 days
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: messages } = await supabase
      .from('messages')
      .select('conversation_id, ai_model, ai_input_tokens, ai_output_tokens, ai_cache_read_tokens, ai_cache_creation_tokens')
      .not('ai_input_tokens', 'is', null)
      .gte('created_at', ninetyDaysAgo);

    const costMap = new Map<string, { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheCreationTokens: number; model: string; messageCount: number }>();
    for (const msg of messages || []) {
      const existing = costMap.get(msg.conversation_id) || { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, model: msg.ai_model || '', messageCount: 0 };
      existing.inputTokens += msg.ai_input_tokens || 0;
      existing.outputTokens += msg.ai_output_tokens || 0;
      existing.cacheReadTokens += msg.ai_cache_read_tokens || 0;
      existing.cacheCreationTokens += msg.ai_cache_creation_tokens || 0;
      existing.messageCount++;
      if (msg.ai_model) existing.model = msg.ai_model;
      costMap.set(msg.conversation_id, existing);
    }

    const conversationIds = Array.from(costMap.keys());
    if (conversationIds.length === 0) {
      return { conversations: [], totals: { total_cost_brl: 0, total_input_tokens: 0, total_output_tokens: 0, total_conversations: 0 }, usd_brl_rate: usdBrlRate };
    }

    const { data: conversations } = await supabase
      .from('conversations')
      .select('id, state, created_at, contacts(name, phone)')
      .in('id', conversationIds);

    const convMap = new Map((conversations || []).map((c: any) => [c.id, c]));

    let totalCostBrl = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    const results = conversationIds.map((convId) => {
      const tokens = costMap.get(convId)!;
      const conv = convMap.get(convId) as any;
      const costBrl = calculateCostBRL(tokens.inputTokens, tokens.outputTokens, tokens.model, usdBrlRate, tokens.cacheReadTokens, tokens.cacheCreationTokens);
      totalCostBrl += costBrl;
      totalInputTokens += tokens.inputTokens;
      totalOutputTokens += tokens.outputTokens;
      return {
        conversation_id: convId,
        contact_name: conv?.contacts?.name || null,
        contact_phone: conv?.contacts?.phone || null,
        state: conv?.state || null,
        started_at: conv?.created_at || null,
        ai_message_count: tokens.messageCount,
        input_tokens: tokens.inputTokens,
        output_tokens: tokens.outputTokens,
        cost_brl: Math.round(costBrl * 100) / 100,
        model: tokens.model,
      };
    });

    results.sort((a, b) => b.cost_brl - a.cost_brl);

    return {
      conversations: results.slice(0, limit),
      totals: {
        total_cost_brl: Math.round(totalCostBrl * 100) / 100,
        total_input_tokens: totalInputTokens,
        total_output_tokens: totalOutputTokens,
        total_conversations: results.length,
      },
      usd_brl_rate: usdBrlRate,
    };
  });
}
