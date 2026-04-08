import type { Tool } from '@anthropic-ai/sdk/resources/messages.js';

export const salesTools: Tool[] = [
  {
    name: 'update_conversation_state',
    description:
      'Transicione a conversa para um novo estado no funil de vendas. Use sempre que a conversa avançar ou mudar de fase.',
    input_schema: {
      type: 'object' as const,
      properties: {
        new_state: {
          type: 'string',
          enum: [
            'greeting',
            'qualification',
            'presentation',
            'objection_handling',
            'closing',
            'follow_up',
            'human_takeover',
            'completed',
            'lost',
          ],
        },
        reason: { type: 'string', description: 'Motivo da transição' },
      },
      required: ['new_state'],
    },
  },
  {
    name: 'update_qualification',
    description:
      'Salve dados de qualificação coletados do cliente durante a conversa. Chame sempre que o cliente fornecer informações sobre o evento.',
    input_schema: {
      type: 'object' as const,
      properties: {
        event_type: { type: 'string', description: 'Tipo do evento (casamento, aniversário, corporativo, etc)' },
        event_date: { type: 'string', description: 'Data do evento (formato YYYY-MM-DD)' },
        estimated_guests: { type: 'number', description: 'Número estimado de convidados' },
        budget_range: { type: 'string', description: 'Faixa de orçamento mencionada' },
        city: { type: 'string', description: 'Cidade do evento' },
        customer_name: { type: 'string', description: 'Nome do cliente' },
      },
    },
  },
  {
    name: 'create_or_update_deal',
    description:
      'Crie ou atualize um negócio no pipeline de vendas. Use quando a conversa indicar progresso comercial.',
    input_schema: {
      type: 'object' as const,
      properties: {
        stage: {
          type: 'string',
          enum: ['new_lead', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'won', 'lost'],
        },
        product_slug: {
          type: 'string',
          enum: ['max360', 'spinner360', 'espelho-magico'],
          description: 'Produto de interesse',
        },
        estimated_value: { type: 'number', description: 'Valor estimado em BRL' },
        title: { type: 'string', description: 'Título do negócio' },
      },
      required: ['stage'],
    },
  },
  {
    name: 'schedule_follow_up',
    description:
      'Agende uma mensagem de follow-up para o cliente. Use quando o cliente precisar de tempo para pensar ou não responder.',
    input_schema: {
      type: 'object' as const,
      properties: {
        delay_hours: { type: 'number', description: 'Horas a partir de agora para enviar o follow-up' },
        message_template: { type: 'string', description: 'Mensagem do follow-up (use {{name}} para o nome)' },
      },
      required: ['delay_hours', 'message_template'],
    },
  },
  {
    name: 'log_objection',
    description:
      'Registre uma objeção do cliente para análise. Use sempre que identificar uma objeção.',
    input_schema: {
      type: 'object' as const,
      properties: {
        objection_type: {
          type: 'string',
          enum: ['price', 'timing', 'need', 'competitor', 'trust', 'other'],
        },
        objection_text: { type: 'string', description: 'O que o cliente disse' },
        response_text: { type: 'string', description: 'Como o bot respondeu à objeção' },
        response_technique: {
          type: 'string',
          enum: ['listen', 'acknowledge', 'explore', 'respond'],
          description: 'Técnica LAER usada',
        },
        was_resolved: { type: 'boolean', description: 'Se a objeção foi resolvida' },
      },
      required: ['objection_type', 'objection_text'],
    },
  },
  {
    name: 'escalate_to_human',
    description:
      'Pause o bot e escale a conversa para um atendente humano. Use quando o cliente pedir ou a situação exigir.',
    input_schema: {
      type: 'object' as const,
      properties: {
        reason: { type: 'string', description: 'Motivo do escalonamento' },
      },
      required: ['reason'],
    },
  },
  {
    name: 'check_availability',
    description:
      'Verifique a disponibilidade de um produto para uma data específica. Use SEMPRE que o cliente mencionar uma data de evento. Se o produto estiver indisponível, retorna quais outros equipamentos estão livres NAQUELA MESMA DATA.',
    input_schema: {
      type: 'object' as const,
      properties: {
        product_slug: {
          type: 'string',
          enum: ['max360', 'spinner360', 'espelho-magico'],
          description: 'Produto a verificar',
        },
        date: {
          type: 'string',
          description: 'Data a verificar (formato YYYY-MM-DD)',
        },
      },
      required: ['product_slug', 'date'],
    },
  },
  {
    name: 'create_reservation',
    description:
      'Crie uma reserva tentativa (pendente) para um produto em uma data. Use quando o cliente demonstrar interesse claro em reservar. A reserva será criada como "pendente" e precisará de confirmação humana.',
    input_schema: {
      type: 'object' as const,
      properties: {
        product_slug: {
          type: 'string',
          enum: ['max360', 'spinner360', 'espelho-magico'],
          description: 'Produto a reservar',
        },
        event_date: {
          type: 'string',
          description: 'Data do evento (formato YYYY-MM-DD)',
        },
        notes: {
          type: 'string',
          description: 'Observações sobre a reserva (tipo de evento, detalhes)',
        },
      },
      required: ['product_slug', 'event_date'],
    },
  },
];
