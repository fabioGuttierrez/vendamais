export interface ParsedMessage {
  timestamp: string;
  sender: string;
  content: string;
}

const SYSTEM_MESSAGE_KEYWORDS = [
  'criptografia',
  'criptografadas',
  'adicionou',
  'removeu',
  'saiu',
  'entrou',
  'mudou',
  'criou',
  'alterou',
  'fixou',
  'apagou',
  'mensagem apagada',
  'mensagem editada',
  'Waiting for this message',
  'Esperando por essa mensagem',
  'As mensagens',
  'Ligação de',
  'Chamada de',
];

// Matches both WhatsApp export formats:
// [12/03/2024, 14:30:45] Fabio: Hello
// 12/03/2024 14:30 - Fabio: Hello
const MESSAGE_REGEX = /^\[?(\d{1,2}\/\d{1,2}\/\d{2,4})[,\s]+(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*[-–]?\s*(.+?):\s([\s\S]*)$/;

function isSystemMessage(content: string): boolean {
  const lower = content.toLowerCase();
  return SYSTEM_MESSAGE_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

export function parseWhatsAppExport(rawText: string): ParsedMessage[] {
  const lines = rawText.split(/\r?\n/);
  const messages: ParsedMessage[] = [];
  let currentMessage: ParsedMessage | null = null;

  for (const line of lines) {
    const match = line.match(MESSAGE_REGEX);

    if (match) {
      // Save previous message if exists
      if (currentMessage) {
        messages.push(currentMessage);
      }

      const [, date, time, sender, content] = match;
      const trimmedContent = content.trim();

      // Skip system messages
      if (isSystemMessage(trimmedContent) || isSystemMessage(sender)) {
        currentMessage = null;
        continue;
      }

      currentMessage = {
        timestamp: `${date} ${time}`,
        sender: sender.trim(),
        content: trimmedContent,
      };
    } else if (currentMessage && line.trim()) {
      // Continuation of previous message (multi-line)
      currentMessage.content += '\n' + line.trim();
    }
  }

  // Don't forget last message
  if (currentMessage) {
    messages.push(currentMessage);
  }

  return messages;
}
