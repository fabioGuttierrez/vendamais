'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, cn } from '@/lib/utils';
import { formatPhoneDisplay, CONVERSATION_STATES } from '@vendamais/shared';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageSquare, Bot, User } from 'lucide-react';

type ConversationWithContact = {
  id: string;
  state: string;
  is_bot_active: boolean;
  last_message_at: string | null;
  message_count: number;
  contacts: { id: string; name: string | null; phone: string; phone_normalized: string };
};

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<ConversationWithContact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ data: ConversationWithContact[]; total: number }>('/conversations')
      .then((res) => setConversations(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="animate-pulse"><div className="h-96 bg-muted rounded-lg" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Conversas</h1>

      <div className="bg-white rounded-lg border divide-y">
        {conversations.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhuma conversa ativa</p>
          </div>
        ) : (
          conversations.map((conv) => {
            const stateInfo = CONVERSATION_STATES[conv.state as keyof typeof CONVERSATION_STATES];
            return (
              <Link
                key={conv.id}
                href={`/conversations/${conv.id}`}
                className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center',
                    conv.is_bot_active ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600',
                  )}>
                    {conv.is_bot_active ? <Bot className="h-5 w-5" /> : <User className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="font-medium">{conv.contacts?.name || formatPhoneDisplay(conv.contacts?.phone || '')}</p>
                    <p className="text-sm text-muted-foreground">{stateInfo?.label || conv.state}</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs bg-muted px-2 py-1 rounded-full">{conv.message_count} msgs</span>
                  {conv.last_message_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(conv.last_message_at), 'dd/MM HH:mm', { locale: ptBR })}
                    </p>
                  )}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
