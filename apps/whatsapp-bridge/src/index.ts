/**
 * Bridge entrypoint.
 *
 * Modes:
 *   (default)          pair/reconnect and capture live
 *   --pair <number>    first-time login via pairing code instead of QR
 *   --replay <file>    feed a JSON fixture of raw messages through the exact
 *                      capture path and ship it — no WhatsApp session needed.
 *                      This is how the pipeline is exercised end to end.
 */

import { readFile } from 'node:fs/promises';

import { ApiClient, type BridgeState } from './api.js';
import { loadConfig, type BridgeConfig } from './config.js';
import { Flusher } from './flusher.js';
import { toCapturedMessage, type CapturedMessage, type RawMessage } from './format.js';
import { Outbox } from './outbox.js';
import { WhatsAppBridge } from './whatsapp.js';

function log(message: string): void {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

interface Args {
  mode: 'live' | 'pair' | 'replay';
  value?: string;
}

export function parseArgs(argv: string[]): Args {
  const pairIndex = argv.indexOf('--pair');
  if (pairIndex !== -1) {
    return { mode: 'pair', value: argv[pairIndex + 1] };
  }

  const replayIndex = argv.indexOf('--replay');
  if (replayIndex !== -1) {
    return { mode: 'replay', value: argv[replayIndex + 1] };
  }

  return { mode: 'live' };
}

function buildPipeline(config: BridgeConfig) {
  const outbox = new Outbox(config.outboxPath, { onWarn: (message) => log(`WARN ${message}`) });
  const api = new ApiClient({
    baseUrl: config.apiBaseUrl,
    token: config.apiToken,
    bridgeId: config.bridgeId,
  });
  const flusher = new Flusher(outbox, api, {
    batchSize: config.maxBatchSize,
    intervalMs: config.flushIntervalMs,
    onFlush: (sent, inserted, remaining) =>
      log(`Flushed ${sent} message(s): ${inserted} new, ${remaining} still queued`),
    onError: (error) => log(`Flush failed (will retry): ${error.message}`),
  });

  return { outbox, api, flusher };
}

/** Replay a fixture of raw WhatsApp messages through the real capture path. */
async function runReplay(config: BridgeConfig, fixturePath: string): Promise<void> {
  const raw = await readFile(fixturePath, 'utf8');
  const parsed = JSON.parse(raw) as { groupName?: string; messages: RawMessage[] };
  const groupName = parsed.groupName ?? 'Replay Group';

  const { outbox, flusher } = buildPipeline(config);
  await outbox.load();

  const captured: CapturedMessage[] = [];
  for (const message of parsed.messages) {
    const converted = toCapturedMessage(message, {
      groupName,
      captureOwnMessages: config.captureOwnMessages,
    });
    if (converted) captured.push(converted);
  }

  log(`Replay: ${parsed.messages.length} raw message(s) → ${captured.length} captured`);
  await outbox.add(captured);

  const result = await flusher.flush();
  log(`Replay complete: sent ${result.sent}, newly stored ${result.inserted}`);

  if (outbox.size() > 0) {
    log(`WARN ${outbox.size()} message(s) could not be delivered and remain queued`);
    process.exitCode = 1;
  }
}

async function runLive(config: BridgeConfig, usePairingCode: boolean, phoneNumber?: string): Promise<void> {
  const { outbox, api, flusher } = buildPipeline(config);
  await outbox.load();
  if (outbox.size() > 0) {
    log(`Restored ${outbox.size()} undelivered message(s) from the outbox`);
  }

  if (config.groupAllowlist.length === 0) {
    log('WARN BRIDGE_GROUPS is empty — no chat is in scope, nothing will be captured.');
  }

  let currentState: BridgeState = 'starting';
  let phone: string | null = null;
  let lastError: string | null = null;
  let pairingQr: string | null = null;
  let backlogDelivered = false;

  // Hoisted so onState can report a state change immediately rather than
  // waiting for the next heartbeat tick — a pairing QR rotates every ~20s and
  // would be dead by then.
  async function sendHeartbeat(): Promise<void> {
    try {
      await api.sendHeartbeat({
        state: currentState,
        phoneNumber: phone,
        groups: bridge.activeGroups(),
        error: lastError,
        qr: pairingQr,
      });
    } catch (error) {
      log(`Heartbeat failed: ${(error as Error).message}`);
    }
  }

  const bridge = new WhatsAppBridge(config, {
    onMessages: async (messages) => {
      const added = await outbox.add(messages);
      if (added > 0) log(`Captured ${added} message(s)`);
    },
    onState: (state, detail) => {
      currentState = state;
      if (detail?.phoneNumber !== undefined) phone = detail.phoneNumber;
      lastError = detail?.error ?? null;
      // Hold the QR only while pairing is actually pending.
      pairingQr = state === 'qr_required' ? detail?.qr ?? pairingQr : null;
      log(`State: ${state}${lastError ? ` (${lastError})` : ''}`);
      void sendHeartbeat();
    },
    onLog: log,
    onBacklogComplete: () => {
      backlogDelivered = true;
    },
  });

  // A scheduled run exits once WhatsApp says the backlog is delivered — or
  // after a timeout, because that signal is not contractual. Railway skips the
  // next cron firing if the previous run is still alive, so hanging here would
  // silently stop the daily ingest rather than fail it.
  if (config.runOnce) {
    let backlogSettled = false;
    const finishOnce = async (reason: string) => {
      if (backlogSettled) return;
      backlogSettled = true;
      log(`Run-once complete (${reason}) — flushing and exiting`);
      clearInterval(heartbeatTimer);
      clearInterval(backlogPoll);
      flusher.stop();
      const result = await flusher.flush();
      await bridge.stop();
      currentState = 'disconnected';
      await sendHeartbeat();
      log(`Delivered ${result.sent} message(s), ${result.inserted} new`);
      // Anything still queued was not accepted. It survives on disk and the
      // next run retries it, but the exit code has to say so or a failing
      // ingest looks like a clean run in Railway's history.
      const undelivered = outbox.size();
      if (undelivered > 0) {
        log(`WARN ${undelivered} message(s) left in the outbox for the next run`);
        process.exitCode = 1;
      }
      process.exit(process.exitCode ?? 0);
    };

    const backlogPoll = setInterval(() => {
      // Give the flusher one interval to drain after the backlog lands.
      if (backlogDelivered) void finishOnce('backlog delivered');
    }, 2_000);
    backlogPoll.unref?.();

    const deadline = setTimeout(
      () => void finishOnce(`timed out after ${Math.round(config.onceTimeoutMs / 1000)}s`),
      config.onceTimeoutMs
    );
    deadline.unref?.();
  }

  flusher.start();
  const heartbeatTimer = setInterval(() => void sendHeartbeat(), config.heartbeatIntervalMs);
  heartbeatTimer.unref?.();

  const shutdown = async (signal: string) => {
    log(`${signal} received — flushing before exit`);
    clearInterval(heartbeatTimer);
    flusher.stop();
    await flusher.flush();
    await bridge.stop();
    await sendHeartbeat();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await bridge.start(usePairingCode, phoneNumber);
  await sendHeartbeat();
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig();

  log(`Bridge ${config.bridgeId} → ${config.apiBaseUrl} (mode: ${args.mode})`);

  if (args.mode === 'replay') {
    if (!args.value) throw new Error('--replay requires a fixture path');
    await runReplay(config, args.value);
    return;
  }

  await runLive(config, args.mode === 'pair', args.value);
}

// Only auto-run as a program; importing this module in tests must not connect.
const invokedDirectly = process.argv[1]?.endsWith('index.js') ?? false;
if (invokedDirectly) {
  main().catch((error) => {
    log(`FATAL ${(error as Error).message}`);
    process.exit(1);
  });
}
