export interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
    pushName: string;
    message: {
      conversation?: string;
      extendedTextMessage?: { text: string };
      imageMessage?: { url: string; caption?: string };
      audioMessage?: { url: string };
      videoMessage?: { url: string; caption?: string };
      documentMessage?: { url: string; fileName?: string };
    };
    messageType: string;
    messageTimestamp: number;
  };
}

export interface EvolutionSendTextPayload {
  number: string;
  text: string;
}

export interface EvolutionSendMediaPayload {
  number: string;
  mediatype: 'image' | 'video' | 'audio' | 'document';
  media: string;
  caption?: string;
  fileName?: string;
}
