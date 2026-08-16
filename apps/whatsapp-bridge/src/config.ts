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
   * Group names or JIDs to capture from. Case-insensitive substring match on
   * the group subject, or exact match on the JID. Empty captures nothing.
   */
  groupAllowlist: string[];
  flushIntervalMs: number;
  maxBatchSize: number;
  heartbeatIntervalMs: number;
  /** Capture messages sent from the bridge's own number. Off by default. */
  captureOwnMessages: boolean;
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
 * Decide whether a group is in scope.
 *
 * Matching on the subject is what makes this usable — an operator knows the
 * group by name, not by its numeric JID.
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
