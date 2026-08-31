/**
 * Bridge configuration, read from the environment.
 *
 * Deliberately fail-closed: a missing group allowlist captures nothing rather
 * than everything. This process is paired to a real WhatsApp account, so a
 * config slip would otherwise mean hoovering up private conversations.
 */

export interface BridgeConfig {
  /** Identifies this bridge instance in status reporting. */
  bridgeId: string;
  /** WatchSphere API root, e.g. https://api.watchsphere.io/api/v1 */
  apiBaseUrl: string;
  /** Shared secret sent as X-Bridge-Token. Must match WHATSAPP_BRIDGE_TOKEN. */
  apiToken: string;
  /** Directory holding Baileys multi-file auth state (the paired session). */
  authDir: string;
  /** JSONL file buffering captures that have not been accepted yet. */
  outboxPath: string;
  /**
   * Chat names or JIDs to capture from. Case-insensitive substring match on
   * the chat subject, or exact match on the JID. Empty captures nothing.
   */
  groupAllowlist: string[];
  /**
   * Which chat kinds are eligible at all, before the allowlist is consulted.
   * Groups only by default: a one-to-one conversation is private in a way a
   * dealer broadcast group is not, so widening this is a deliberate act.
   */
  chatKinds: ChatKind[];
  /**
   * Run once and exit (for a scheduled daily run) instead of staying
   * connected. The session is reused, so a run receives everything sent since
   * the previous one.
   */
  runOnce: boolean;
  /** How long a --once run listens for backfill before giving up. */
  onceTimeoutMs: number;
  /**
   * Quiet period, after the backlog signal, with no new message before a
   * --once run considers the sync finished.
   */
  onceSettleMs: number;
  flushIntervalMs: number;
  maxBatchSize: number;
  heartbeatIntervalMs: number;
  /** Capture messages sent from the bridge's own number. Off by default. */
  captureOwnMessages: boolean;
}

/** The chat kinds a WhatsApp JID can denote. */
export type ChatKind = 'group' | 'dm' | 'newsletter' | 'broadcast';

export function classifyJid(jid: string): ChatKind | 'unsupported' {
  if (jid.endsWith('@g.us')) return 'group';
  if (jid.endsWith('@newsletter')) return 'newsletter';
  // status@broadcast is the "stories" feed, never a dealer listing.
  if (jid === 'status@broadcast') return 'unsupported';
  if (jid.endsWith('@broadcast')) return 'broadcast';
  if (jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid')) return 'dm';
  return 'unsupported';
}

const ALL_CHAT_KINDS: ChatKind[] = ['group', 'dm', 'newsletter', 'broadcast'];

function parseChatKinds(raw: string | undefined): ChatKind[] {
  const value = (raw ?? '').trim();
  if (!value) return ['group'];
  if (value.toLowerCase() === 'all') return [...ALL_CHAT_KINDS];

  const kinds = value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  for (const kind of kinds) {
    if (!ALL_CHAT_KINDS.includes(kind as ChatKind)) {
      throw new ConfigError(
        `BRIDGE_CHAT_KINDS: unknown kind "${kind}" — use ${ALL_CHAT_KINDS.join(', ')} or "all"`
      );
    }
  }
  return kinds as ChatKind[];
}

export class ConfigError extends Error {}

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = (env[key] ?? '').trim();
  if (!value) {
    throw new ConfigError(`Missing required environment variable: ${key}`);
  }
  return value;
}

function integer(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = (env[key] ?? '').trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new ConfigError(`${key} must be a positive integer, got: ${raw}`);
  }
  return parsed;
}

export function parseAllowlist(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BridgeConfig {
  const config: BridgeConfig = {
    bridgeId: (env.BRIDGE_ID ?? 'bridge-1').trim(),
    apiBaseUrl: required(env, 'BRIDGE_API_BASE_URL').replace(/\/+$/, ''),
    apiToken: required(env, 'BRIDGE_API_TOKEN'),
    authDir: (env.BRIDGE_AUTH_DIR ?? './auth').trim(),
    outboxPath: (env.BRIDGE_OUTBOX_PATH ?? './data/outbox.jsonl').trim(),
    groupAllowlist: parseAllowlist(env.BRIDGE_GROUPS),
    chatKinds: parseChatKinds(env.BRIDGE_CHAT_KINDS),
    runOnce: (env.BRIDGE_RUN_ONCE ?? '').trim() === 'true',
    onceTimeoutMs: integer(env, 'BRIDGE_ONCE_TIMEOUT_MS', 180_000),
    onceSettleMs: integer(env, 'BRIDGE_ONCE_SETTLE_MS', 20_000),
    flushIntervalMs: integer(env, 'BRIDGE_FLUSH_INTERVAL_MS', 10_000),
    maxBatchSize: integer(env, 'BRIDGE_MAX_BATCH_SIZE', 500),
    heartbeatIntervalMs: integer(env, 'BRIDGE_HEARTBEAT_INTERVAL_MS', 60_000),
    captureOwnMessages: (env.BRIDGE_CAPTURE_OWN_MESSAGES ?? '').trim() === 'true',
  };

  if (config.maxBatchSize > 1000) {
    throw new ConfigError('BRIDGE_MAX_BATCH_SIZE cannot exceed 1000 (server limit)');
  }

  return config;
}

/**
 * Decide whether a chat is in scope.
 *
 * Matching on the subject is what makes this usable — an operator knows the
 * chat by name, not by its numeric JID. Still fail-closed on an empty list.
 */
export function isGroupAllowed(
  allowlist: string[],
  groupJid: string,
  groupName: string | undefined
): boolean {
  if (allowlist.length === 0) return false;

  const name = (groupName ?? '').toLowerCase();
  return allowlist.some((entry) => {
    const candidate = entry.toLowerCase();
    if (candidate === groupJid.toLowerCase()) return true;
    return name.length > 0 && name.includes(candidate);
  });
}
