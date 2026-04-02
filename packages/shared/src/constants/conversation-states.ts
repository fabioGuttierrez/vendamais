import type { ConversationState } from '../types/conversation.js';

export const CONVERSATION_STATES: Record<ConversationState, { label: string; description: string }> = {
  greeting: { label: 'Saudação', description: 'Primeiro contato com o cliente' },
  qualification: { label: 'Qualificação', description: 'Coletando informações do evento' },
  presentation: { label: 'Apresentação', description: 'Apresentando produtos ideais' },
  objection_handling: { label: 'Objeções', description: 'Tratando objeções do cliente' },
  closing: { label: 'Fechamento', description: 'Tentando fechar a venda' },
  follow_up: { label: 'Follow-up', description: 'Aguardando retorno do cliente' },
  human_takeover: { label: 'Atendimento Humano', description: 'Conversa transferida para humano' },
  completed: { label: 'Concluída', description: 'Venda fechada ou conversa finalizada' },
  lost: { label: 'Perdida', description: 'Cliente desistiu' },
};
