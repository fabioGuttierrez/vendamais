'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/utils';
import { PIPELINE_STAGES, formatBRL } from '@vendamais/shared';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const OBJECTION_COLORS = ['#6366f1', '#f59e0b', '#ef4444', '#22c55e', '#3b82f6', '#8b5cf6'];

export default function AnalyticsPage() {
  const [funnel, setFunnel] = useState<any[]>([]);
  const [objections, setObjections] = useState<any[]>([]);
  const [dailyMessages, setDailyMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<any[]>('/analytics/funnel'),
      api<any[]>('/analytics/objections'),
      api<any[]>('/analytics/messages-daily'),
    ])
      .then(([f, o, m]) => {
        setFunnel(f.map((d: any) => ({
          ...d,
          label: PIPELINE_STAGES.find((s) => s.key === d.stage)?.label || d.stage,
          color: PIPELINE_STAGES.find((s) => s.key === d.stage)?.color || '#6366f1',
        })));
        setObjections(o);
        setDailyMessages(m.reverse().slice(-14));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-64 bg-muted rounded-lg" /><div className="h-64 bg-muted rounded-lg" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversion Funnel */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="font-semibold text-lg mb-4">Funil de Conversão</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={funnel}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="deal_count" fill="#6366f1" name="Negócios" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Message Volume */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="font-semibold text-lg mb-4">Volume de Mensagens (14 dias)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyMessages}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="inbound" stroke="#3b82f6" name="Recebidas" strokeWidth={2} />
              <Line type="monotone" dataKey="outbound" stroke="#22c55e" name="Enviadas" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Objections */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="font-semibold text-lg mb-4">Objeções</h2>
          {objections.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Sem dados de objeções</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={objections}
                  dataKey="occurrence_count"
                  nameKey="objection_type"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ objection_type, occurrence_count }) => `${objection_type}: ${occurrence_count}`}
                >
                  {objections.map((_, i) => (
                    <Cell key={i} fill={OBJECTION_COLORS[i % OBJECTION_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Resolution Rate */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="font-semibold text-lg mb-4">Taxa de Resolução de Objeções</h2>
          {objections.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={objections} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} unit="%" />
                <YAxis dataKey="objection_type" type="category" tick={{ fontSize: 12 }} width={80} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Bar dataKey="resolution_rate" fill="#22c55e" name="Resolução" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
