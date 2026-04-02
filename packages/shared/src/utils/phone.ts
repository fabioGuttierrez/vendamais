/** Normalize Brazilian phone to digits only (e.g. 5544991366360) */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').replace(/@.*$/, '');
}

/** Format to E.164 (e.g. +5544991366360) */
export function toE164(phone: string): string {
  const digits = normalizePhone(phone);
  return digits.startsWith('+') ? digits : `+${digits}`;
}

/** Extract digits from Evolution API remoteJid */
export function fromRemoteJid(jid: string): string {
  return jid.replace(/@s\.whatsapp\.net$/, '').replace(/@g\.us$/, '');
}

/** Format phone for display: (44) 99136-6360 */
export function formatPhoneDisplay(phone: string): string {
  const digits = normalizePhone(phone);
  const local = digits.startsWith('55') ? digits.slice(2) : digits;
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  return local;
}
