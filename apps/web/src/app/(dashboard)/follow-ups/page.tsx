'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarClock, Check, X } from 'lucide-react';
import type { FollowUp } from '@vendamais/shared';

type FollowUpWithRelations = FollowUp & { contacts?: { name: string; phone: string }; conversations?: { state: string } };

export default function FollowUpsPage() {
  const [followUps, setFollowUps] = useState<FollowUpWithRelations[]>([]);
  const [tab, setTab] = useState<'pending' | 'sent'>('pending');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api<FollowUpWithRelations[]>(`/follow-ups?status=${tab}`)
      .then(setFollowUps)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [tab]);

  async function cancelFollowUp(id: string) {
    await api(`/follow-ups/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) });
    setFollowUps((prev) => prev.filter((f) => f.id !== id));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Follow-ups</h1>

      <div className="flex gap-2">
        <button
          onClick={() => setTab('pending')}
          className={`px-4 py-2 text-sm rounded-md font-medium ${tab === 'pending' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
        >
          Pendentes
        </button>
        <button
          onClick={() => setTab('sent')}
          className={`px-4 py-2 text-sm rounded-md font-medium ${tab === 'sent' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
        >
          Enviados
        </button>
      </div>

      <div className="bg-white rounded-lg border divide-y">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : followUps.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CalendarClock className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum follow-up {tab === 'pending' ? 'pendente' : 'enviado'}</p>
          </div>
        ) : (
          followUps.map((fu) => (
            <div key={fu.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{fu.contacts?.name || 'Contato'}</p>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{fu.message_template}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {tab === 'pending' ? 'Agendado: ' : 'Enviado: '}
                  {format(new Date(tab === 'pending' ? fu.scheduled_for : fu.sent_at!), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
              {tab === 'pending' && (
                <button
                  onClick={() => cancelFollowUp(fu.id)}
                  className="p-2 text-destructive hover:bg-destructive/10 rounded-md"
                  title="Cancelar follow-up"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              {tab === 'sent' && <Check className="h-5 w-5 text-green-500" />}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
