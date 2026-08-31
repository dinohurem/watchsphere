/**
 * Convert raw WhatsApp messages into the flat shape the backend ingests.
 *
 * Structurally typed on purpose — nothing here imports Baileys, so the
 * conversion rules can be tested against fixtures without a WhatsApp session.
 */

export interface CapturedMessage {
  message_id: string;
  group_jid: string;
  group_name: string;
  sender: string;
  sender_phone: string | null;
  push_name: string | null;
  content: string;
  timestamp: string;
  from_me: boolean;
  has_media: boolean;
  attachments: string[];
}

/** The subset of a Baileys WAMessage this module reads. */
export interface RawMessage {
  key?: {
    remoteJid?: string | null;
    fromMe?: boolean | null;
    id?: string | null;
    participant?: string | null;
  } | null;
  message?: Record<string, any> | null;
  messageTimestamp?: number | bigint | { low: number; high: number } | null;
  pushName?: string | null;
  messageStubType?: number | null;
}

export interface ExtractedContent {
  text: string;
  hasMedia: boolean;
  attachments: string[];
}

/**
 * Wrappers WhatsApp puts around the real payload. Unwrapped before reading
 * content, otherwise disappearing-message groups — common among dealers —
 * would capture as empty.
 */
const WRAPPERS = [
  'ephemeralMessage',
  'viewOnceMessage',
  'viewOnceMessageV2',
  'viewOnceMessageV2Extension',
  'documentWithCaptionMessage',
  'editedMessage',
];

export function unwrapMessage(message: Record<string, any> | null | undefined): Record<string, any> | null {
  let current = message ?? null;
  // Bounded to avoid spinning on a malformed/self-referential payload.
  for (let depth = 0; depth < 5 && current; depth += 1) {
    const wrapper = WRAPPERS.find((name) => current?.[name]?.message);
    if (!wrapper) return current;
    current = current[wrapper].message;
  }
  return current;
}

export function extractContent(message: Record<string, any> | null | undefined): ExtractedContent {
  const empty: ExtractedContent = { text: '', hasMedia: false, attachments: [] };
  const payload = unwrapMessage(message);
  if (!payload) return empty;

  if (typeof payload.conversation === 'string' && payload.conversation.trim()) {
    return { text: payload.conversation, hasMedia: false, attachments: [] };
  }

  if (typeof payload.extendedTextMessage?.text === 'string') {
    return { text: payload.extendedTextMessage.text, hasMedia: false, attachments: [] };
  }

  // Media carries the listing in its caption; the file itself is not ingested.
  const mediaKinds = ['imageMessage', 'videoMessage', 'documentMessage'] as const;
  for (const kind of mediaKinds) {
    const media = payload[kind];
    if (!media) continue;
    const attachments = typeof media.fileName === 'string' && media.fileName ? [media.fileName] : [];
    return {
      text: typeof media.caption === 'string' ? media.caption : '',
      hasMedia: true,
      attachments,
    };
  }

  return empty;
}

export function normalizeTimestamp(
  value: number | bigint | { low: number; high: number } | null | undefined
): Date | null {
  if (value === null || value === undefined) return null;

  let seconds: number;
  if (typeof value === 'bigint') {
    seconds = Number(value);
  } else if (typeof value === 'number') {
    seconds = value;
  } else if (typeof value === 'object' && typeof value.low === 'number') {
    // Baileys hands back protobuf Longs for timestamps.
    seconds = value.low;
  } else {
    return null;
  }

  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000);
}

/**
 * Derive a sender label.
 *
 * Phone numbers matter: the pipeline derives country — and therefore default
 * currency — from the sender's prefix. WhatsApp increasingly hands out `@lid`
 * (linked-identity) JIDs in groups, which are NOT phone numbers; treating one
 * as a number would invent a bogus country, so those fall back to the push
 * name and record no phone at all.
 */
export function senderIdentity(
  participantJid: string | null | undefined,
  pushName: string | null | undefined
): { sender: string; senderPhone: string | null } {
  const jid = (participantJid ?? '').trim();
  const name = (pushName ?? '').trim();
  const user = jid.split('@')[0]?.split(':')[0] ?? '';
  const isPhoneJid = jid.includes('@s.whatsapp.net') && /^\d{7,15}$/.test(user);

  if (isPhoneJid) {
    const phone = `+${user}`;
    return { sender: phone, senderPhone: phone };
  }

  if (name) return { sender: name, senderPhone: null };
  if (user) return { sender: user, senderPhone: null };
  return { sender: 'Unknown', senderPhone: null };
}

export function isGroupJid(jid: string | null | undefined): boolean {
  return typeof jid === 'string' && jid.endsWith('@g.us');
}

/**
 * A JID this bridge is willing to convert.
 *
 * Scope is decided upstream by BRIDGE_CHAT_KINDS plus the allowlist — by the
 * time a message reaches conversion the decision is already made. This only
 * rejects what is never a conversation: the stories feed and malformed JIDs.
 */
export function isCapturableJid(jid: string | null | undefined): boolean {
  if (typeof jid !== 'string' || jid.length === 0) return false;
  if (jid === 'status@broadcast') return false;
  return (
    jid.endsWith('@g.us') ||
    jid.endsWith('@s.whatsapp.net') ||
    jid.endsWith('@lid') ||
    jid.endsWith('@newsletter') ||
    jid.endsWith('@broadcast')
  );
}

export interface ConvertOptions {
  groupName: string;
  captureOwnMessages?: boolean;
}

/**
 * Convert one raw message, or null when it should not be captured.
 *
 * Dropped: JIDs that are never a conversation, system/stub messages, and
 * anything with no text — a bare photo carries no parseable listing, and an
 * empty capture would only add noise to the export. Which *chats* are in scope
 * is decided before this, by BRIDGE_CHAT_KINDS and the allowlist.
 */
export function toCapturedMessage(raw: RawMessage, options: ConvertOptions): CapturedMessage | null {
  const groupJid = raw.key?.remoteJid ?? '';
  if (!isCapturableJid(groupJid)) return null;

  const messageId = raw.key?.id ?? '';
  if (!messageId) return null;

  // Stub messages are group events ("X was added"), not content.
  if (raw.messageStubType !== null && raw.messageStubType !== undefined) return null;

  const fromMe = Boolean(raw.key?.fromMe);
  if (fromMe && !options.captureOwnMessages) return null;

  const timestamp = normalizeTimestamp(raw.messageTimestamp);
  if (!timestamp) return null;

  const { text, hasMedia, attachments } = extractContent(raw.message);
  if (!text.trim()) return null;

  // In a group the author is key.participant; in a 1:1 chat there is no
  // participant and the counterparty is remoteJid itself. Falling back keeps
  // the phone number, which the pipeline uses to derive country and currency.
  const authorJid = raw.key?.participant ?? (isGroupJid(groupJid) ? null : groupJid);
  const { sender, senderPhone } = senderIdentity(authorJid, raw.pushName);

  return {
    message_id: messageId,
    group_jid: groupJid,
    group_name: options.groupName,
    sender,
    sender_phone: senderPhone,
    push_name: raw.pushName?.trim() || null,
    content: text.trim(),
    timestamp: timestamp.toISOString(),
    from_me: fromMe,
    has_media: hasMedia,
    attachments,
  };
}
