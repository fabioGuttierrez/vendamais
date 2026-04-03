'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/utils';
import { Plus, Edit2, Trash2, Youtube, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

interface FaqItem { question: string; answer: string }
interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  features: string[];
  ideal_for: string | null;
  capacity: string | null;
  delivery_time: string | null;
  min_price_hint: number | null;
  video_url: string | null;
  pricing_info: string | null;
  technical_specs: Record<string, string> | null;
  faq: FaqItem[] | null;
  coverage_area: string | null;
  min_notice_hours: number | null;
  package_includes: string | null;
  restrictions: string | null;
  active: boolean;
  sort_order: number;
}

const emptyForm = (): Partial<Product> & { featuresText: string; specsText: string } => ({
  name: '',
  description: '',
  features: [],
  featuresText: '',
  ideal_for: '',
  capacity: '',
  delivery_time: '',
  pricing_info: '',
  package_includes: '',
  coverage_area: '',
  min_notice_hours: undefined,
  restrictions: '',
  video_url: '',
  technical_specs: {},
  specsText: '',
  faq: [],
  active: true,
  sort_order: 0,
});

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api<Product[]>('/products')
      .then(setProducts)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function startEdit(p: Product) {
    setForm({
      ...p,
      featuresText: (p.features || []).join('\n'),
      specsText: p.technical_specs
        ? Object.entries(p.technical_specs).map(([k, v]) => `${k}: ${v}`).join('\n')
        : '',
    });
    setFaqItems(p.faq || []);
    setEditing(p.id);
  }

  function startNew() {
    setForm(emptyForm());
    setFaqItems([]);
    setEditing('new');
  }

  function cancelEdit() {
    setEditing(null);
    setForm(emptyForm());
    setFaqItems([]);
  }

  function parseSpecs(text: string): Record<string, string> {
    const result: Record<string, string> = {};
    text.split('\n').forEach((line) => {
      const idx = line.indexOf(':');
      if (idx > 0) {
        const k = line.slice(0, idx).trim();
        const v = line.slice(idx + 1).trim();
        if (k && v) result[k] = v;
      }
    });
    return result;
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        features: (form.featuresText || '').split('\n').map((s) => s.trim()).filter(Boolean),
        ideal_for: form.ideal_for,
        capacity: form.capacity,
        delivery_time: form.delivery_time,
        pricing_info: form.pricing_info,
        package_includes: form.package_includes,
        coverage_area: form.coverage_area,
        min_notice_hours: form.min_notice_hours || null,
        restrictions: form.restrictions,
        video_url: form.video_url,
        technical_specs: parseSpecs(form.specsText || ''),
        faq: faqItems,
        active: form.active,
        sort_order: form.sort_order ?? 0,
      };

      if (editing === 'new') {
        await api('/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      } else {
        await api(`/products/${editing}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
      cancelEdit();
      load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: Product) {
    await api(`/products/${p.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !p.active }),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm('Desativar este produto?')) return;
    await api(`/products/${id}`, { method: 'DELETE' });
    load();
  }

  function setF(key: string, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addFaq() {
    setFaqItems((prev) => [...prev, { question: '', answer: '' }]);
  }

  function updateFaq(i: number, field: 'question' | 'answer', value: string) {
    setFaqItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  }

  function removeFaq(i: number) {
    setFaqItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  if (editing) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{editing === 'new' ? 'Novo Produto / Serviço' : 'Editar Produto'}</h1>
          <button onClick={cancelEdit} className="text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
        </div>

        <div className="bg-white rounded-lg border p-6 space-y-5">
          <section className="space-y-3">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Informações básicas</h2>
            <Field label="Nome do produto *">
              <input className={input} value={form.name || ''} onChange={(e) => setF('name', e.target.value)} placeholder="Ex: Plataforma 360 Tradicional" />
            </Field>
            <Field label="Descrição *">
              <textarea className={`${input} h-24`} value={form.description || ''} onChange={(e) => setF('description', e.target.value)} placeholder="Descrição para o bot usar com o cliente..." />
            </Field>
            <Field label="Diferenciais / Features (um por linha)">
              <textarea className={`${input} h-28`} value={form.featuresText || ''} onChange={(e) => setF('featuresText', e.target.value)} placeholder={"Vídeos em 360° com efeitos especiais\nPronta entrega em menos de 1 minuto\nOperador dedicado"} />
            </Field>
          </section>

          <section className="space-y-3">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Perfil do evento</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ideal para">
                <input className={input} value={form.ideal_for || ''} onChange={(e) => setF('ideal_for', e.target.value)} placeholder="Casamentos, formaturas, corporativo..." />
              </Field>
              <Field label="Capacidade">
                <input className={input} value={form.capacity || ''} onChange={(e) => setF('capacity', e.target.value)} placeholder="Até 12 pessoas por vez" />
              </Field>
              <Field label="Entrega dos arquivos">
                <input className={input} value={form.delivery_time || ''} onChange={(e) => setF('delivery_time', e.target.value)} placeholder="Vídeos prontos em menos de 1 minuto" />
              </Field>
              <Field label="Antecedência mínima (horas)">
                <input type="number" className={input} value={form.min_notice_hours || ''} onChange={(e) => setF('min_notice_hours', Number(e.target.value) || null)} placeholder="48" />
              </Field>
            </div>
            <Field label="Área de cobertura">
              <input className={input} value={form.coverage_area || ''} onChange={(e) => setF('coverage_area', e.target.value)} placeholder="Noroeste do Paraná: Maringá, Cianorte, Umuarama..." />
            </Field>
          </section>

          <section className="space-y-3">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Informações comerciais</h2>
            <Field label="Informações de investimento">
              <textarea className={`${input} h-20`} value={form.pricing_info || ''} onChange={(e) => setF('pricing_info', e.target.value)} placeholder="A partir de R$ X para eventos de até Xh em Maringá. Cada proposta é personalizada." />
            </Field>
            <Field label="O que está incluído no pacote">
              <textarea className={`${input} h-20`} value={form.package_includes || ''} onChange={(e) => setF('package_includes', e.target.value)} placeholder="Equipamento + operador + iluminação + compartilhamento via QR Code + suporte no evento" />
            </Field>
            <Field label="Restrições / Observações">
              <textarea className={`${input} h-16`} value={form.restrictions || ''} onChange={(e) => setF('restrictions', e.target.value)} placeholder="Necessita de tomada 220V. Espaço mínimo de 3x3m." />
            </Field>
          </section>

          <section className="space-y-3">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Especificações técnicas</h2>
            <p className="text-xs text-muted-foreground">Uma especificação por linha no formato <code>chave: valor</code></p>
            <textarea className={`${input} h-24 font-mono text-xs`} value={form.specsText || ''} onChange={(e) => setF('specsText', e.target.value)} placeholder={"Dimensões: 1,5m x 1,5m\nEnergia: 220V\nMontagem: 1h\nPeso: 30kg"} />
          </section>

          <section className="space-y-3">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Vídeo de demonstração</h2>
            <Field label="Link do YouTube">
              <div className="flex gap-2 items-center">
                <Youtube className="h-4 w-4 text-red-500 shrink-0" />
                <input className={input} value={form.video_url || ''} onChange={(e) => setF('video_url', e.target.value)} placeholder="https://youtube.com/watch?v=..." />
              </div>
            </Field>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Perguntas frequentes (FAQ)</h2>
              <button onClick={addFaq} className="text-xs text-primary hover:underline flex items-center gap-1"><Plus className="h-3 w-3" />Adicionar</button>
            </div>
            {faqItems.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma pergunta cadastrada ainda.</p>}
            {faqItems.map((item, i) => (
              <div key={i} className="border rounded-md p-3 space-y-2 bg-gray-50">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-muted-foreground">Pergunta {i + 1}</span>
                  <button onClick={() => removeFaq(i)} className="text-red-400 hover:text-red-600"><Trash2 className="h-3 w-3" /></button>
                </div>
                <input className={input} placeholder="Pergunta do cliente" value={item.question} onChange={(e) => updateFaq(i, 'question', e.target.value)} />
                <textarea className={`${input} h-16`} placeholder="Resposta que o bot deve dar" value={item.answer} onChange={(e) => updateFaq(i, 'answer', e.target.value)} />
              </div>
            ))}
          </section>

          <section className="flex items-center justify-between pt-2 border-t">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.active !== false} onChange={(e) => setF('active', e.target.checked)} className="rounded" />
              <span className="text-sm font-medium">Produto ativo (visível para o bot)</span>
            </label>
            <Field label="Ordem">
              <input type="number" className={`${input} w-20`} value={form.sort_order ?? 0} onChange={(e) => setF('sort_order', Number(e.target.value))} />
            </Field>
          </section>
        </div>

        <div className="flex gap-3">
          <button onClick={save} disabled={saving || !form.name} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing === 'new' ? 'Criar Produto' : 'Salvar Alterações'}
          </button>
          <button onClick={cancelEdit} className="px-5 py-2 rounded-md text-sm font-medium border hover:bg-muted">Cancelar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Produtos &amp; Serviços</h1>
          <p className="text-sm text-muted-foreground mt-1">Cadastre aqui todos os equipamentos e serviços. O bot usa essas informações para atender os clientes.</p>
        </div>
        <button onClick={startNew} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Novo Produto
        </button>
      </div>

      {loading && <p className="text-muted-foreground text-sm">Carregando...</p>}

      <div className="space-y-3">
        {products.map((p) => (
          <div key={p.id} className={`bg-white rounded-lg border transition-opacity ${!p.active ? 'opacity-50' : ''}`}>
            <div className="p-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold">{p.name}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.active ? 'Ativo' : 'Inativo'}
                  </span>
                  {p.video_url && <span className="text-xs flex items-center gap-1 text-red-500"><Youtube className="h-3 w-3" />Vídeo</span>}
                </div>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                  {p.capacity && <span>👥 {p.capacity}</span>}
                  {p.coverage_area && <span>📍 {p.coverage_area}</span>}
                  {p.faq?.length ? <span>❓ {p.faq.length} perguntas FAQ</span> : null}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => toggleActive(p)} className="text-xs px-2 py-1 border rounded hover:bg-muted">
                  {p.active ? 'Desativar' : 'Ativar'}
                </button>
                <button onClick={() => startEdit(p)} className="p-1.5 hover:bg-muted rounded"><Edit2 className="h-4 w-4" /></button>
                <button onClick={() => remove(p.id)} className="p-1.5 hover:bg-red-50 text-red-400 rounded"><Trash2 className="h-4 w-4" /></button>
                <button onClick={() => setExpandedId(expandedId === p.id ? null : p.id)} className="p-1.5 hover:bg-muted rounded">
                  {expandedId === p.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {expandedId === p.id && (
              <div className="border-t px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {p.ideal_for && <Info label="Ideal para" value={p.ideal_for} />}
                {p.delivery_time && <Info label="Entrega" value={p.delivery_time} />}
                {p.pricing_info && <Info label="Investimento" value={p.pricing_info} />}
                {p.package_includes && <Info label="Incluído" value={p.package_includes} />}
                {p.restrictions && <Info label="Restrições" value={p.restrictions} />}
                {p.min_notice_hours != null && <Info label="Antecedência mínima" value={`${p.min_notice_hours}h`} />}
                {p.features?.length > 0 && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground font-medium">Diferenciais: </span>
                    {(p.features as string[]).join(' · ')}
                  </div>
                )}
                {p.faq && p.faq.length > 0 && (
                  <div className="col-span-2 mt-1 space-y-1">
                    <p className="text-muted-foreground font-medium">FAQ:</p>
                    {p.faq.map((item, i) => (
                      <div key={i} className="pl-3 border-l-2 border-muted">
                        <p className="font-medium text-xs">{item.question}</p>
                        <p className="text-muted-foreground text-xs">{item.answer}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {!loading && products.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>Nenhum produto cadastrado ainda.</p>
            <button onClick={startNew} className="mt-2 text-primary hover:underline text-sm">Cadastrar primeiro produto</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      {label && <label className="block text-sm font-medium mb-1">{label}</label>}
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground font-medium">{label}: </span>
      <span>{value}</span>
    </div>
  );
}

const input = 'w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20';
