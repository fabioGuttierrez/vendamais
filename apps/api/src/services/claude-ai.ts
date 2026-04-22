import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, ContentBlock, ToolUseBlock, ToolResultBlockParam } from '@anthropic-ai/sdk/resources/messages.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { buildSalesTools } from '../ai/tools.js';
import { buildSystemPrompt } from '../ai/system-prompt.js';
import type { Conversation, Product, Message } from '@vendamais/shared';

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
  timeout: 60_000, // 60s timeout per API call
});

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
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  model: string;
}

export async function generateResponse(
  conversation: ConversationWithContact,
  products: Product[],
  recentMessages: Message[],
  inboundText: string,
  dynamicContext: string,
  executeToolCall: (name: string, input: Record<string, unknown>) => Promise<unknown>,
  customPrompt?: string,
  greetingMessage?: string,
  persona?: { persona: string; greetingStyle: string },
  trainingInsights?: string,
): Promise<AIResponse> {
  const systemPrompt = buildSystemPrompt(conversation, products, customPrompt, greetingMessage, persona, trainingInsights);

  const tools = buildSalesTools(products.filter(p => p.active).map(p => p.slug));

  // Add cache_control to the last tool so the entire tools array is cached
  const toolsWithCache = tools.map((tool, i) =>
    i === tools.length - 1 ? { ...tool, cache_control: { type: 'ephemeral' as const } } : tool,
  );

  // System prompt as cacheable content block (static — no dynamic state here)
  const systemWithCache = [
    { type: 'text' as const, text: systemPrompt, cache_control: { type: 'ephemeral' as const } },
  ];

  // Build message history: inject dynamic context as first user message, then history, then current message
  const messages: MessageParam[] = [
    { role: 'user', content: dynamicContext },
    { role: 'assistant', content: 'Entendido. Vou considerar esse contexto.' },
    ...recentMessages.map((msg) => ({
      role: msg.direction === 'inbound' ? ('user' as const) : ('assistant' as const),
      content: msg.content,
    })),
  ];

  // Add current inbound message
  messages.push({ role: 'user', content: inboundText });

  const allToolCalls: ToolCallResult[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheReadTokens = 0;
  let totalCacheCreationTokens = 0;
  const model = 'claude-sonnet-4-20250514';

  let response = await anthropic.messages.create({
    model,
    max_tokens: 1024,
    system: systemWithCache,
    messages,
    tools: toolsWithCache,
  });

  totalInputTokens += response.usage?.input_tokens || 0;
  totalOutputTokens += response.usage?.output_tokens || 0;
  totalCacheReadTokens += (response.usage as any)?.cache_read_input_tokens || 0;
  totalCacheCreationTokens += (response.usage as any)?.cache_creation_input_tokens || 0;

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
      system: systemWithCache,
      messages,
      tools: toolsWithCache,
    });

    totalInputTokens += response.usage?.input_tokens || 0;
    totalOutputTokens += response.usage?.output_tokens || 0;
    totalCacheReadTokens += (response.usage as any)?.cache_read_input_tokens || 0;
    totalCacheCreationTokens += (response.usage as any)?.cache_creation_input_tokens || 0;
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
      system: systemWithCache,
      messages,
      tools: toolsWithCache,
    });
    totalInputTokens += nudgeResponse.usage?.input_tokens || 0;
    totalOutputTokens += nudgeResponse.usage?.output_tokens || 0;
    totalCacheReadTokens += (nudgeResponse.usage as any)?.cache_read_input_tokens || 0;
    totalCacheCreationTokens += (nudgeResponse.usage as any)?.cache_creation_input_tokens || 0;
    const nudgeText = nudgeResponse.content.find((b): b is ContentBlock & { type: 'text' } => b.type === 'text');
    text = nudgeText?.text ?? '';
  }

  logger.info(
    { cacheRead: totalCacheReadTokens, cacheCreation: totalCacheCreationTokens, input: totalInputTokens, output: totalOutputTokens },
    'AI token usage',
  );

  return {
    text,
    toolCalls: allToolCalls,
    tokensUsed: totalInputTokens + totalOutputTokens,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    cacheReadTokens: totalCacheReadTokens,
    cacheCreationTokens: totalCacheCreationTokens,
    model,
  };
}
