import type { FastifyInstance } from 'fastify';
import { getSupabase } from '../config/supabase.js';
import { generateResponse } from '../services/claude-ai.js';
import { findPreset, DEFAULT_PRESET_ID } from '../ai/agent-presets.js';
import { logger } from '../utils/logger.js';
import type { AgentPreset, ConversationState } from '@vendamais/shared';

interface ChatRequest {
  message: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  presetId?: string;
  customPersona?: { persona: string; greetingStyle: string };
  greetingMessage?: string;
  customPrompt?: string;
  conversationState?: ConversationState;
  qualificationData?: Record<string, unknown>;
}

// Mock tool executor — returns realistic responses without touching the DB
function mockToolCall(toolName: string, input: Record<string, unknown>): unknown {
  switch (toolName) {
    case 'update_conversation_state':
      return { success: true, new_state: input.new_state };
    case 'update_qualification':
      return { success: true, qualification: input };
    case 'create_or_update_deal':
      return { success: true, deal_id: 'test-mock', action: 'created' };
    case 'schedule_follow_up':
      return { success: true, follow_up_id: 'test-mock', scheduled_for: new Date(Date.now() + 86400000).toISOString() };
    case 'log_objection':
      return { success: true };
    case 'escalate_to_human':
      return { success: true, reason: input.reason };
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

export async function agentTestRoutes(app: FastifyInstance) {
  app.post('/api/v1/agent-test/chat', async (request, reply) => {
    const body = request.body as ChatRequest;

    if (!body.message) {
      return reply.status(400).send({ error: 'message is required' });
    }

    try {
      // Load real products from DB
      const supabase = getSupabase();
      const { data: products } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('sort_order');

      // Load custom presets if needed (to resolve custom preset IDs)
      let customPresets: AgentPreset[] = [];
      if (body.presetId?.startsWith('custom:')) {
        const { data: configData } = await supabase
          .from('bot_config')
          .select('value')
          .eq('key', 'custom_agent_presets')
          .single();
        customPresets = (configData?.value as AgentPreset[]) || [];
      }

      // Resolve persona
      const presetId = body.presetId || DEFAULT_PRESET_ID;
      const preset = findPreset(presetId, customPresets);
      const persona = body.customPersona || (preset ? { persona: preset.persona, greetingStyle: preset.greetingStyle } : undefined);

      // Track state changes from tool calls
      let currentState: ConversationState = body.conversationState || 'greeting';
      let currentQualification = body.qualificationData || {};

      // Build fake conversation object
      const fakeConversation = {
        id: 'test-simulation',
        contact_id: 'test-contact',
        state: currentState,
        is_bot_active: true,
        qualification_data: currentQualification,
        message_count: body.history.length,
        last_message_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        contact: { name: 'Cliente Teste', phone: '+5544999999999' },
      };

      // Convert history to Message-like objects for generateResponse
      const recentMessages = body.history.map((msg, i) => ({
        id: `test-${i}`,
        conversation_id: 'test-simulation',
        contact_id: 'test-contact',
        content: msg.content,
        direction: msg.role === 'user' ? 'inbound' : 'outbound',
        sender_type: msg.role === 'user' ? 'customer' : 'bot',
        created_at: new Date(Date.now() - (body.history.length - i) * 60000).toISOString(),
        updated_at: new Date().toISOString(),
        evolution_message_id: null,
        media_url: null,
        media_type: null,
        ai_model: null,
        ai_tokens_used: null,
      }));

      // Collect tool calls for display
      const toolCalls: { toolName: string; input: Record<string, unknown> }[] = [];

      // Dynamic context injected as first message (mirrors production behaviour)
      const dynamicContext = [
        `[CONTEXTO ATUAL — atualizado a cada mensagem]`,
        `Estado: ${currentState.toUpperCase()}`,
        `Qualificação coletada:`,
        `- Nome: ${(currentQualification as any).customer_name || 'NÃO COLETADO'}`,
        `- Tipo de evento: ${(currentQualification as any).event_type || 'NÃO COLETADO'}`,
        `- Data do evento: ${(currentQualification as any).event_date || 'NÃO COLETADO'}`,
        `- Convidados: ${(currentQualification as any).estimated_guests || 'NÃO COLETADO'}`,
        `- Cidade: ${(currentQualification as any).city || 'NÃO COLETADO'}`,
        `- Orçamento: ${(currentQualification as any).budget_range || 'NÃO COLETADO'}`,
      ].join('\n');

      const aiResponse = await generateResponse(
        fakeConversation as any,
        products || [],
        recentMessages as any[],
        body.message,
        dynamicContext,
        async (toolName, input) => {
          toolCalls.push({ toolName, input });
          const result = mockToolCall(toolName, input);
          // Track state updates
          if (toolName === 'update_conversation_state' && input.new_state) {
            currentState = input.new_state as ConversationState;
          }
          if (toolName === 'update_qualification') {
            currentQualification = { ...currentQualification, ...input };
          }
          return result;
        },
        body.customPrompt,
        body.greetingMessage,
        persona,
      );

      return {
        text: aiResponse.text,
        toolCalls,
        tokensUsed: aiResponse.tokensUsed,
        model: aiResponse.model,
        conversationState: currentState,
        qualificationData: currentQualification,
      };
    } catch (error: any) {
      logger.error({ error: error.message }, 'Agent test chat failed');
      return reply.status(500).send({ error: 'AI generation failed', details: error.message });
    }
  });
}
