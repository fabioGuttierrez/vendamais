'use client';

import { useEffect, useState, useRef } from 'react';
import { api, apiUpload } from '@/lib/utils';

interface TrainingConversation {
  id: string;
  title: string;
  outcome: 'positive' | 'negative';
  message_count: number;
  analysis_status: 'pending' | 'analyzing' | 'completed' | 'failed';
  created_at: string;
  insights?: {
    summary: string;
    techniques_that_worked: string[];
    objection_handling: { objection: string; response: string; effective: boolean }[];
    improvement_points: string[];
    success_patterns: string[];
    red_flags: string[];
    key_phrases: string[];
  };
  analysis_error?: string;
}

export default function TrainingPage() {
  const [conversations, setConversations] = useState<TrainingConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedData, setExpandedData] = useState<TrainingConversation | null>(null);

  // Upload form
  const [title, setTitle] = useState('');
  const [outcome, setOutcome] = useState<'positive' | 'negative'>('positive');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  async function loadConversations() {
    try {
      const data = await api<TrainingConversation[]>('/training');
      setConversations(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('outcome', outcome);
      formData.append('title', title || file.name.replace(/\.txt$/, ''));

      await apiUpload('/training/upload', formData);
      setFile(null);
      setTitle('');
      setShowUpload(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadConversations();

      // Poll for analysis completion
      setTimeout(() => loadConversations(), 10000);
      setTimeout(() => loadConversations(), 25000);
    } catch (err: any) {
      alert('Erro no upload: ' + err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover esta conversa de treinamento?')) return;
    await api(`/training/${id}`, { method: 'DELETE' });
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedData(null);
    }
  }

  async function handleReanalyze(id: string) {
    await api(`/training/${id}/reanalyze`, { method: 'POST' });
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, analysis_status: 'analyzing' as const } : c)),
    );
    setTimeout(() => loadConversations(), 15000);
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedData(null);
      return;
    }
    setExpandedId(id);
    try {
      const data = await api<TrainingConversation>(`/training/${id}`);
      setExpandedData(data);
    } catch {
      setExpandedData(null);
    }
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.txt')) {
      setFile(droppedFile);
      if (!title) setTitle(droppedFile.name.replace(/\.txt$/, ''));
    }
  }

  const positiveCount = conversations.filter((c) => c.outcome === 'positive').length;
  const negativeCount = conversations.filter((c) => c.outcome === 'negative').length;
  const analyzedCount = conversations.filter((c) => c.analysis_status === 'completed').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Treinamento do Agente</h1>
          <p className="text-sm text-muted-foreground">
            Envie conversas reais para que o bot aprenda padroes de atendimento
          </p>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90"
        >
          {showUpload ? 'Cancelar' : 'Upload Conversa'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border p-4 text-center">
          <p className="text-2xl font-bold">{conversations.length}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        <div className="bg-white rounded-lg border p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{positiveCount}</p>
          <p className="text-xs text-muted-foreground">Positivas</p>
        </div>
        <div className="bg-white rounded-lg border p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{negativeCount}</p>
          <p className="text-xs text-muted-foreground">Negativas</p>
        </div>
      </div>

      {/* Upload Form */}
      {showUpload && (
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h2 className="font-semibold text-lg">Upload de Conversa</h2>
          <p className="text-sm text-muted-foreground">
            Exporte uma conversa do WhatsApp (Mais opcoes &gt; Exportar conversa &gt; Sem midia) e envie o arquivo .txt
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Titulo</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Venda Casamento Maria"
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Resultado</label>
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as 'positive' | 'negative')}
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="positive">Positivo (venda fechada)</option>
                <option value="negative">Negativo (venda perdida)</option>
              </select>
            </div>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-gray-50 transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setFile(f);
                  if (!title) setTitle(f.name.replace(/\.txt$/, ''));
                }
              }}
            />
            {file ? (
              <div>
                <p className="font-medium text-sm">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-muted-foreground">Arraste um arquivo .txt aqui ou clique para selecionar</p>
                <p className="text-xs text-muted-foreground mt-1">Formato: export de conversa do WhatsApp</p>
              </div>
            )}
          </div>

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {uploading ? 'Enviando e analisando...' : 'Enviar e Analisar'}
          </button>
        </div>
      )}

      {/* Conversations List */}
      <div className="space-y-3">
        {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}

        {!loading && conversations.length === 0 && (
          <div className="bg-white rounded-lg border p-8 text-center">
            <p className="text-muted-foreground">Nenhuma conversa de treinamento ainda.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Clique em "Upload Conversa" para comecar a treinar seu agente.
            </p>
          </div>
        )}

        {conversations.map((conv) => (
          <div key={conv.id} className="bg-white rounded-lg border">
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
              onClick={() => toggleExpand(conv.id)}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                    conv.outcome === 'positive'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {conv.outcome === 'positive' ? 'Positivo' : 'Negativo'}
                </span>
                <div>
                  <p className="font-medium text-sm">{conv.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {conv.message_count} mensagens | {new Date(conv.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 text-xs rounded-full ${
                    conv.analysis_status === 'completed'
                      ? 'bg-blue-100 text-blue-700'
                      : conv.analysis_status === 'analyzing'
                        ? 'bg-yellow-100 text-yellow-700'
                        : conv.analysis_status === 'failed'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {conv.analysis_status === 'completed'
                    ? 'Analisado'
                    : conv.analysis_status === 'analyzing'
                      ? 'Analisando...'
                      : conv.analysis_status === 'failed'
                        ? 'Falhou'
                        : 'Pendente'}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleReanalyze(conv.id); }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Reanalisar
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(conv.id); }}
                  className="text-xs text-red-600 hover:underline"
                >
                  Excluir
                </button>
              </div>
            </div>

            {/* Expanded Insights */}
            {expandedId === conv.id && expandedData?.insights && (
              <div className="border-t p-4 bg-gray-50 space-y-3">
                <p className="text-sm font-medium">Insights Extraidos</p>
                <p className="text-sm text-muted-foreground">{expandedData.insights.summary}</p>

                {expandedData.insights.techniques_that_worked.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-green-700 mb-1">Tecnicas que funcionaram:</p>
                    <ul className="text-xs text-gray-600 space-y-0.5">
                      {expandedData.insights.techniques_that_worked.map((t, i) => (
                        <li key={i}>- {t}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {expandedData.insights.success_patterns.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-blue-700 mb-1">Padroes de sucesso:</p>
                    <ul className="text-xs text-gray-600 space-y-0.5">
                      {expandedData.insights.success_patterns.map((p, i) => (
                        <li key={i}>- {p}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {expandedData.insights.red_flags.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-red-700 mb-1">Sinais de alerta:</p>
                    <ul className="text-xs text-gray-600 space-y-0.5">
                      {expandedData.insights.red_flags.map((r, i) => (
                        <li key={i}>- {r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {expandedData.insights.improvement_points.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-amber-700 mb-1">Pontos de melhoria:</p>
                    <ul className="text-xs text-gray-600 space-y-0.5">
                      {expandedData.insights.improvement_points.map((im, i) => (
                        <li key={i}>- {im}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {expandedData.insights.key_phrases.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-purple-700 mb-1">Frases-chave:</p>
                    <ul className="text-xs text-gray-600 space-y-0.5">
                      {expandedData.insights.key_phrases.map((kp, i) => (
                        <li key={i}>- "{kp}"</li>
                      ))}
                    </ul>
                  </div>
                )}

                {expandedData.insights.objection_handling.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-indigo-700 mb-1">Tratamento de objecoes:</p>
                    {expandedData.insights.objection_handling.map((o, i) => (
                      <div key={i} className="text-xs text-gray-600 mb-1">
                        <span className="font-medium">Objecao:</span> "{o.objection}"
                        <br />
                        <span className="font-medium">Resposta:</span> "{o.response}"
                        <span className={`ml-1 ${o.effective ? 'text-green-600' : 'text-red-600'}`}>
                          ({o.effective ? 'eficaz' : 'ineficaz'})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {expandedId === conv.id && expandedData?.analysis_error && (
              <div className="border-t p-4 bg-red-50">
                <p className="text-sm text-red-700">Erro na analise: {expandedData.analysis_error}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Info card */}
      {analyzedCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-700">
            <strong>{analyzedCount}</strong> conversa(s) analisada(s). Os insights extraidos estao sendo usados
            automaticamente pelo agente durante os atendimentos.
          </p>
        </div>
      )}
    </div>
  );
}
