'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/utils';
import type { Product } from '@vendamais/shared';

export default function BotConfigPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [greeting, setGreeting] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api<Product[]>('/products').then(setProducts).catch(console.error);
    api<any[]>('/bot-config').then((configs) => {
      const greetingConfig = configs.find((c) => c.key === 'greeting_message');
      const promptConfig = configs.find((c) => c.key === 'custom_prompt');
      if (greetingConfig) setGreeting(greetingConfig.value);
      if (promptConfig) setCustomPrompt(promptConfig.value);
    }).catch(console.error);
  }, []);

  async function saveConfig() {
    setSaving(true);
    try {
      await Promise.all([
        api('/bot-config/greeting_message', { method: 'PUT', body: JSON.stringify({ value: greeting }) }),
        api('/bot-config/custom_prompt', { method: 'PUT', body: JSON.stringify({ value: customPrompt }) }),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function toggleProduct(id: string, active: boolean) {
    await api(`/products/${id}`, { method: 'PATCH', body: JSON.stringify({ active: !active }) });
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, active: !active } : p)));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Configuração do Bot</h1>

      {/* Products */}
      <div className="bg-white rounded-lg border p-6 space-y-4">
        <h2 className="font-semibold text-lg">Produtos</h2>
        <div className="space-y-3">
          {products.map((product) => (
            <div key={product.id} className="flex items-center justify-between p-4 border rounded-md">
              <div>
                <p className="font-medium">{product.name}</p>
                <p className="text-sm text-muted-foreground line-clamp-1">{product.description}</p>
              </div>
              <button
                onClick={() => toggleProduct(product.id, product.active)}
                className={`px-3 py-1 text-xs rounded-full font-medium ${
                  product.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}
              >
                {product.active ? 'Ativo' : 'Inativo'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Greeting Message */}
      <div className="bg-white rounded-lg border p-6 space-y-4">
        <h2 className="font-semibold text-lg">Mensagem de Boas-vindas</h2>
        <textarea
          value={greeting}
          onChange={(e) => setGreeting(e.target.value)}
          placeholder="Customize a mensagem de abertura do bot..."
          className="w-full h-32 px-3 py-2 border rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Custom Prompt */}
      <div className="bg-white rounded-lg border p-6 space-y-4">
        <h2 className="font-semibold text-lg">Instruções Personalizadas</h2>
        <p className="text-sm text-muted-foreground">Adicione instruções extras ao prompt do bot (ex: promoções ativas, regras especiais)</p>
        <textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder="Ex: Estamos com promoção de 10% em pacotes combinados até o fim do mês..."
          className="w-full h-48 px-3 py-2 border rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={saveConfig}
          disabled={saving}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </button>
        {saved && <span className="text-sm text-green-600">Salvo com sucesso!</span>}
      </div>
    </div>
  );
}
