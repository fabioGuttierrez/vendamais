'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/utils';
import { formatBRL } from '@vendamais/shared';
import { Users, MessageSquare, TrendingUp, DollarSign, Target, Zap } from 'lucide-react';

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

  useEffect(() => {
    api<Overview>('/analytics/overview').then(setData).catch(console.error);
  }, []);

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
    </div>
  );
}
