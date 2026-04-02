import type { FastifyInstance } from 'fastify';
import { getSupabase } from '../config/supabase.js';
import { sendText } from '../services/evolution-api.js';

export async function messageRoutes(app: FastifyInstance) {
  const supabase = getSupabase();

  // List messages for a conversation
  app.get('/api/v1/messages/:conversationId', async (request) => {
    const { conversationId } = request.params as { conversationId: string };
    const { limit = '50', before } = request.query as Record<string, string>;

    let query = supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).reverse();
  });

  // Send manual message (human agent)
  app.post('/api/v1/messages/send', async (request) => {
    const body = request.body as Record<string, unknown>;
    const conversation_id = body.conversation_id as string;
    const content = body.content as string;

    if (!conversation_id || !content) throw { statusCode: 400, message: 'conversation_id and content are required' };

    // Get conversation with contact
    const { data: conv } = await supabase
      .from('conversations')
      .select('*, contacts(phone_normalized, id)')
      .eq('id', conversation_id)
      .single();

    if (!conv) throw new Error('Conversation not found');

    const contact = conv.contacts as any;

    // Send via WhatsApp
    await sendText(contact.phone_normalized, content);

    // Store message
    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        conversation_id,
        contact_id: contact.id,
        content,
        direction: 'outbound',
        sender_type: 'human',
      })
      .select()
      .single();

    if (error) throw error;

    // Update conversation
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversation_id);

    return message;
  });
}
