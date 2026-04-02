'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { api, cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { formatPhoneDisplay, CONVERSATION_STATES } from '@vendamais/shared';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import { Bot, User, Send, ArrowLeft } from 'lucide-react';
import type { Message, Conversation, Contact } from '@vendamais/shared';

export default function ConversationDetailPage() {
  const params = useParams();
  const [conversation, setConversation] = useState<Conversation & { contacts: Contact } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    api<{ conversation: any; messages: Message[] }>(`/conversations/${params.id}`)
      .then((res) => {
        setConversation(res.conversation);
        setMessages(res.messages || []);
      })
      .catch(console.error);
  }, [params.id]);

  // Realtime subscription for new messages
  useEffect(() => {
    const channel = supabase
      .channel(`messages:${params.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${params.id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [params.id, supabase]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;
    setSending(true);

    try {
      await api('/messages/send', {
        method: 'POST',
        body: JSON.stringify({ conversation_id: params.id, content: newMessage }),
      });
      setNewMessage('');
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  }

  async function toggleBotActive() {
    if (!conversation) return;
    const newActive = !conversation.is_bot_active;
    await api(`/conversations/${params.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        is_bot_active: newActive,
        state: newActive ? 'greeting' : 'human_takeover',
      }),
    });
    setConversation({ ...conversation, is_bot_active: newActive, state: newActive ? 'greeting' : 'human_takeover' });
  }

  if (!conversation) return <div className="animate-pulse"><div className="h-96 bg-muted rounded-lg" /></div>;

  const contact = conversation.contacts;
  const stateInfo = CONVERSATION_STATES[conversation.state as keyof typeof CONVERSATION_STATES];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="bg-white border rounded-t-lg p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/conversations" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h2 className="font-semibold">{contact?.name || formatPhoneDisplay(contact?.phone || '')}</h2>
            <div className="flex items-center gap-2 text-xs">
              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full">{stateInfo?.label}</span>
              <span className={cn(
                'px-2 py-0.5 rounded-full',
                conversation.is_bot_active ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600',
              )}>
                {conversation.is_bot_active ? 'Bot ativo' : 'Atendimento humano'}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={toggleBotActive}
          className={cn(
            'px-3 py-1.5 text-sm rounded-md font-medium transition-colors',
            conversation.is_bot_active
              ? 'bg-blue-500 text-white hover:bg-blue-600'
              : 'bg-purple-500 text-white hover:bg-purple-600',
          )}
        >
          {conversation.is_bot_active ? 'Assumir Conversa' : 'Devolver ao Bot'}
        </button>
      </div>

      {/* Takeover Banner */}
      {!conversation.is_bot_active && (
        <div className="bg-yellow-50 border-x border-yellow-200 px-4 py-2 text-sm text-yellow-800">
          Bot pausado — Você está atendendo este cliente manualmente
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-gray-50 border-x p-4 space-y-3">
        {messages.map((msg) => {
          const isInbound = msg.direction === 'inbound';
          return (
            <div key={msg.id} className={cn('flex', isInbound ? 'justify-start' : 'justify-end')}>
              <div className={cn(
                'max-w-[70%] rounded-lg px-4 py-2 shadow-sm',
                isInbound
                  ? 'bg-white border'
                  : msg.sender_type === 'bot'
                    ? 'bg-purple-500 text-white'
                    : 'bg-blue-500 text-white',
              )}>
                {!isInbound && (
                  <div className="flex items-center gap-1 mb-1">
                    {msg.sender_type === 'bot' ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
                    <span className="text-xs opacity-80">{msg.sender_type === 'bot' ? 'Bot' : 'Humano'}</span>
                  </div>
                )}
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p className={cn('text-xs mt-1', isInbound ? 'text-muted-foreground' : 'opacity-70')}>
                  {format(new Date(msg.created_at), 'HH:mm', { locale: ptBR })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input (only when human takeover) */}
      {!conversation.is_bot_active && (
        <form onSubmit={handleSend} className="bg-white border rounded-b-lg p-4 flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="flex-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={sending || !newMessage.trim()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      )}

      {conversation.is_bot_active && (
        <div className="bg-white border rounded-b-lg p-4 text-center text-sm text-muted-foreground">
          O bot está atendendo — clique "Assumir Conversa" para enviar mensagens
        </div>
      )}
    </div>
  );
}
