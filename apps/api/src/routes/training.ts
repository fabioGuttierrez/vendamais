import type { FastifyInstance } from 'fastify';
import { getSupabase } from '../config/supabase.js';
import { parseWhatsAppExport } from '../utils/whatsapp-parser.js';
import { analyzeConversation } from '../services/training-analyzer.js';
import { logger } from '../utils/logger.js';

export async function trainingRoutes(app: FastifyInstance) {
  const supabase = getSupabase();

  // Upload and parse a WhatsApp conversation export
  app.post('/api/v1/training/upload', async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    const buffer = await data.toBuffer();
    const rawText = buffer.toString('utf-8');

    // Get outcome from fields
    const outcome = (data.fields.outcome as any)?.value as string;
    if (!outcome || !['positive', 'negative'].includes(outcome)) {
      return reply.status(400).send({ error: 'outcome field is required (positive or negative)' });
    }

    const title = ((data.fields.title as any)?.value as string) || data.filename?.replace(/\.txt$/, '') || 'Conversa sem título';

    // Parse WhatsApp format
    const parsedMessages = parseWhatsAppExport(rawText);
    if (parsedMessages.length < 2) {
      return reply.status(400).send({ error: 'Could not parse messages from file. Ensure it is a WhatsApp export .txt file.' });
    }

    // Save to DB
    const { data: record, error } = await supabase
      .from('training_conversations')
      .insert({
        title,
        outcome,
        raw_text: rawText,
        parsed_messages: parsedMessages,
        message_count: parsedMessages.length,
        analysis_status: 'analyzing',
      })
      .select('*')
      .single();

    if (error || !record) {
      logger.error({ error }, 'Failed to save training conversation');
      return reply.status(500).send({ error: 'Failed to save conversation' });
    }

    // Analyze async (don't block the response)
    analyzeConversation(parsedMessages, outcome as 'positive' | 'negative')
      .then(async (insights) => {
        await supabase
          .from('training_conversations')
          .update({ insights, analysis_status: 'completed' })
          .eq('id', record.id);
        logger.info({ id: record.id }, 'Training conversation analyzed');
      })
      .catch(async (err) => {
        await supabase
          .from('training_conversations')
          .update({ analysis_status: 'failed', analysis_error: err.message })
          .eq('id', record.id);
        logger.error({ id: record.id, error: err.message }, 'Training analysis failed');
      });

    return {
      id: record.id,
      title: record.title,
      outcome: record.outcome,
      messageCount: parsedMessages.length,
      analysisStatus: 'analyzing',
      senders: [...new Set(parsedMessages.map((m) => m.sender))],
    };
  });

  // List all training conversations
  app.get('/api/v1/training', async () => {
    const { data, error } = await supabase
      .from('training_conversations')
      .select('id, title, outcome, message_count, analysis_status, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  });

  // Get single training conversation with details
  app.get('/api/v1/training/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { data, error } = await supabase
      .from('training_conversations')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return reply.status(404).send({ error: 'Not found' });
    }
    return data;
  });

  // Delete training conversation
  app.delete('/api/v1/training/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { error } = await supabase
      .from('training_conversations')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  });

  // Re-analyze a conversation
  app.post('/api/v1/training/:id/reanalyze', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { data: record, error } = await supabase
      .from('training_conversations')
      .select('parsed_messages, outcome')
      .eq('id', id)
      .single();

    if (error || !record) {
      return reply.status(404).send({ error: 'Not found' });
    }

    await supabase
      .from('training_conversations')
      .update({ analysis_status: 'analyzing', analysis_error: null })
      .eq('id', id);

    analyzeConversation(record.parsed_messages as any[], record.outcome as 'positive' | 'negative')
      .then(async (insights) => {
        await supabase
          .from('training_conversations')
          .update({ insights, analysis_status: 'completed' })
          .eq('id', id);
      })
      .catch(async (err) => {
        await supabase
          .from('training_conversations')
          .update({ analysis_status: 'failed', analysis_error: err.message })
          .eq('id', id);
      });

    return { status: 'analyzing' };
  });
}
