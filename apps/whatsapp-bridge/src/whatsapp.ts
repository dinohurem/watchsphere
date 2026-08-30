/**
 * Baileys session management.
 *
 * The only module that talks to WhatsApp. Everything it captures is handed to
 * the outbox; it never calls the backend directly, so a backend outage cannot
 * disturb the WhatsApp connection and vice versa.
 */

import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WASocket,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';

import type { BridgeConfig } from './config.js';
import { classifyJid, isGroupAllowed } from './config.js';
import { toCapturedMessage, type CapturedMessage, type RawMessage } from './format.js';
import type { BridgeState } from './api.js';

export interface WhatsAppBridgeHandlers {
  onMessages: (messages: CapturedMessage[]) => Promise<void> | void;
  onState: (
    state: BridgeState,
    detail?: { phoneNumber?: string | null; error?: string | null; qr?: string | null }
  ) => void;
  onLog: (message: string) => void;
  /** Fired once WhatsApp reports the offline backlog is fully delivered. */
  onBacklogComplete?: () => void;
}

export class WhatsAppBridge {
  private readonly config: BridgeConfig;
  private readonly handlers: WhatsAppBridgeHandlers;
  private socket: WASocket | null = null;
  private stopped = false;
  private reconnectAttempts = 0;
  /** group JID -> subject, so allowlist checks don't re-fetch metadata per message. */
  private groupNames = new Map<string, string>();
  /**
   * Resolves once the group cache has been populated for this connection.
   *
   * History backfill lands within seconds of connecting, while
   * groupFetchAllParticipating is still in flight. Resolving a message against
   * an empty cache would silently drop it, so captures wait on this first.
   */
  private groupsReady: Promise<void> | null = null;

  constructor(config: BridgeConfig, handlers: WhatsAppBridgeHandlers) {
    this.config = config;
    this.handlers = handlers;
  }

  /** Groups currently in scope — reported in the heartbeat. */
  activeGroups(): string[] {
    return [...this.groupNames.values()].filter((name, index, all) => all.indexOf(name) === index);
  }

  async start(usePairingCode = false, phoneNumber?: string): Promise<void> {
    this.stopped = false;
    await this.connect(usePairingCode, phoneNumber);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.socket?.end(undefined);
    this.socket = null;
  }

  private async connect(usePairingCode: boolean, phoneNumber?: string): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(this.config.authDir);
    const { version } = await fetchLatestBaileysVersion();

    this.handlers.onLog(`Connecting with WhatsApp Web v${version.join('.')}`);
    this.handlers.onState('connecting');

    const socket = makeWASocket({
      version,
      auth: state,
      // Baileys is chatty at info level; its logs are not ours.
      logger: pino({ level: 'silent' }) as any,
      printQRInTerminal: false,
      // A bridge only listens. Announcing presence would mark dealer messages
      // as read and show the number as online, which is the opposite of what a
      // passive capture account should do.
      markOnlineOnConnect: false,
      // A daily run is offline between runs, so everything it needs arrives as
      // backfill. Leaving this false is not merely "no history" — there are
      // reports of it suppressing group sync entirely, which would fail silent.
      syncFullHistory: true,
    });

    this.socket = socket;

    if (usePairingCode && !socket.authState.creds.registered) {
      if (!phoneNumber) {
        throw new Error('Pairing-code login requires a phone number (--pair <number>)');
      }
      // Give the socket a moment to come up before requesting the code.
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const code = await socket.requestPairingCode(phoneNumber.replace(/[^0-9]/g, ''));
      this.handlers.onLog(`Pairing code: ${code} — enter it in WhatsApp > Linked devices`);
    }

    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && !usePairingCode) {
        // Reported up on every rotation (~20s) so the admin UI can show a
        // scannable code without shell access to this host.
        this.handlers.onState('qr_required', { qr });
        this.handlers.onLog('Scan this QR in WhatsApp > Linked devices (also shown in admin):');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'open') {
        this.reconnectAttempts = 0;
        const self = socket.user?.id?.split(':')[0] ?? null;
        this.handlers.onState('connected', { phoneNumber: self ? `+${self}` : null });
        this.handlers.onLog(`Connected as ${socket.user?.id ?? 'unknown'}`);
        this.groupsReady = this.refreshGroups();
      }

      if (connection === 'close') {
        // Boom error shape, read structurally to avoid depending on a
        // transitive package just for its type.
        const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)
          ?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        if (loggedOut) {
          // The session was revoked from the phone. Reconnecting cannot fix
          // this; the auth state must be cleared and the number re-paired.
          this.handlers.onState('logged_out', {
            error: 'Session logged out — delete the auth directory and re-pair',
          });
          this.handlers.onLog('Logged out. Re-pair required.');
          return;
        }

        this.handlers.onState('disconnected', {
          error: lastDisconnect?.error?.message ?? `closed (${statusCode ?? 'unknown'})`,
        });
        if (!this.stopped) void this.scheduleReconnect(usePairingCode, phoneNumber);
      }
    });

    // 'notify' is live traffic, 'append' is backfill. A scheduled run needs
    // both: everything sent while it was offline arrives as the latter.
    socket.ev.on('messages.upsert', (event) => {
      void this.handleMessages(event.messages as RawMessage[]);
    });

    // The bulk of an offline backlog arrives here rather than as upserts.
    socket.ev.on('messaging-history.set', (set: { messages?: unknown[] }) => {
      const messages = (set.messages ?? []) as RawMessage[];
      if (messages.length === 0) return;
      this.handlers.onLog(`History sync delivered ${messages.length} message(s)`);
      void this.handleMessages(messages);
    });

    // Marks the end of the offline backlog — a scheduled run can stop here
    // instead of waiting out its timeout.
    socket.ev.on('connection.update', (update: { receivedPendingNotifications?: boolean }) => {
      if (update.receivedPendingNotifications) {
        this.handlers.onLog('Offline backlog fully delivered');
        this.handlers.onBacklogComplete?.();
      }
    });

    socket.ev.on('groups.update', () => {
      this.groupsReady = this.refreshGroups();
    });
  }

  private async scheduleReconnect(usePairingCode: boolean, phoneNumber?: string): Promise<void> {
    this.reconnectAttempts += 1;
    const delay = Math.min(2 ** this.reconnectAttempts * 1000, 60_000);
    this.handlers.onLog(`Reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempts})`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    if (this.stopped) return;

    try {
      await this.connect(usePairingCode, phoneNumber);
    } catch (error) {
      this.handlers.onLog(`Reconnect failed: ${(error as Error).message}`);
      void this.scheduleReconnect(usePairingCode, phoneNumber);
    }
  }

  private async refreshGroups(): Promise<void> {
    try {
      const all = await this.socket?.groupFetchAllParticipating();
      if (!all) return;

      this.groupNames.clear();
      for (const [jid, metadata] of Object.entries(all)) {
        const subject = (metadata as { subject?: string }).subject ?? '';
        if (
          this.config.chatKinds.includes('group') &&
          isGroupAllowed(this.config.groupAllowlist, jid, subject)
        ) {
          this.groupNames.set(jid, subject || jid);
        }
      }

      this.handlers.onLog(
        `Capturing from ${this.groupNames.size} group(s): ${[...this.groupNames.values()].join(', ') || 'none'}`
      );
    } catch (error) {
      this.handlers.onLog(`Could not fetch group metadata: ${(error as Error).message}`);
    }
  }

  /**
   * Name a chat if it is in scope, otherwise undefined.
   *
   * Groups come from cached metadata. There is no equivalent bulk fetch for
   * DMs, channels or broadcasts, so those are matched per message on the
   * sender's push name or the raw JID — the allowlist still gates them, and an
   * unconfigured kind is rejected before the JID is even considered.
   */
  private resolveChatName(raw: RawMessage, jid: string): string | undefined {
    const cached = this.groupNames.get(jid);
    if (cached) return cached;

    const kind = classifyJid(jid);
    if (kind === 'unsupported') return undefined;
    if (!this.config.chatKinds.includes(kind)) return undefined;
    if (kind === 'group') return undefined; // groups are allow-listed via metadata only

    const label = (raw as { pushName?: string }).pushName ?? '';
    if (!isGroupAllowed(this.config.groupAllowlist, jid, label)) return undefined;
    return label || jid;
  }

  private async handleMessages(messages: RawMessage[]): Promise<void> {
    // Never resolve against a cold cache — see groupsReady.
    if (this.groupsReady) await this.groupsReady;

    const captured: CapturedMessage[] = [];

    for (const raw of messages) {
      const groupJid = raw.key?.remoteJid ?? '';
      const groupName = this.resolveChatName(raw, groupJid);

      // Not in the allowlist, or a chat kind we were not asked to capture —
      // dropped before any content is read, so an out-of-scope conversation is
      // never even buffered.
      if (!groupName) continue;

      const message = toCapturedMessage(raw, {
        groupName,
        captureOwnMessages: this.config.captureOwnMessages,
      });
      if (message) captured.push(message);
    }

    if (captured.length > 0) {
      await this.handlers.onMessages(captured);
    }
  }
}
