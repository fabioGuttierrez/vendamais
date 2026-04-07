'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/utils';
import type { Product, AgentPreset } from '@vendamais/shared';

export default function BotConfigPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [greeting, setGreeting] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [botDefaultActive, setBotDefaultActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Agent presets state
  const [builtInPresets, setBuiltInPresets] = useState<AgentPreset[]>([]);
  const [customPresets, setCustomPresets] = useState<AgentPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState('consultora-experiente');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [editingPreset, setEditingPreset] = useState<AgentPreset | null>(null);
  const [customForm, setCustomForm] = useState({ name: '', description: '', persona: '', greetingStyle: '' });

  useEffect(() => {
    api<Product[]>('/products').then(setProducts).catch(console.error);
    api<AgentPreset[]>('/agent-presets').then(setBuiltInPresets).catch(console.error);
    api<any[]>('/bot-config').then((configs) => {
      const greetingConfig = configs.find((c) => c.key === 'greeting_message');
      const promptConfig = configs.find((c) => c.key === 'custom_prompt');
      const botActiveConfig = configs.find((c) => c.key === 'bot_default_active');
      const presetIdConfig = configs.find((c) => c.key === 'active_agent_preset_id');
      const customPresetsConfig = configs.find((c) => c.key === 'custom_agent_presets');
      if (greetingConfig) setGreeting(greetingConfig.value);
      if (promptConfig) setCustomPrompt(promptConfig.value);
      if (botActiveConfig) setBotDefaultActive(botActiveConfig.value !== false);
      if (presetIdConfig) setActivePresetId(presetIdConfig.value as string);
      if (customPresetsConfig) setCustomPresets(customPresetsConfig.value as AgentPreset[]);
    }).catch(console.error);
  }, []);

  async function selectPreset(presetId: string) {
    setActivePresetId(presetId);
    await api('/bot-config/active_agent_preset_id', {
      method: 'PUT',
      body: JSON.stringify({ value: presetId }),
    });
  }

  async function saveCustomPreset() {
    const id = editingPreset?.id || `custom:${crypto.randomUUID()}`;
    const newPreset: AgentPreset = {
      id,
      name: customForm.name,
      description: customForm.description,
      persona: customForm.persona,
      greetingStyle: customForm.greetingStyle,
      isBuiltIn: false,
    };

    const updated = editingPreset
      ? customPresets.map((p) => (p.id === id ? newPreset : p))
      : [...customPresets, newPreset];

    setCustomPresets(updated);
    await api('/bot-config/custom_agent_presets', {
      method: 'PUT',
      body: JSON.stringify({ value: updated }),
    });

    // Auto-select the new/edited preset
    await selectPreset(id);

    setShowCustomForm(false);
    setEditingPreset(null);
    setCustomForm({ name: '', description: '', persona: '', greetingStyle: '' });
  }

  async function deleteCustomPreset(id: string) {
    const updated = customPresets.filter((p) => p.id !== id);
    setCustomPresets(updated);
    await api('/bot-config/custom_agent_presets', {
      method: 'PUT',
      body: JSON.stringify({ value: updated }),
    });
    if (activePresetId === id) {
      await selectPreset('consultora-experiente');
    }
  }

  function startEditPreset(preset: AgentPreset) {
    setEditingPreset(preset);
    setCustomForm({
      name: preset.name,
      description: preset.description,
      persona: preset.persona,
      greetingStyle: preset.greetingStyle,
    });
    setShowCustomForm(true);
  }

  function cancelCustomForm() {
    setShowCustomForm(false);
    setEditingPreset(null);
    setCustomForm({ name: '', description: '', persona: '', greetingStyle: '' });
  }

  async function saveConfig() {
    setSaving(true);
    try {
      await Promise.all([
        api('/bot-config/greeting_message', { method: 'PUT', body: JSON.stringify({ value: greeting }) }),
        api('/bot-config/custom_prompt', { method: 'PUT', body: JSON.stringify({ value: customPrompt }) }),
        api('/bot-config/bot_default_active', { method: 'PUT', body: JSON.stringify({ value: botDefaultActive }) }),
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

  const allPresets = [...builtInPresets, ...customPresets];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Configuracao do Bot</h1>

      {/* Agent Preset Selection */}
      <div className="bg-white rounded-lg border p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-lg">Perfil do Agente</h2>
          <p className="text-sm text-muted-foreground">
            Escolha a personalidade do seu assistente de vendas
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {allPresets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => selectPreset(preset.id)}
              className={`relative text-left p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                activePresetId === preset.id
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {activePresetId === preset.id && (
                <span className="absolute top-3 right-3 text-primary text-lg">&#10003;</span>
              )}
              <div className="flex items-center gap-2 mb-1">
                {preset.avatar && <span className="text-xl">{preset.avatar}</span>}
                <span className="font-semibold">{preset.name}</span>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">{preset.description}</p>
              {!preset.isBuiltIn && (
                <div className="flex gap-2 mt-2">
                  <span
                    onClick={(e) => { e.stopPropagation(); startEditPreset(preset); }}
                    className="text-xs text-blue-600 hover:underline cursor-pointer"
                  >
                    Editar
                  </span>
                  <span
                    onClick={(e) => { e.stopPropagation(); deleteCustomPreset(preset.id); }}
                    className="text-xs text-red-600 hover:underline cursor-pointer"
                  >
                    Excluir
                  </span>
                </div>
              )}
            </button>
          ))}

          {/* Create Custom Agent Button */}
          {!showCustomForm && (
            <button
              onClick={() => setShowCustomForm(true)}
              className="text-left p-4 rounded-lg border-2 border-dashed border-gray-300 hover:border-primary hover:bg-gray-50 transition-all"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">+</span>
                <span className="font-semibold text-muted-foreground">Criar Agente Personalizado</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Defina sua propria personalidade para o bot
              </p>
            </button>
          )}
        </div>

        {/* Custom Agent Form */}
        {showCustomForm && (
          <div className="border rounded-lg p-4 space-y-4 bg-gray-50">
            <h3 className="font-semibold">
              {editingPreset ? 'Editar Agente' : 'Novo Agente Personalizado'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nome</label>
                <input
                  type="text"
                  value={customForm.name}
                  onChange={(e) => setCustomForm({ ...customForm, name: e.target.value })}
                  placeholder="Ex: Consultor Premium"
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Descricao Curta</label>
                <input
                  type="text"
                  value={customForm.description}
                  onChange={(e) => setCustomForm({ ...customForm, description: e.target.value })}
                  placeholder="Ex: Consultor formal para eventos corporativos"
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Personalidade</label>
              <p className="text-xs text-muted-foreground mb-1">
                Descreva o perfil, tom de voz e comportamento do agente
              </p>
              <textarea
                value={customForm.persona}
                onChange={(e) => setCustomForm({ ...customForm, persona: e.target.value })}
                placeholder={`Ex: Voce e o Carlos, consultor premium da Like Move 360.\n- Homem, 45 anos, elegante e experiente\n- Tom: sofisticado e consultivo\n- Use "voce" (nunca "tu"), mantenha profissionalismo`}
                className="w-full h-40 px-3 py-2 border rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Estilo de Saudacao</label>
              <p className="text-xs text-muted-foreground mb-1">
                Como o agente deve cumprimentar o cliente na primeira mensagem
              </p>
              <textarea
                value={customForm.greetingStyle}
                onChange={(e) => setCustomForm({ ...customForm, greetingStyle: e.target.value })}
                placeholder='Ex: Cumprimente com formalidade: "Boa tarde! Sou o Carlos da Like Move 360..."'
                className="w-full h-24 px-3 py-2 border rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={saveCustomPreset}
                disabled={!customForm.name || !customForm.persona}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {editingPreset ? 'Salvar Alteracoes' : 'Criar Agente'}
              </button>
              <button
                onClick={cancelCustomForm}
                className="px-4 py-2 border rounded-md text-sm font-medium hover:bg-gray-100"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bot Default Active */}
      <div className="bg-white rounded-lg border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-lg">Bot Ativo por Padrao</h2>
            <p className="text-sm text-muted-foreground">
              Define se novas conversas iniciam com o bot ativo ou em modo humano
            </p>
          </div>
          <button
            onClick={() => setBotDefaultActive(!botDefaultActive)}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
              botDefaultActive ? 'bg-primary' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow ${
                botDefaultActive ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        <div className={`text-sm font-medium px-3 py-2 rounded-md ${
          botDefaultActive
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-amber-50 text-amber-700 border border-amber-200'
        }`}>
          {botDefaultActive
            ? 'Novas conversas: Bot responde automaticamente'
            : 'Novas conversas: Aguardando atendimento humano'}
        </div>
      </div>

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
        <p className="text-sm text-muted-foreground">
          Se preenchida, substitui a saudacao padrao do agente selecionado
        </p>
        <textarea
          value={greeting}
          onChange={(e) => setGreeting(e.target.value)}
          placeholder="Customize a mensagem de abertura do bot..."
          className="w-full h-32 px-3 py-2 border rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Custom Prompt */}
      <div className="bg-white rounded-lg border p-6 space-y-4">
        <h2 className="font-semibold text-lg">Instrucoes Personalizadas</h2>
        <p className="text-sm text-muted-foreground">Adicione instrucoes extras ao prompt do bot (ex: promocoes ativas, regras especiais)</p>
        <textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder="Ex: Estamos com promocao de 10% em pacotes combinados ate o fim do mes..."
          className="w-full h-48 px-3 py-2 border rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={saveConfig}
          disabled={saving}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Salvar Configuracoes'}
        </button>
        {saved && <span className="text-sm text-green-600">Salvo com sucesso!</span>}
      </div>
    </div>
  );
}
