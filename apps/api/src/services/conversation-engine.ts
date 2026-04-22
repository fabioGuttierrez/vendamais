import { getSupabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { toE164 } from '@vendamais/shared';
import type { AgentPreset, ConversationState } from '@vendamais/shared';
import { sendText } from './evolution-api.js';
import { generateResponse } from './claude-ai.js';
import { transcribeAudio } from './audio-transcription.js';
import { followUpQueue } from '../queues/connection.js';
import { findPreset, DEFAULT_PRESET_ID } from '../ai/agent-presets.js';
import { buildTrainingInsightsPrompt, type TrainingInsights } from './training-analyzer.js';
import type { InboundMessageJob } from '../queues/message.worker.js';
import type { FollowUpJob } from '../queues/follow-up.worker.js';

const supabase = () => getSupabase();

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache training insights
let cachedInsights: string | null = null;
let insightsCacheTime = 0;

// Cache products
let cachedProducts: any[] | null = null;
let productsCacheTime = 0;

// Cache bot config
let cachedBotConfig: any[] | null = null;
let botConfigCacheTime = 0;

async function getTrainingInsights(): Promise<string> {
  if (cachedInsights !== null && Date.now() - insightsCacheTime < CACHE_TTL) {
    return cachedInsights;
  }
  const { data } = await supabase()
    .from('training_conversations')
    .select('insights, outcome')
    .eq('analysis_status', 'completed')
    .not('insights', 'is', null);

  if (!data || data.length === 0) {
    cachedInsights = '';
    insightsCacheTime = Date.now();
    return '';
  }

  cachedInsights = buildTrainingInsightsPrompt(
    data.map((d) => ({ insights: d.insights as TrainingInsights, outcome: d.outcome })),
  );
  insightsCacheTime = Date.now();
  return cachedInsights;
}

async function getProducts(): Promise<any[]> {
  if (cachedProducts !== null && Date.now() - productsCacheTime < CACHE_TTL) {
    return cachedProducts;
  }
  const { data } = await supabase().from('products').select('*').eq('active', true).order('sort_order');
  cachedProducts = data || [];
  productsCacheTime = Date.now();
  return cachedProducts;
}

async function getBotConfig(): Promise<any[]> {
  if (cachedBotConfig !== null && Date.now() - botConfigCacheTime < CACHE_TTL) {
    return cachedBotConfig;
  }
  const { data } = await supabase().from('bot_config').select('key, value');
  cachedBotConfig = data || [];
  botConfigCacheTime = Date.now();
  return cachedBotConfig;
}

export function invalidateBotConfigCache() {
  cachedBotConfig = null;
  botConfigCacheTime = 0;
}

export function invalidateProductsCache() {
  cachedProducts = null;
  productsCacheTime = 0;
}

export async function processInboundMessage(job: InboundMessageJob): Promise<void> {
  const { phoneNormalized, pushName, messageType, mediaUrl, evolutionMessageId } = job;
  let { content } = job;
  const phone = toE164(phoneNormalized);

  // 0. Transcribe audio if it's an audio message
  if (messageType === 'audio' && evolutionMessageId) {
    const transcription = await transcribeAudio(evolutionMessageId, mediaUrl);
    if (transcription) {
      content = `[Áudio transcrito]: ${transcription}`;
      logger.info({ phone }, 'Audio transcribed for processing');
    } else {
      content = '[Áudio - não foi possível transcrever]';
    }
  }

  // 1. Upsert contact
  const { data: contact, error: contactError } = await supabase()
    .from('contacts')
    .upsert(
      { phone, phone_normalized: phoneNormalized, name: pushName || null, source: 'whatsapp' },
      { onConflict: 'phone_normalized', ignoreDuplicates: false },
    )
    .select('*')
    .single();

  if (contactError || !contact) {
    logger.error({ contactError, phone }, 'Failed to upsert contact');
    throw new Error('Contact upsert failed');
  }

  // Update name if we have pushName and contact doesn't have one
  if (pushName && !contact.name) {
    await supabase().from('contacts').update({ name: pushName }).eq('id', contact.id);
    contact.name = pushName;
  }

  // 2. Find or create active conversation
  let { data: conversation } = await supabase()
    .from('conversations')
    .select('*')
    .eq('contact_id', contact.id)
    .not('state', 'in', '("completed","lost")')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!conversation) {
    // Check bot default active setting
    const { data: botDefaultConfig } = await supabase()
      .from('bot_config')
      .select('value')
      .eq('key', 'bot_default_active')
      .single();

    const isBotActive = botDefaultConfig?.value !== false;

    const { data: newConv, error: convError } = await supabase()
      .from('conversations')
      .insert({ contact_id: contact.id, state: 'greeting', is_bot_active: isBotActive })
      .select('*')
      .single();

    if (convError || !newConv) {
      logger.error({ convError }, 'Failed to create conversation');
      throw new Error('Conversation creation failed');
    }
    conversation = newConv;
  }

  // 3. Check if bot is active
  if (!conversation.is_bot_active) {
    // Just store the message, human is handling
    await storeMessage(conversation.id, contact.id, content, 'inbound', 'customer', evolutionMessageId, mediaUrl, messageType);
    logger.info({ phone }, 'Message stored (human takeover active)');
    return;
  }

  // 4. Store inbound message
  await storeMessage(conversation.id, contact.id, content, 'inbound', 'customer', evolutionMessageId, mediaUrl, messageType);

  // 5. Load products and bot config (cached)
  const [products, botConfigs] = await Promise.all([
    getProducts(),
    getBotConfig(),
  ]);
  const greetingMessage = botConfigs.find((c) => c.key === 'greeting_message')?.value as string | undefined;
  const customPrompt = botConfigs.find((c) => c.key === 'custom_prompt')?.value as string | undefined;
  const activePresetId = (botConfigs.find((c) => c.key === 'active_agent_preset_id')?.value as string) || DEFAULT_PRESET_ID;
  const customAgentPresets = (botConfigs.find((c) => c.key === 'custom_agent_presets')?.value as AgentPreset[]) || [];
  const activePreset = findPreset(activePresetId, customAgentPresets);
  const trainingInsights = await getTrainingInsights();

  // 6. Load recent messages for context (last 20)
  const { data: recentMessages } = await supabase()
    .from('messages')
    .select('*')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: true })
    .limit(10);

  // 7. Generate AI response
  const conversationWithContact = {
    ...conversation,
    contact: { name: contact.name, phone: contact.phone },
  };

  // Build dynamic context as a system message injected at the start of message history
  // This keeps the system prompt static (maximizing cache hit) while still providing fresh state
  const qual = (conversation.qualification_data || {}) as Record<string, unknown>;
  const dynamicContext = [
    `[CONTEXTO ATUAL — atualizado a cada mensagem]`,
    `Estado: ${conversation.state.toUpperCase()}`,
    `Qualificação coletada:`,
    `- Nome: ${qual.customer_name || 'NÃO COLETADO'}`,
    `- Tipo de evento: ${qual.event_type || 'NÃO COLETADO'}`,
    `- Data do evento: ${qual.event_date || 'NÃO COLETADO'}`,
    `- Convidados: ${qual.estimated_guests || 'NÃO COLETADO'}`,
    `- Cidade: ${qual.city || 'NÃO COLETADO'}`,
    `- Orçamento: ${qual.budget_range || 'NÃO COLETADO'}`,
  ].join('\n');

  let aiResponse;
  try {
    aiResponse = await generateResponse(
      conversationWithContact,
      products || [],
      (recentMessages || []).slice(0, -1),
      content,
      dynamicContext,
      async (toolName, input) => executeToolCall(toolName, input, conversation!, contact),
      customPrompt,
      greetingMessage,
      activePreset ? { persona: activePreset.persona, greetingStyle: activePreset.greetingStyle } : undefined,
      trainingInsights || undefined,
    );
  } catch (aiError: any) {
    const errorMessage = aiError?.message || '';
    const statusCode = aiError?.status || aiError?.statusCode || 0;

    const isCreditsExhausted = statusCode === 402 || statusCode === 429
      || errorMessage.includes('credit')
      || errorMessage.includes('billing')
      || errorMessage.includes('rate_limit')
      || errorMessage.includes('overloaded');

    logger.error({ phone, error: errorMessage, statusCode }, 'AI generation failed');

    // Send friendly fallback to customer
    const fallbackText = 'Oi! No momento nosso atendimento automatico esta temporariamente indisponivel. '
      + 'Mas fique tranquilo, nossa equipe ja foi avisada e vai te responder em breve! 😊';

    await storeMessage(conversation.id, contact.id, fallbackText, 'outbound', 'bot');

    try {
      await sendText(phoneNormalized, fallbackText);
    } catch (sendErr) {
      logger.error({ phone, sendErr }, 'Failed to send AI-error fallback message');
    }

    // Disable bot on this conversation so the customer doesn't keep hitting the error
    await supabase()
      .from('conversations')
      .update({ is_bot_active: false })
      .eq('id', conversation.id);

    // Notify admin via WhatsApp
    const reason = isCreditsExhausted ? 'Creditos da IA esgotados ou limite atingido' : `Erro na IA: ${errorMessage.slice(0, 100)}`;
    notifyAdminAIFailure(contact, reason).catch((err) =>
      logger.warn({ err }, 'Failed to notify admin about AI failure'),
    );

    return; // Don't rethrow — message is saved, customer is informed, admin notified
  }

  if (!aiResponse.text) {
    logger.warn({ phone }, 'AI returned empty response');
    return;
  }

  // 8. Store outbound message FIRST (so we never lose the AI response)
  await storeMessage(
    conversation.id,
    contact.id,
    aiResponse.text,
    'outbound',
    'bot',
    undefined,
    undefined,
    undefined,
    aiResponse.model,
    aiResponse.tokensUsed,
    aiResponse.inputTokens,
    aiResponse.outputTokens,
    aiResponse.cacheReadTokens,
    aiResponse.cacheCreationTokens,
  );

  // 9. Send response via WhatsApp (retry built-in, but if it fails the message is already saved)
  try {
    await sendText(phoneNormalized, aiResponse.text);
  } catch (error) {
    logger.error({ phone, error }, 'Failed to send WhatsApp message — response saved in DB for manual retry');
    // Message is already stored, human agent can see it in the dashboard and resend manually
  }

  // 10. Update conversation metadata
  await supabase()
    .from('conversations')
    .update({
      last_message_at: new Date().toISOString(),
      message_count: (conversation.message_count || 0) + 2,
    })
    .eq('id', conversation.id);

  logger.info({ phone, tokens: aiResponse.tokensUsed, tools: aiResponse.toolCalls.length }, 'Response sent');
}

async function storeMessage(
  conversationId: string,
  contactId: string,
  content: string,
  direction: 'inbound' | 'outbound',
  senderType: 'customer' | 'bot' | 'human',
  evolutionMessageId?: string,
  mediaUrl?: string,
  mediaType?: string,
  aiModel?: string,
  aiTokensUsed?: number,
  aiInputTokens?: number,
  aiOutputTokens?: number,
  aiCacheReadTokens?: number,
  aiCacheCreationTokens?: number,
) {
  await supabase().from('messages').insert({
    conversation_id: conversationId,
    contact_id: contactId,
    content,
    direction,
    sender_type: senderType,
    evolution_message_id: evolutionMessageId,
    media_url: mediaUrl,
    media_type: mediaType !== 'conversation' ? mediaType : null,
    ai_model: aiModel,
    ai_tokens_used: aiTokensUsed,
    ai_input_tokens: aiInputTokens,
    ai_output_tokens: aiOutputTokens,
    ai_cache_read_tokens: aiCacheReadTokens,
    ai_cache_creation_tokens: aiCacheCreationTokens,
  });
}

async function executeToolCall(
  toolName: string,
  input: Record<string, unknown>,
  conversation: any,
  contact: any,
): Promise<unknown> {
  switch (toolName) {
    case 'update_conversation_state': {
      const newState = input.new_state as ConversationState;
      await supabase().from('conversations').update({ state: newState }).eq('id', conversation.id);
      conversation.state = newState;
      return { success: true, new_state: newState };
    }

    case 'update_qualification': {
      const currentQual = conversation.qualification_data || {};
      const updatedQual = { ...currentQual, ...input };
      await supabase()
        .from('conversations')
        .update({ qualification_data: updatedQual })
        .eq('id', conversation.id);
      conversation.qualification_data = updatedQual;

      // Also update contact fields
      const contactUpdate: Record<string, unknown> = {};
      if (input.customer_name) contactUpdate.name = input.customer_name;
      if (input.event_type) contactUpdate.event_type = input.event_type;
      if (input.event_date) contactUpdate.event_date = input.event_date;
      if (input.estimated_guests) contactUpdate.estimated_guests = input.estimated_guests;
      if (input.budget_range) contactUpdate.budget_range = input.budget_range;
      if (input.city) contactUpdate.city = input.city;

      if (Object.keys(contactUpdate).length > 0) {
        await supabase().from('contacts').update(contactUpdate).eq('id', contact.id);
      }

      return { success: true, qualification: updatedQual };
    }

    case 'create_or_update_deal': {
      // Check if deal exists for this conversation
      const { data: existingDeal } = await supabase()
        .from('deals')
        .select('id')
        .eq('conversation_id', conversation.id)
        .limit(1)
        .single();

      let productId: string | null = null;
      if (input.product_slug) {
        const { data: product } = await supabase()
          .from('products')
          .select('id')
          .eq('slug', input.product_slug)
          .single();
        productId = product?.id || null;
      }

      const dealData: Record<string, unknown> = {
        stage: input.stage,
      };
      if (productId) dealData.product_id = productId;
      if (input.estimated_value) dealData.estimated_value = input.estimated_value;
      if (input.stage === 'won') dealData.won_at = new Date().toISOString();
      if (input.stage === 'lost') dealData.lost_at = new Date().toISOString();

      if (existingDeal) {
        await supabase().from('deals').update(dealData).eq('id', existingDeal.id);
        return { success: true, deal_id: existingDeal.id, action: 'updated' };
      } else {
        const { data: newDeal } = await supabase()
          .from('deals')
          .insert({
            contact_id: contact.id,
            conversation_id: conversation.id,
            title: (input.title as string) || `${contact.name || 'Lead'} - ${contact.event_type || 'Evento'}`,
            ...dealData,
          })
          .select('id')
          .single();
        return { success: true, deal_id: newDeal?.id, action: 'created' };
      }
    }

    case 'schedule_follow_up': {
      const delayHours = (input.delay_hours as number) || 24;
      const scheduledFor = new Date(Date.now() + delayHours * 60 * 60 * 1000);

      const { data: followUp } = await supabase()
        .from('follow_ups')
        .insert({
          contact_id: contact.id,
          conversation_id: conversation.id,
          scheduled_for: scheduledFor.toISOString(),
          message_template: input.message_template as string,
        })
        .select('id')
        .single();

      // Enqueue the delayed job
      if (followUp) {
        const followUpJob: FollowUpJob = {
          followUpId: followUp.id,
          contactPhone: contact.phone_normalized,
          contactName: contact.name,
          messageTemplate: input.message_template as string,
        };

        await followUpQueue.add('send-follow-up', followUpJob, {
          delay: delayHours * 60 * 60 * 1000,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        });
      }

      return { success: true, follow_up_id: followUp?.id, scheduled_for: scheduledFor.toISOString() };
    }

    case 'log_objection': {
      await supabase().from('objections_log').insert({
        conversation_id: conversation.id,
        contact_id: contact.id,
        objection_type: input.objection_type as string,
        objection_text: input.objection_text as string,
        response_text: input.response_text || '',
        response_technique: input.response_technique as string,
        was_resolved: input.was_resolved as boolean,
      });
      return { success: true };
    }

    case 'escalate_to_human': {
      await supabase()
        .from('conversations')
        .update({ is_bot_active: false, state: 'human_takeover' })
        .eq('id', conversation.id);
      conversation.is_bot_active = false;
      conversation.state = 'human_takeover';
      return { success: true, reason: input.reason };
    }

    case 'check_availability': {
      const slug = input.product_slug as string;
      const date = input.date as string;

      const { data: product } = await supabase()
        .from('products')
        .select('id, name, min_notice_hours')
        .eq('slug', slug)
        .single();
      if (!product) return { error: `Produto não encontrado: ${slug}` };

      const eventDate = new Date(date + 'T00:00:00');
      const hoursUntil = (eventDate.getTime() - Date.now()) / (1000 * 60 * 60);
      const minNoticeOk = !product.min_notice_hours || hoursUntil >= product.min_notice_hours;

      const { data: existing } = await supabase()
        .from('reservations')
        .select('id, status')
        .eq('product_id', product.id)
        .eq('event_date', date)
        .neq('status', 'cancelled')
        .maybeSingle();

      const result: Record<string, unknown> = {
        available: !existing,
        date,
        product: product.name,
        min_notice_ok: minNoticeOk,
        min_notice_hours: product.min_notice_hours,
      };

      if (existing) {
        result.existing_status = existing.status;
      }

      // If this product is unavailable, check which OTHER products are free on the SAME date
      if (existing || !minNoticeOk) {
        const { data: allProducts } = await supabase()
          .from('products')
          .select('id, name, slug')
          .eq('active', true)
          .neq('id', product.id);

        const availableOthers: { name: string; slug: string }[] = [];
        for (const p of allProducts || []) {
          const { data: r } = await supabase()
            .from('reservations')
            .select('id')
            .eq('product_id', p.id)
            .eq('event_date', date)
            .neq('status', 'cancelled')
            .maybeSingle();
          if (!r) availableOthers.push({ name: p.name, slug: p.slug });
        }
        result.other_available_products_for_same_date = availableOthers;
      }

      return result;
    }

    case 'create_reservation': {
      const slug = input.product_slug as string;
      const eventDateStr = input.event_date as string;

      const { data: product } = await supabase()
        .from('products')
        .select('id, name, min_notice_hours')
        .eq('slug', slug)
        .single();
      if (!product) return { error: `Produto não encontrado: ${slug}` };

      const eventDate = new Date(eventDateStr + 'T00:00:00');
      const hoursUntil = (eventDate.getTime() - Date.now()) / (1000 * 60 * 60);
      if (product.min_notice_hours && hoursUntil < product.min_notice_hours) {
        return {
          success: false,
          error: `Antecedência mínima de ${product.min_notice_hours}h não atendida`,
        };
      }

      // Check existing reservation
      const { data: existing } = await supabase()
        .from('reservations')
        .select('id, status')
        .eq('product_id', product.id)
        .eq('event_date', eventDateStr)
        .neq('status', 'cancelled')
        .maybeSingle();

      if (existing) {
        return {
          success: false,
          error: `Data ${eventDateStr} já está reservada para ${product.name} (status: ${existing.status})`,
        };
      }

      // Find deal linked to this conversation
      const { data: deal } = await supabase()
        .from('deals')
        .select('id')
        .eq('conversation_id', conversation.id)
        .limit(1)
        .maybeSingle();

      const { data: reservation, error: insertErr } = await supabase()
        .from('reservations')
        .insert({
          product_id: product.id,
          contact_id: contact.id,
          deal_id: deal?.id || null,
          event_date: eventDateStr,
          status: 'pending',
          created_by: 'bot',
          notes: input.notes as string || null,
        })
        .select('id')
        .single();

      if (insertErr) {
        if (insertErr.code === '23505') {
          return { success: false, error: 'Data já reservada (conflito)' };
        }
        throw insertErr;
      }

      // Fire-and-forget: notify admin via WhatsApp
      notifyAdminNewReservation(contact, product, eventDateStr, input.notes as string | null).catch((err) =>
        logger.warn({ err }, 'Admin notification failed (non-blocking)')
      );

      // Auto-disable bot after successful reservation — human team takes over
      await supabase()
        .from('conversations')
        .update({ is_bot_active: false })
        .eq('id', conversation.id);
      conversation.is_bot_active = false;
      logger.info({ conversationId: conversation.id }, 'Bot auto-disabled after reservation created');

      return {
        success: true,
        reservation_id: reservation?.id,
        status: 'pending',
        product: product.name,
        date: eventDateStr,
        message: 'Reserva tentativa criada. Aguardando confirmação da equipe.',
      };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

async function notifyAdminNewReservation(
  contact: { name: string | null; phone: string },
  product: { name: string },
  eventDate: string,
  notes: string | null,
): Promise<void> {
  const { data: config } = await supabase()
    .from('bot_config')
    .select('value')
    .eq('key', 'admin_whatsapp_number')
    .single();

  const adminPhone = config?.value as string | undefined;
  if (!adminPhone) {
    logger.debug('No admin_whatsapp_number configured, skipping notification');
    return;
  }

  const contactLabel = contact.name || contact.phone;
  const [year, month, day] = eventDate.split('-');
  const dateFormatted = `${day}/${month}/${year}`;

  const message = [
    `*Nova reserva pendente* (via bot)`,
    ``,
    `Cliente: ${contactLabel}`,
    `Telefone: ${contact.phone}`,
    `Produto: ${product.name}`,
    `Data: ${dateFormatted}`,
    notes ? `Notas: ${notes}` : null,
    ``,
    `Acesse o painel para confirmar ou cancelar.`,
  ].filter(Boolean).join('\n');

  await sendText(adminPhone, message);
  logger.info({ adminPhone }, 'Admin notified of new pending reservation');
}

async function notifyAdminAIFailure(
  contact: { name: string | null; phone: string },
  reason: string,
): Promise<void> {
  const { data: config } = await supabase()
    .from('bot_config')
    .select('value')
    .eq('key', 'admin_whatsapp_number')
    .single();

  const adminPhone = config?.value as string | undefined;
  if (!adminPhone) return;

  const contactLabel = contact.name || contact.phone;
  const message = [
    `*⚠️ Bot desativado automaticamente*`,
    ``,
    `Motivo: ${reason}`,
    `Cliente: ${contactLabel} (${contact.phone})`,
    ``,
    `O bot foi desativado nesta conversa. O cliente recebeu uma mensagem de espera.`,
    `Responda manualmente ou reative o bot no painel.`,
  ].join('\n');

  await sendText(adminPhone, message);
  logger.info({ adminPhone }, 'Admin notified of AI failure');
}