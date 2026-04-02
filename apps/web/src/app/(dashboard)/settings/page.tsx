'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/utils';
import { Wifi, WifiOff } from 'lucide-react';

export default function SettingsPage() {
  const [whatsappStatus, setWhatsappStatus] = useState<string>('checking...');

  useEffect(() => {
    api<{ whatsapp: string }>('/health')
      .then((res) => setWhatsappStatus(res.whatsapp))
      .catch(() => setWhatsappStatus('error'));
  }, []);

  const isConnected = whatsappStatus === 'open';

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
        <p className="text-sm text-muted-foreground">
          A conexão com o WhatsApp é gerenciada pela Evolution API. Se estiver desconectado, verifique o painel da Evolution API.
        </p>
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
