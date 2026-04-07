import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, ContentBlock, ToolUseBlock, ToolResultBlockParam } from '@anthropic-ai/sdk/resources/messages.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { salesTools } from '../ai/tools.js';
import { buildSystemPrompt } from '../ai/system-prompt.js';
import type { Conversation, Product, Message } from '@vendamais/shared';

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

interface ConversationWithContact extends Conversation {
  contact: { name: string | null; phone: string };
}

interface ToolCallResult {
  toolName: string;
  input: Record<string, unknown>;
  result: unknown;
}

export interface AIResponse {
  text: string;
  toolCalls: ToolCallResult[];
  tokensUsed: number;
  model: string;
}

export async function generateResponse(
  conversation: ConversationWithContact,
  products: Product[],
  recentMessages: Message[],
  inboundText: string,
  executeToolCall: (name: string, input: Record<string, unknown>) => Promise<unknown>,
  customPrompt?: string,
  greetingMessage?: string,
  persona?: { persona: string; greetingStyle: string },
  trainingInsights?: string,
): Promise<AIResponse> {
  const systemPrompt = buildSystemPrompt(conversation, products, customPrompt, greetingMessage, persona, trainingInsights);

  // Build message history from recent messages
  const messages: MessageParam[] = recentMessages.map((msg) => ({
    role: msg.direction === 'inbound' ? ('user' as const) : ('assistant' as const),
    content: msg.content,
  }));

  // Add current inbound message
  messages.push({ role: 'user', content: inboundText });

  const allToolCalls: ToolCallResult[] = [];
  let totalTokens = 0;
  const model = 'claude-sonnet-4-20250514';

  let response = await anthropic.messages.create({
    model,
    max_tokens: 1024,
    system: systemPrompt,
    messages,
    tools: salesTools,
  });

  totalTokens += (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

  // Tool calling loop
  while (response.stop_reason === 'tool_use') {
    const toolUseBlocks = response.content.filter(
      (b): b is ToolUseBlock => b.type === 'tool_use',
    );

    const toolResults: ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      logger.info({ tool: toolUse.name, input: toolUse.input }, 'Executing AI tool');

      try {
        const result = await executeToolCall(toolUse.name, toolUse.input as Record<string, unknown>);
        allToolCalls.push({ toolName: toolUse.name, input: toolUse.input as Record<string, unknown>, result });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      } catch (error) {
        logger.error({ tool: toolUse.name, error }, 'Tool execution failed');
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify({ error: 'Tool execution failed' }),
          is_error: true,
        });
      }
    }

    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user', content: toolResults });

    response = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
      tools: salesTools,
    });

    totalTokens += (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);
  }

  // Extract text response
  const textBlock = response.content.find((b): b is ContentBlock & { type: 'text' } => b.type === 'text');
  let text = textBlock?.text ?? '';

  // Safety net: if Claude returned no text after tool calls, nudge it to respond
  if (!text.trim() && allToolCalls.length > 0) {
    logger.warn('Claude returned no text after tool calls, nudging for response');
    messages.push({ role: 'assistant', content: response.content });
    messages.push({
      role: 'user',
      content: 'Por favor, envie agora sua resposta para o cliente via WhatsApp.',
    });
    const nudgeResponse = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
      tools: salesTools,
    });
    totalTokens += (nudgeResponse.usage?.input_tokens || 0) + (nudgeResponse.usage?.output_tokens || 0);
    const nudgeText = nudgeResponse.content.find((b): b is ContentBlock & { type: 'text' } => b.type === 'text');
    text = nudgeText?.text ?? '';
  }

  return { text, toolCalls: allToolCalls, tokensUsed: totalTokens, model };
}
