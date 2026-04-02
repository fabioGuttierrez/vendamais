'use client';

import { useEffect, useState } from 'react';
import { api, cn } from '@/lib/utils';
import { PIPELINE_STAGES, formatBRL } from '@vendamais/shared';
import type { Deal } from '@vendamais/shared';

type DealWithRelations = Deal & { contacts?: { name: string; phone: string; event_type: string }; products?: { name: string } };

export default function PipelinePage() {
  const [deals, setDeals] = useState<DealWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<DealWithRelations[]>('/deals')
      .then(setDeals)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleStageChange(dealId: string, newStage: string) {
    await api(`/deals/${dealId}`, {
      method: 'PATCH',
      body: JSON.stringify({ stage: newStage }),
    });
    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage: newStage as any } : d)));
  }

  if (loading) return <div className="animate-pulse"><div className="h-96 bg-muted rounded-lg" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Pipeline de Vendas</h1>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map((stage) => {
          const stageDeals = deals.filter((d) => d.stage === stage.key);
          const totalValue = stageDeals.reduce((s, d) => s + (d.estimated_value || 0), 0);

          return (
            <div key={stage.key} className="flex-shrink-0 w-72">
              <div className="rounded-lg border bg-white">
                {/* Column Header */}
                <div className="p-3 border-b" style={{ borderTopColor: stage.color, borderTopWidth: 3 }}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">{stage.label}</h3>
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{stageDeals.length}</span>
                  </div>
                  {totalValue > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">{formatBRL(totalValue)}</p>
                  )}
                </div>

                {/* Cards */}
                <div className="p-2 space-y-2 min-h-[200px]">
                  {stageDeals.map((deal) => (
                    <div
                      key={deal.id}
                      className="p-3 rounded-md border bg-white hover:shadow-sm transition-shadow cursor-pointer"
                    >
                      <p className="font-medium text-sm">{deal.title}</p>
                      {deal.contacts && (
                        <p className="text-xs text-muted-foreground mt-1">{deal.contacts.name}</p>
                      )}
                      {deal.products && (
                        <p className="text-xs text-primary mt-1">{deal.products.name}</p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        {deal.estimated_value && (
                          <span className="text-xs font-medium">{formatBRL(deal.estimated_value)}</span>
                        )}
                        <select
                          value={deal.stage}
                          onChange={(e) => handleStageChange(deal.id, e.target.value)}
                          className="text-xs border rounded px-1 py-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {PIPELINE_STAGES.map((s) => (
                            <option key={s.key} value={s.key}>{s.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}

                  {stageDeals.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-8">Vazio</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
