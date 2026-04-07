'use client';

import { useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/utils';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  addMonths,
  subMonths,
  isSameMonth,
  isToday,
  isBefore,
  startOfDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Product, Reservation } from '@vendamais/shared';

type ReservationWithRelations = Reservation & {
  products: { id: string; name: string; slug: string } | null;
  contacts: { id: string; name: string | null; phone: string } | null;
};

const PRODUCT_COLORS = ['#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899', '#10b981'];

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  in_analysis: 'Em Análise',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
};

const STATUS_BADGE_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  in_analysis: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700 line-through',
};

export default function ReservationsPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [reservations, setReservations] = useState<ReservationWithRelations[]>([]);
  const [upcomingConfirmed, setUpcomingConfirmed] = useState<ReservationWithRelations[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<ReservationWithRelations | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  // Create form state
  const [createForm, setCreateForm] = useState({
    product_id: '',
    contact_search: '',
    notes: '',
    status: 'pending' as string,
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Cancel modal
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  function refreshUpcoming() {
    api<ReservationWithRelations[]>('/reservations?status=confirmed')
      .then((data) => {
        const today = startOfDay(new Date());
        const future = data.filter((r) => !isBefore(new Date(r.event_date + 'T00:00:00'), today));
        future.sort((a, b) => a.event_date.localeCompare(b.event_date));
        setUpcomingConfirmed(future);
      })
      .catch(console.error);
  }

  useEffect(() => {
    api<Product[]>('/products').then(setProducts).catch(console.error);
    // Load upcoming confirmed reservations (no month filter — all future confirmed)
    api<ReservationWithRelations[]>('/reservations?status=confirmed')
      .then((data) => {
        const today = startOfDay(new Date());
        const future = data.filter((r) => !isBefore(new Date(r.event_date + 'T00:00:00'), today));
        future.sort((a, b) => a.event_date.localeCompare(b.event_date));
        setUpcomingConfirmed(future);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    const monthStr = format(currentMonth, 'yyyy-MM');
    let url = `/reservations?month=${monthStr}`;
    if (selectedProduct) url += `&product_id=${selectedProduct}`;
    api<ReservationWithRelations[]>(url)
      .then(setReservations)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentMonth, selectedProduct]);

  const productColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    products.forEach((p, i) => {
      map[p.id] = PRODUCT_COLORS[i % PRODUCT_COLORS.length];
    });
    return map;
  }, [products]);

  // Calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  function getReservationsForDate(date: Date): ReservationWithRelations[] {
    const dateStr = format(date, 'yyyy-MM-dd');
    return reservations.filter((r) => r.event_date === dateStr);
  }

  async function handleCreateReservation() {
    if (!createForm.product_id || !selectedDate) return;
    setCreating(true);
    setCreateError('');
    try {
      const newRes = await api<ReservationWithRelations>('/reservations', {
        method: 'POST',
        body: JSON.stringify({
          product_id: createForm.product_id,
          event_date: selectedDate,
          notes: createForm.notes || null,
          status: createForm.status,
        }),
      });
      setReservations((prev) => [...prev, newRes]);
      setShowCreateModal(false);
      setCreateForm({ product_id: '', contact_search: '', notes: '', status: 'pending' });
      refreshUpcoming();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar reserva';
      if (msg.includes('409') || msg.includes('conflict') || msg.includes('já existe')) {
        setCreateError('Já existe uma reserva ativa para este produto nesta data');
      } else {
        setCreateError(msg);
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdateStatus(id: string, status: string, reason?: string) {
    const payload: Record<string, unknown> = { status };
    if (reason) payload.cancelled_reason = reason;
    try {
      const updated = await api<ReservationWithRelations>(`/reservations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setReservations((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated } : r)));
      if (selectedReservation?.id === id) {
        setSelectedReservation({ ...selectedReservation, ...updated });
      }
      setShowCancelModal(false);
      setCancelReason('');
      refreshUpcoming();
    } catch (err) {
      console.error('Failed to update reservation:', err);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api(`/reservations/${id}`, { method: 'DELETE' });
      setReservations((prev) => prev.filter((r) => r.id !== id));
      setSelectedReservation(null);
    } catch (err) {
      console.error('Failed to delete reservation:', err);
    }
  }

  function openCreateForDate(dateStr: string) {
    setSelectedDate(dateStr);
    setCreateError('');
    setShowCreateModal(true);
  }

  // Stats
  const activeReservations = reservations.filter((r) => r.status !== 'cancelled');
  const confirmedCount = reservations.filter((r) => r.status === 'confirmed').length;
  const pendingCount = reservations.filter((r) => r.status === 'pending' || r.status === 'in_analysis').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Reservas</h1>
          <div className="flex bg-gray-100 rounded-md p-0.5">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                viewMode === 'calendar' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              Calendario
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                viewMode === 'list' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              Proximos Eventos
            </button>
          </div>
        </div>
        <button
          onClick={() => {
            setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
            setCreateError('');
            setShowCreateModal(true);
          }}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90"
        >
          + Nova Reserva
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total Ativas</p>
          <p className="text-2xl font-bold">{activeReservations.length}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Confirmadas</p>
          <p className="text-2xl font-bold text-green-600">{confirmedCount}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Pendentes</p>
          <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
        </div>
      </div>

      {/* Month Navigator + Product Filter */}
      {viewMode === 'calendar' && (
      <>
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 hover:bg-gray-100 rounded-md text-sm"
            >
              &larr;
            </button>
            <h2 className="text-lg font-semibold capitalize min-w-[180px] text-center">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </h2>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 hover:bg-gray-100 rounded-md text-sm"
            >
              &rarr;
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedProduct(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedProduct === null
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Todos
            </button>
            {products.filter((p) => p.active).map((p, i) => (
              <button
                key={p.id}
                onClick={() => setSelectedProduct(selectedProduct === p.id ? null : p.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  selectedProduct === p.id
                    ? 'text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={selectedProduct === p.id ? { backgroundColor: PRODUCT_COLORS[i % PRODUCT_COLORS.length] } : {}}
              >
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ backgroundColor: PRODUCT_COLORS[i % PRODUCT_COLORS.length] }}
                />
                {p.name.replace('Plataforma 360 ', '').replace('Espelho Mágico ', '')}
              </button>
            ))}
          </div>
        </div>

        {/* Calendar Grid */}
        {loading ? (
          <div className="animate-pulse space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {/* Week day headers */}
            {weekDays.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2 border-b">
                {d}
              </div>
            ))}
            {/* Day cells */}
            {calendarDays.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayReservations = getReservationsForDate(day);
              const inMonth = isSameMonth(day, currentMonth);
              const today = isToday(day);

              return (
                <div
                  key={dateStr}
                  onClick={() => openCreateForDate(dateStr)}
                  className={`min-h-[80px] border border-gray-100 p-1.5 cursor-pointer transition-colors hover:bg-gray-50 ${
                    !inMonth ? 'bg-gray-50/50' : ''
                  }`}
                >
                  <div className={`text-xs font-medium mb-1 ${
                    today
                      ? 'bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center'
                      : inMonth
                        ? 'text-gray-700'
                        : 'text-gray-300'
                  }`}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-0.5">
                    {dayReservations.map((res) => {
                      const color = productColorMap[res.product_id] || '#6b7280';
                      const isCancelled = res.status === 'cancelled';
                      return (
                        <button
                          key={res.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedReservation(res);
                          }}
                          className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium truncate transition-opacity ${
                            isCancelled ? 'opacity-40 line-through' : 'opacity-90 hover:opacity-100'
                          }`}
                          style={{
                            backgroundColor: color + '20',
                            color: color,
                            borderLeft: `3px solid ${color}`,
                          }}
                          title={`${res.products?.name || 'Produto'} - ${STATUS_LABELS[res.status]}`}
                        >
                          {res.products?.name?.replace('Plataforma 360 ', 'P360 ').replace('Espelho Mágico ', 'EM ') || '?'}
                          {res.status === 'confirmed' && ' \u2713'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-300" /> Pendente
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-blue-100 border border-blue-300" /> Em Análise
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-green-100 border border-green-300" /> Confirmada
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-red-100 border border-red-300 line-through" /> Cancelada
        </span>
      </div>
      </>
      )}

      {/* Upcoming Confirmed Events List */}
      {viewMode === 'list' && (
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-lg">Proximos Eventos Confirmados</h2>
          <p className="text-sm text-muted-foreground">Reservas confirmadas a partir de hoje</p>
        </div>
        {upcomingConfirmed.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <p className="text-sm">Nenhuma reserva confirmada para os proximos dias</p>
          </div>
        ) : (
          <div className="divide-y">
            {upcomingConfirmed.map((res) => {
              const color = productColorMap[res.product_id] || '#6b7280';
              const eventDate = new Date(res.event_date + 'T00:00:00');
              const today = startOfDay(new Date());
              const diffDays = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              const isUrgent = diffDays <= 7;

              return (
                <button
                  key={res.id}
                  onClick={() => setSelectedReservation(res)}
                  className="w-full text-left p-4 hover:bg-gray-50 transition-colors flex items-center gap-4"
                >
                  {/* Date block */}
                  <div className={`flex-shrink-0 w-16 h-16 rounded-lg flex flex-col items-center justify-center ${
                    isUrgent ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-200'
                  }`}>
                    <span className={`text-xs font-medium uppercase ${isUrgent ? 'text-red-500' : 'text-muted-foreground'}`}>
                      {format(eventDate, 'MMM', { locale: ptBR })}
                    </span>
                    <span className={`text-xl font-bold ${isUrgent ? 'text-red-700' : 'text-foreground'}`}>
                      {format(eventDate, 'dd')}
                    </span>
                    <span className={`text-[10px] ${isUrgent ? 'text-red-500' : 'text-muted-foreground'}`}>
                      {format(eventDate, 'EEE', { locale: ptBR })}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="font-medium text-sm truncate">{res.products?.name || 'Produto'}</span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {res.contacts?.name || res.contacts?.phone || 'Sem contato vinculado'}
                    </p>
                    {res.notes && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{res.notes}</p>
                    )}
                  </div>

                  {/* Countdown */}
                  <div className="flex-shrink-0 text-right">
                    {diffDays === 0 ? (
                      <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">HOJE</span>
                    ) : diffDays === 1 ? (
                      <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">AMANHA</span>
                    ) : isUrgent ? (
                      <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                        {diffDays} dias
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {diffDays} dias
                      </span>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {res.created_by === 'bot' ? 'via Agente' : 'manual'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* Reservation Detail Panel */}
      {selectedReservation && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setSelectedReservation(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Detalhes da Reserva</h3>
              <button onClick={() => setSelectedReservation(null)} className="text-muted-foreground hover:text-foreground">
                &#10005;
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE_STYLES[selectedReservation.status]}`}>
                  {STATUS_LABELS[selectedReservation.status]}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Produto</span>
                <span className="text-sm font-medium">{selectedReservation.products?.name || '-'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Data</span>
                <span className="text-sm font-medium">
                  {format(new Date(selectedReservation.event_date + 'T00:00:00'), 'dd/MM/yyyy')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Contato</span>
                <span className="text-sm font-medium">
                  {selectedReservation.contacts?.name || selectedReservation.contacts?.phone || 'Sem contato'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Origem</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {selectedReservation.created_by === 'bot' ? 'Agente IA' : 'Dashboard'}
                </span>
              </div>
              {selectedReservation.notes && (
                <div>
                  <span className="text-sm text-muted-foreground block mb-1">Notas</span>
                  <p className="text-sm bg-gray-50 rounded p-2">{selectedReservation.notes}</p>
                </div>
              )}
              {selectedReservation.cancelled_reason && (
                <div>
                  <span className="text-sm text-muted-foreground block mb-1">Motivo do cancelamento</span>
                  <p className="text-sm bg-red-50 rounded p-2 text-red-700">{selectedReservation.cancelled_reason}</p>
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                Criada em {format(new Date(selectedReservation.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </div>
            </div>

            {/* Actions */}
            {selectedReservation.status !== 'cancelled' && (
              <div className="flex gap-2 pt-2 border-t">
                {selectedReservation.status !== 'confirmed' && (
                  <button
                    onClick={() => handleUpdateStatus(selectedReservation.id, 'confirmed')}
                    className="flex-1 px-3 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700"
                  >
                    Confirmar
                  </button>
                )}
                {selectedReservation.status === 'pending' && (
                  <button
                    onClick={() => handleUpdateStatus(selectedReservation.id, 'in_analysis')}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                  >
                    Em Análise
                  </button>
                )}
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="flex-1 px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-md text-sm font-medium hover:bg-red-100"
                >
                  Cancelar
                </button>
              </div>
            )}
            {selectedReservation.status === 'cancelled' && (
              <div className="flex gap-2 pt-2 border-t">
                <button
                  onClick={() => handleDelete(selectedReservation.id)}
                  className="flex-1 px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-md text-sm font-medium hover:bg-red-100"
                >
                  Excluir Registro
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cancel Reason Modal */}
      {showCancelModal && selectedReservation && (
        <div className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center" onClick={() => setShowCancelModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold">Cancelar Reserva</h3>
            <div>
              <label className="block text-sm font-medium mb-1">Motivo (opcional)</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ex: Cliente desistiu, mudou a data..."
                className="w-full h-24 px-3 py-2 border rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleUpdateStatus(selectedReservation.id, 'cancelled', cancelReason || undefined)}
                className="flex-1 px-3 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700"
              >
                Confirmar Cancelamento
              </button>
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 px-3 py-2 border rounded-md text-sm font-medium hover:bg-gray-50"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Reservation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Nova Reserva</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground">
                &#10005;
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Data</label>
                <input
                  type="date"
                  value={selectedDate || ''}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Produto</label>
                <select
                  value={createForm.product_id}
                  onChange={(e) => setCreateForm({ ...createForm, product_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Selecione o produto</option>
                  {products.filter((p) => p.active).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status Inicial</label>
                <select
                  value={createForm.status}
                  onChange={(e) => setCreateForm({ ...createForm, status: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="pending">Pendente</option>
                  <option value="in_analysis">Em Análise</option>
                  <option value="confirmed">Confirmada</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notas (opcional)</label>
                <textarea
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                  placeholder="Ex: Casamento, 150 convidados..."
                  className="w-full h-20 px-3 py-2 border rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {createError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
                {createError}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleCreateReservation}
                disabled={!createForm.product_id || !selectedDate || creating}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {creating ? 'Criando...' : 'Criar Reserva'}
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border rounded-md text-sm font-medium hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
