'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/utils';
import { Wifi, WifiOff, Save, Eye, EyeOff, Loader2 } from 'lucide-react';

interface BotConfig {
  key: string;
  value: unknown;
}

export default function SettingsPage() {
  const [whatsappStatus, setWhatsappStatus] = useState<string>('checking...');
  const [configs, setConfigs] = useState<BotConfig[]>([]);
  const [evolutionUrl, setEvolutionUrl] = useState('');
  const [evolutionKey, setEvolutionKey] = useState('');
  const [evolutionInstance, setEvolutionInstance] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [adminPhone, setAdminPhone] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneMessage, setPhoneMessage] = useState('');

  useEffect(() => {
    api<{ whatsapp: { state: string } }>('/health')
      .then((res) => setWhatsappStatus(res.whatsapp.state))
      .catch(() => setWhatsappStatus('error'));

    api<BotConfig[]>('/bot-config')
      .then((data) => {
        setConfigs(data);
        const get = (key: string) => data.find((c) => c.key === key)?.value as string | undefined;
        setEvolutionUrl(get('evolution_api_url') || '');
        setEvolutionKey(get('evolution_api_key') || '');
        setEvolutionInstance(get('evolution_instance_name') || '');
        setWebhookSecret(get('webhook_secret') || '');
        setAdminPhone((get('admin_whatsapp_number') as string) || '');
      })
      .catch(() => {});
  }, []);

  const isConnected = whatsappStatus === 'open';

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api<{ whatsapp: { state: string; instanceName?: string; number?: string } }>('/health');
      const state = res.whatsapp?.state;
      if (state === 'open') {
        const num = res.whatsapp?.number ? ` (${res.whatsapp.number})` : '';
        setTestResult({ ok: true, message: `Conectado${num}` });
      } else {
        setTestResult({ ok: false, message: `Estado: ${state || 'desconhecido'}` });
      }
    } catch {
      setTestResult({ ok: false, message: 'Falha ao conectar com a API' });
    } finally {
      setTesting(false);
    }
  }

  async function saveEvolutionConfig() {
    setSaving(true);
    setSaveMessage('');
    try {
      const entries = [
        { key: 'evolution_api_url', value: evolutionUrl.trim() },
        { key: 'evolution_api_key', value: evolutionKey.trim() },
        { key: 'evolution_instance_name', value: evolutionInstance.trim() },
        { key: 'webhook_secret', value: webhookSecret.trim() },
      ];

      for (const entry of entries) {
        await api(`/bot-config/${entry.key}`, {
          method: 'PUT',
          body: JSON.stringify({ value: entry.value }),
        });
      }

      setSaveMessage('Configurações salvas com sucesso!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch {
      setSaveMessage('Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  }

  async function saveAdminPhone() {
    setSavingPhone(true);
    setPhoneMessage('');
    try {
      await api(`/bot-config/admin_whatsapp_number`, {
        method: 'PUT',
        body: JSON.stringify({ value: adminPhone.trim() }),
      });
      setPhoneMessage('Salvo!');
      setTimeout(() => setPhoneMessage(''), 3000);
    } catch {
      setPhoneMessage('Erro ao salvar.');
    } finally {
      setSavingPhone(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Configurações</h1>

      {/* WhatsApp Status */}
      <div className="bg-white rounded-lg border p-6 space-y-4">
        <h2 className="font-semibold text-lg">WhatsApp (Evolution API)</h2>
        <div className="flex items-center gap-3">
          {isConnected ? (
            <>
              <Wifi className="h-5 w-5 text-green-500" />
              <span className="text-green-600 font-medium">Conectado</span>
            </>
          ) : (
            <>
              <WifiOff className="h-5 w-5 text-red-500" />
              <span className="text-red-600 font-medium">Status: {whatsappStatus}</span>
            </>
          )}
        </div>
      </div>

      {/* Notificacoes */}
      <div className="bg-white rounded-lg border p-6 space-y-4">
        <h2 className="font-semibold text-lg">Notificacoes</h2>
        <p className="text-sm text-muted-foreground">
          Numero de WhatsApp que recebera notificacoes quando o bot criar reservas pendentes.
        </p>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Numero do Admin (com DDI)</label>
            <input
              type="tel"
              className="w-full rounded-md border px-3 py-2 text-sm font-mono"
              placeholder="5544991366360"
              value={adminPhone}
              onChange={(e) => setAdminPhone(e.target.value)}
            />
          </div>
          <button
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            onClick={saveAdminPhone}
            disabled={savingPhone}
          >
            {savingPhone ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </button>
        </div>
        {phoneMessage && (
          <span className={`text-sm ${phoneMessage.includes('Erro') ? 'text-red-600' : 'text-green-600'}`}>
            {phoneMessage}
          </span>
        )}
      </div>

      {/* Evolution API Config */}
      <div className="bg-white rounded-lg border p-6 space-y-4">
        <h2 className="font-semibold text-lg">Configuração da Evolution API</h2>
        <p className="text-sm text-muted-foreground">
          Configure a conexão com a Evolution API. Ao trocar de instância, basta alterar os campos abaixo.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">URL da API</label>
            <input
              type="url"
              className="w-full rounded-md border px-3 py-2 text-sm font-mono"
              placeholder="https://evolution.example.com"
              value={evolutionUrl}
              onChange={(e) => setEvolutionUrl(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">API Key</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                className="w-full rounded-md border px-3 py-2 text-sm font-mono pr-10"
                placeholder="Sua chave da Evolution API"
                value={evolutionKey}
                onChange={(e) => setEvolutionKey(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Nome da Instância</label>
            <input
              type="text"
              className="w-full rounded-md border px-3 py-2 text-sm font-mono"
              placeholder="likemove360"
              value={evolutionInstance}
              onChange={(e) => setEvolutionInstance(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Webhook Secret (token da instância)</label>
            <input
              type="password"
              className="w-full rounded-md border px-3 py-2 text-sm font-mono"
              placeholder="Token copiado do painel da Evolution"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              É o token exibido abaixo do nome da instância no painel da Evolution API.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2 flex-wrap">
          <button
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            onClick={saveEvolutionConfig}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </button>
          <button
            className="inline-flex items-center gap-2 border px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            onClick={testConnection}
            disabled={testing}
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
            Testar Conexão
          </button>
          {saveMessage && (
            <span className={`text-sm ${saveMessage.includes('Erro') ? 'text-red-600' : 'text-green-600'}`}>
              {saveMessage}
            </span>
          )}
          {testResult && (
            <span className={`text-sm font-medium ${testResult.ok ? 'text-green-600' : 'text-red-600'}`}>
              {testResult.ok ? '✓' : '✗'} {testResult.message}
            </span>
          )}
        </div>
      </div>

      {/* System Info */}
      <div className="bg-white rounded-lg border p-6 space-y-4">
        <h2 className="font-semibold text-lg">Sistema</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">Versão</span>
            <span className="font-medium">0.1.0</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">API URL</span>
            <span className="font-medium font-mono text-xs">{process.env.NEXT_PUBLIC_API_URL}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">Supabase</span>
            <span className="font-medium font-mono text-xs">{process.env.NEXT_PUBLIC_SUPABASE_URL}</span>
          </div>
        </div>
      </div>

      {/* Help */}
      <div className="bg-white rounded-lg border p-6 space-y-4">
        <h2 className="font-semibold text-lg">Ajuda</h2>
        <div className="text-sm text-muted-foreground space-y-2">
          <p>O VendaMais é um sistema de vendas via WhatsApp com IA integrada.</p>
          <p>O bot atende os clientes automaticamente usando técnicas de vendas e pode ser assumido por um humano a qualquer momento.</p>
          <p>Contato: comercial@likemove360.com.br</p>
        </div>
      </div>
    </div>
  );
}
