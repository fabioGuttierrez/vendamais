import { getSupabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { toE164 } from '@vendamais/shared';
import { sendText } from './evolution-api.js';
import { generateResponse } from './claude-ai.js';
import { followUpQueue } from '../queues/connection.js';
import type { InboundMessageJob } from '../queues/message.worker.js';
import type { FollowUpJob } from '../queues/follow-up.worker.js';
import type { ConversationState } from '@vendamais/shared';

const supabase = () => getSupabase();

export async function processInboundMessage(job: InboundMessageJob): Promise<void> {
  const { phoneNormalized, pushName, content, messageType, mediaUrl, evolutionMessageId } = job;
  const phone = toE164(phoneNormalized);

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

  // 5. Load products and bot config
  const [productsRes, botConfigRes] = await Promise.all([
    supabase().from('products').select('*').eq('active', true).order('sort_order'),
    supabase().from('bot_config').select('key, value'),
  ]);

  const products = productsRes.data;
  const botConfigs = botConfigRes.data || [];
  const greetingMessage = botConfigs.find((c) => c.key === 'greeting_message')?.value as string | undefined;
  const customPrompt = botConfigs.find((c) => c.key === 'custom_prompt')?.value as string | undefined;

  // 6. Load recent messages for context (last 20)
  const { data: recentMessages } = await supabase()
    .from('messages')
    .select('*')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: true })
    .limit(20);

  // 7. Generate AI response
  const conversationWithContact = {
    ...conversation,
    contact: { name: contact.name, phone: contact.phone },
  };

  const aiResponse = await generateResponse(
    conversationWithContact,
    products || [],
    (recentMessages || []).slice(0, -1), // exclude current inbound (we pass it separately)
    content,
    async (toolName, input) => executeToolCall(toolName, input, conversation!, contact),
    customPrompt,
    greetingMessage,
  );

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

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
