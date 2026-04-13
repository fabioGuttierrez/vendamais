'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/utils';
import { formatBRL } from '@vendamais/shared';
import { Users, MessageSquare, TrendingUp, DollarSign, Target, Zap, CalendarDays, Check, X, Bot } from 'lucide-react';

interface Overview {
  total_contacts: number;
  active_conversations: number;
  total_messages: number;
  won_deals: number;
  total_revenue: number;
  conversion_rate: number;
  pipeline_value: number;
  total_deals: number;
}

interface PendingReservation {
  id: string;
  event_date: string;
  status: string;
  notes: string | null;
  created_by: string;
  products: { id: string; name: string; slug: string } | null;
  contacts: { id: string; name: string | null; phone: string } | null;
}

interface CostSummary {
  conversations: Array<{
    conversation_id: string;
    contact_name: string | null;
    contact_phone: string | null;
    state: string | null;
    ai_message_count: number;
    input_tokens: number;
    output_tokens: number;
    cost_brl: number;
  }>;
  totals: {
    total_cost_brl: number;
    total_input_tokens: number;
    total_output_tokens: number;
    total_conversations: number;
  };
  usd_brl_rate: number;
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <div className="bg-white rounded-lg border p-6 flex items-start gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [pendingReservations, setPendingReservations] = useState<PendingReservation[]>([]);
  const [costData, setCostData] = useState<CostSummary | null>(null);

  useEffect(() => {
    api<Overview>('/analytics/overview').then(setData).catch(console.error);
    api<PendingReservation[]>('/analytics/pending-reservations')
      .then(setPendingReservations)
      .catch(console.error);
    api<CostSummary>('/analytics/conversation-costs?limit=10')
      .then(setCostData)
      .catch(console.error);
  }, []);

  async function handleConfirm(id: string) {
    try {
      await api(`/reservations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'confirmed' }),
      });
      setPendingReservations((prev) => prev.filter((r) => r.id !== id));
      toast.success('Reserva confirmada!');
    } catch (err) {
      console.error('Failed to confirm reservation:', err);
      toast.error('Erro ao confirmar reserva');
    }
  }

  async function handleCancel(id: string) {
    if (!confirm('Cancelar esta reserva?')) return;
    try {
      await api(`/reservations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled' }),
      });
      setPendingReservations((prev) => prev.filter((r) => r.id !== id));
      toast.success('Reserva cancelada');
    } catch (err) {
      console.error('Failed to cancel reservation:', err);
      toast.error('Erro ao cancelar reserva');
    }
  }

  if (!data) {
    return <div className="animate-pulse space-y-4"><div className="h-32 bg-muted rounded-lg" /><div className="h-32 bg-muted rounded-lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total de Contatos" value={String(data.total_contacts)} icon={Users} color="bg-blue-500" />
        <StatCard label="Conversas Ativas" value={String(data.active_conversations)} icon={MessageSquare} color="bg-green-500" />
        <StatCard label="Total de Mensagens" value={String(data.total_messages)} icon={Zap} color="bg-purple-500" />
        <StatCard label="Negócios Ganhos" value={String(data.won_deals)} icon={Target} color="bg-emerald-500" />
        <StatCard label="Receita Total" value={formatBRL(data.total_revenue)} icon={DollarSign} color="bg-yellow-500" />
        <StatCard label="Taxa de Conversão" value={`${data.conversion_rate}%`} icon={TrendingUp} color="bg-indigo-500" />
        <StatCard label="Custo IA (Total)" value={costData ? formatBRL(costData.totals.total_cost_brl) : 'R$ 0,00'} icon={Bot} color="bg-red-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Pipeline de Vendas</h2>
          <div className="text-3xl font-bold text-primary">{formatBRL(data.pipeline_value)}</div>
          <p className="text-sm text-muted-foreground">{data.total_deals} negócios no pipeline</p>
        </div>
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Performance</h2>
          <div className="text-3xl font-bold text-green-600">{data.conversion_rate}%</div>
          <p className="text-sm text-muted-foreground">taxa de conversão geral</p>
        </div>
      </div>

      {/* Pendencias - Pending Reservations */}
      {pendingReservations.length > 0 && (
        <div className="bg-white rounded-lg border">
          <div className="p-4 border-b flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold">Pendencias</h2>
            <span className="ml-auto text-sm text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-full">
              {pendingReservations.length}
            </span>
          </div>
          <div className="divide-y">
            {pendingReservations.map((r) => (
              <div key={r.id} className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{r.products?.name || 'Produto'}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      r.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {r.status === 'pending' ? 'Pendente' : 'Em Analise'}
                    </span>
                    {r.created_by === 'bot' && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
                        via Bot
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {r.contacts?.name || r.contacts?.phone || 'Sem contato'} - {new Date(r.event_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </p>
                  {r.notes && <p className="text-xs text-muted-foreground truncate mt-0.5">{r.notes}</p>}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleConfirm(r.id)}
                    className="p-2 bg-green-50 text-green-600 border border-green-200 rounded-md hover:bg-green-100"
                    title="Confirmar"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleCancel(r.id)}
                    className="p-2 bg-red-50 text-red-600 border border-red-200 rounded-md hover:bg-red-100"
                    title="Cancelar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custo por Conversa */}
      {costData && costData.conversations.length > 0 && (
        <div className="bg-white rounded-lg border">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Custo por Conversa (IA)</h2>
            <p className="text-sm text-muted-foreground">
              Taxa: 1 USD = {costData.usd_brl_rate.toFixed(2)} BRL | {costData.totals.total_conversations} conversa(s)
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3">Contato</th>
                  <th className="text-right p-3">Msgs IA</th>
                  <th className="text-right p-3">Tokens In</th>
                  <th className="text-right p-3">Tokens Out</th>
                  <th className="text-right p-3">Custo</th>
                </tr>
              </thead>
              <tbody>
                {costData.conversations.map((c) => (
                  <tr key={c.conversation_id} className="border-b">
                    <td className="p-3">{c.contact_name || c.contact_phone || 'Desconhecido'}</td>
                    <td className="text-right p-3">{c.ai_message_count}</td>
                    <td className="text-right p-3 text-muted-foreground">{c.input_tokens.toLocaleString('pt-BR')}</td>
                    <td className="text-right p-3 text-muted-foreground">{c.output_tokens.toLocaleString('pt-BR')}</td>
                    <td className="text-right p-3 font-medium">{formatBRL(c.cost_brl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
