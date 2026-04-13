// Types
export type { Contact, ContactInsert, ContactUpdate } from './types/contact';
export type { Conversation, ConversationState, QualificationData } from './types/conversation';
export type { Message, MessageDirection, MessageSenderType } from './types/message';
export type { Deal, DealStage } from './types/deal';
export type { Product } from './types/product';
export type { FollowUp, FollowUpStatus } from './types/follow-up';
export type { ObjectionLog, BotConfig } from './types/objection';
export type { AgentPreset } from './types/agent-preset';
export type { Reservation, ReservationStatus } from './types/reservation';
export type { TrainingConversation, TrainingInsights, ParsedMessage } from './types/training-conversation';
export type {
  EvolutionWebhookPayload,
  EvolutionSendTextPayload,
  EvolutionSendMediaPayload,
} from './types/evolution-api';

// Constants
export { PIPELINE_STAGES, type PipelineStageKey } from './constants/pipeline-stages';
export { CONVERSATION_STATES } from './constants/conversation-states';
export { RESERVATION_STATUSES } from './constants/reservation-statuses';
export { AI_MODEL_PRICING, DEFAULT_USD_BRL_RATE, calculateCostBRL } from './constants/ai-pricing';

// Utils
export { normalizePhone, toE164, fromRemoteJid, formatPhoneDisplay } from './utils/phone';
export { formatBRL } from './utils/currency';
