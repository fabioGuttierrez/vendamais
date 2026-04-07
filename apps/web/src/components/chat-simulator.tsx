'use client';

import { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/utils';
import type { AgentPreset } from '@vendamais/shared';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: { toolName: string; input: Record<string, unknown> }[];
}

interface ChatSimulatorProps {
  presetId: string;
  customPresets: AgentPreset[];
  greetingMessage?: string;
  customPrompt?: string;
  presetName: string;
  onClose: () => void;
}

const TOOL_LABELS: Record<string, string> = {
  update_conversation_state: 'Estado',
  update_qualification: 'Qualificacao',
  create_or_update_deal: 'Deal',
  schedule_follow_up: 'Follow-up',
  log_objection: 'Objecao',
  escalate_to_human: 'Escalar',
};

export function ChatSimulator({ presetId, customPresets, greetingMessage, customPrompt, presetName, onClose }: ChatSimulatorProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationState, setConversationState] = useState('greeting');
  const [qualificationData, setQualificationData] = useState<Record<string, unknown>>({});
  const [tokensTotal, setTokensTotal] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const history = updatedMessages.map((m) => ({ role: m.role, content: m.content }));

      const res = await api<{
        text: string;
        toolCalls: { toolName: string; input: Record<string, unknown> }[];
        tokensUsed: number;
        conversationState: string;
        qualificationData: Record<string, unknown>;
      }>('/agent-test/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: text,
          history: history.slice(0, -1), // exclude current message (sent separately)
          presetId,
          greetingMessage: greetingMessage || undefined,
          customPrompt: customPrompt || undefined,
          conversationState,
          qualificationData,
        }),
      });

      const botMsg: ChatMessage = {
        role: 'assistant',
        content: res.text,
        toolCalls: res.toolCalls.length > 0 ? res.toolCalls : undefined,
      };

      setMessages([...updatedMessages, botMsg]);
      setConversationState(res.conversationState);
      setQualificationData(res.qualificationData);
      setTokensTotal((prev) => prev + res.tokensUsed);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: `[Erro: ${err.message || 'Falha ao gerar resposta'}]`,
      };
      setMessages([...updatedMessages, errorMsg]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function clearChat() {
    setMessages([]);
    setConversationState('greeting');
    setQualificationData({});
    setTokensTotal(0);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl flex flex-col w-full max-w-lg h-[85vh] mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50 rounded-t-xl">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <div>
              <span className="font-semibold text-sm">{presetName}</span>
              <span className="text-xs text-muted-foreground ml-2">Simulacao</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{tokensTotal} tokens</span>
            <button
              onClick={clearChat}
              className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
              title="Limpar conversa"
            >
              Limpar
            </button>
            <button
              onClick={onClose}
              className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>

        {/* State badge */}
        <div className="px-4 py-1.5 bg-gray-50 border-b flex items-center gap-2 text-xs text-muted-foreground">
          <span>Estado: <strong className="text-gray-700">{conversationState}</strong></span>
          {qualificationData.customer_name ? (
            <span>| Nome: <strong className="text-gray-700">{String(qualificationData.customer_name)}</strong></span>
          ) : null}
          {qualificationData.event_type ? (
            <span>| Evento: <strong className="text-gray-700">{String(qualificationData.event_type)}</strong></span>
          ) : null}
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Envie uma mensagem para testar o agente
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i}>
              {/* Tool calls badges (shown before bot message) */}
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1 ml-1">
                  {msg.toolCalls.map((tc, j) => (
                    <span
                      key={j}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500 rounded-full"
                      title={JSON.stringify(tc.input, null, 2)}
                    >
                      {TOOL_LABELS[tc.toolName] || tc.toolName}
                      {tc.toolName === 'update_conversation_state' && (
                        <span className="text-gray-400">→ {tc.input.new_state as string}</span>
                      )}
                    </span>
                  ))}
                </div>
              )}

              {/* Message bubble */}
              <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-gray-100 text-gray-900 rounded-bl-md'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 px-4 py-2 rounded-2xl rounded-bl-md">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t p-3 bg-white rounded-b-xl">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite uma mensagem..."
              className="flex-1 px-3 py-2 border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
