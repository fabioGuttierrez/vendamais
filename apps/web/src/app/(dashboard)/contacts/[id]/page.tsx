'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/utils';
import { formatPhoneDisplay, formatBRL, PIPELINE_STAGES } from '@vendamais/shared';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import type { Contact, Conversation, Deal } from '@vendamais/shared';

export default function ContactDetailPage() {
  const params = useParams();
  const [contact, setContact] = useState<Contact | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [deals, setDeals] = useState<(Deal & { products?: { name: string } })[]>([]);

  useEffect(() => {
    api<{ contact: Contact; conversations: Conversation[]; deals: any[] }>(`/contacts/${params.id}`)
      .then((res) => {
        setContact(res.contact);
        setConversations(res.conversations);
        setDeals(res.deals);
      })
      .catch(console.error);
  }, [params.id]);

  if (!contact) return <div className="animate-pulse"><div className="h-64 bg-muted rounded-lg" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/contacts" className="text-muted-foreground hover:text-foreground">&larr; Voltar</Link>
        <h1 className="text-2xl font-bold">{contact.name || 'Sem nome'}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Info */}
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h2 className="font-semibold text-lg">Informações</h2>
          <div className="space-y-3 text-sm">
            <div><span className="text-muted-foreground">Telefone:</span> <span className="font-medium">{formatPhoneDisplay(contact.phone)}</span></div>
            {contact.email && <div><span className="text-muted-foreground">Email:</span> {contact.email}</div>}
            {contact.city && <div><span className="text-muted-foreground">Cidade:</span> {contact.city}/{contact.state}</div>}
            {contact.event_type && <div><span className="text-muted-foreground">Tipo de Evento:</span> {contact.event_type}</div>}
            {contact.event_date && <div><span className="text-muted-foreground">Data do Evento:</span> {format(new Date(contact.event_date), 'dd/MM/yyyy', { locale: ptBR })}</div>}
            {contact.estimated_guests && <div><span className="text-muted-foreground">Convidados:</span> {contact.estimated_guests}</div>}
            {contact.budget_range && <div><span className="text-muted-foreground">Orçamento:</span> {contact.budget_range}</div>}
            <div><span className="text-muted-foreground">Origem:</span> {contact.source}</div>
          </div>
        </div>

        {/* Conversations */}
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h2 className="font-semibold text-lg">Conversas ({conversations.length})</h2>
          <div className="space-y-2">
            {conversations.map((conv) => (
              <Link
                key={conv.id}
                href={`/conversations/${conv.id}`}
                className="block p-3 rounded-md border hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full capitalize">{conv.state.replace('_', ' ')}</span>
                  <span className="text-xs text-muted-foreground">{conv.message_count} msgs</span>
                </div>
                {conv.last_message_at && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {format(new Date(conv.last_message_at), 'dd/MM HH:mm', { locale: ptBR })}
                  </div>
                )}
              </Link>
            ))}
            {conversations.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma conversa</p>}
          </div>
        </div>

        {/* Deals */}
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h2 className="font-semibold text-lg">Negócios ({deals.length})</h2>
          <div className="space-y-2">
            {deals.map((deal) => {
              const stage = PIPELINE_STAGES.find((s) => s.key === deal.stage);
              return (
                <div key={deal.id} className="p-3 rounded-md border">
                  <div className="font-medium text-sm">{deal.title}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: stage?.color + '20', color: stage?.color }}>
                      {stage?.label}
                    </span>
                    {deal.estimated_value && <span className="text-sm font-medium">{formatBRL(deal.estimated_value)}</span>}
                  </div>
                </div>
              );
            })}
            {deals.length === 0 && <p className="text-sm text-muted-foreground">Nenhum negócio</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
