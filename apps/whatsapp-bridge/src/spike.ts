/**
 * THROWAWAY SPIKE — not part of the bridge, delete once it has answered.
 *
 * Question: can the bridge connect once a day, receive everything sent while it
 * was offline, and cover all chat types — instead of holding a socket open 24/7?
 *
 * The live bridge cannot answer this because it discards backfill outright:
 *
 *     syncFullHistory: false
 *     if (event.type !== 'notify') return;   // 'append' is history backfill
 *
 * This harness reverses both, observes every chat rather than an allowlist, and
 * records only METADATA — jid, kind, message id, timestamp, sender, text LENGTH.
 * Never message text. It also never contacts the WatchSphere backend: it is an
 * instrument, not an ingest path.
 *
 * Usage
 *   npm run build
 *   node dist/src/spike.js --pair +38761234567   # day 0: link, record baseline
 *   <ctrl-c, leave it off for ~24h>
 *   node dist/src/spike.js                       # day 1: reconnect, report gap
 *
 * Flags
 *   --pair <number>   pairing-code login instead of QR
 *   --full=false      run again with syncFullHistory off, to compare
 *   --window <mins>   how long to listen before reporting (default 3)
 *   --auth <dir>      session dir (default ./spike-auth, separate from the bridge)
 *   --out <file>      JSONL observation log (default ./spike-observations.jsonl)
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';

type Kind = 'group' | 'dm' | 'newsletter' | 'broadcast' | 'status' | 'other';

interface Observation {
  runId: string;
  /** Which path delivered it: the event name, plus upsert type when relevant. */
  source: string;
  jid: string;
  kind: Kind;
  chatName?: string;
  messageId: string;
  /** Message timestamp in epoch seconds, as WhatsApp reports it. */
  ts: number | null;
  fromMe: boolean;
  sender?: string;
  /** Length only — the spike never records what anyone wrote. */
  textLength: number;
}

const args = process.argv.slice(2);
const flag = (name: string, fallback?: string): string | undefined => {
  const exact = args.indexOf(`--${name}`);
  if (exact !== -1 && args[exact + 1] && !args[exact + 1].startsWith('--')) return args[exact + 1];
  const inline = args.find((a) => a.startsWith(`--${name}=`));
  if (inline) return inline.split('=').slice(1).join('=');
  return fallback;
};

const PAIR_NUMBER = flag('pair');
const USE_PAIRING = args.includes('--pair') || Boolean(PAIR_NUMBER);
const SYNC_FULL = flag('full', 'true') !== 'false';
const WINDOW_MIN = Number(flag('window', '3'));
const AUTH_DIR = flag('auth', './spike-auth')!;
const OUT_FILE = flag('out', './spike-observations.jsonl')!;
const RUN_ID = `run-${Math.floor(Date.now() / 1000)}`;

const classify = (jid: string): Kind => {
  if (jid.endsWith('@g.us')) return 'group';
  if (jid.endsWith('@newsletter')) return 'newsletter';
  if (jid === 'status@broadcast') return 'status';
  if (jid.endsWith('@broadcast')) return 'broadcast';
  if (jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid')) return 'dm';
  return 'other';
};

const textLengthOf = (msg: any): number => {
  const m = msg?.message ?? {};
  const text =
    m.conversation ??
    m.extendedTextMessage?.text ??
    m.imageMessage?.caption ??
    m.videoMessage?.caption ??
    m.documentMessage?.caption ??
    '';
  return typeof text === 'string' ? text.length : 0;
};

const observations: Observation[] = [];
const seen = new Set<string>();

function record(source: string, raw: any, chatName?: string): void {
  const jid: string = raw?.key?.remoteJid ?? '';
  const messageId: string = raw?.key?.id ?? '';
  if (!jid || !messageId) return;

  const dedupKey = `${jid}|${messageId}`;
  if (seen.has(dedupKey)) return;
  seen.add(dedupKey);

  const tsRaw = raw?.messageTimestamp;
  const ts =
    typeof tsRaw === 'number' ? tsRaw : tsRaw?.low ?? (tsRaw ? Number(tsRaw) : null);

  const observation: Observation = {
    runId: RUN_ID,
    source,
    jid,
    kind: classify(jid),
    chatName,
    messageId,
    ts: Number.isFinite(ts as number) ? (ts as number) : null,
    fromMe: Boolean(raw?.key?.fromMe),
    sender: raw?.key?.participant ?? undefined,
    textLength: textLengthOf(raw),
  };

  observations.push(observation);
  mkdirSync(dirname(OUT_FILE) === '.' ? '.' : dirname(OUT_FILE), { recursive: true });
  appendFileSync(OUT_FILE, `${JSON.stringify(observation)}\n`);
}

function priorRuns(): Map<string, { count: number; newest: number | null }> {
  const runs = new Map<string, { count: number; newest: number | null }>();
  if (!existsSync(OUT_FILE)) return runs;
  for (const line of readFileSync(OUT_FILE, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const o = JSON.parse(line) as Observation;
      if (o.runId === RUN_ID) continue;
      const entry = runs.get(o.runId) ?? { count: 0, newest: null };
      entry.count += 1;
      if (o.ts && (!entry.newest || o.ts > entry.newest)) entry.newest = o.ts;
      runs.set(o.runId, entry);
    } catch {
      /* a partial last line is not worth failing the run over */
    }
  }
  return runs;
}

const iso = (ts: number | null): string =>
  ts ? new Date(ts * 1000).toISOString().replace('T', ' ').slice(0, 19) : 'unknown';

function report(): void {
  const previous = priorRuns();
  const line = '─'.repeat(72);

  console.log(`\n${line}\nSPIKE RESULT  (${RUN_ID})\n${line}`);
  console.log(`syncFullHistory : ${SYNC_FULL}`);
  console.log(`observed        : ${observations.length} messages, ${seen.size} unique`);

  if (previous.size > 0) {
    console.log('\nPrevious runs in this log:');
    for (const [runId, info] of previous) {
      console.log(`  ${runId}: ${info.count} messages, newest ${iso(info.newest)}`);
    }
    const lastNewest = [...previous.values()]
      .map((v) => v.newest)
      .filter((v): v is number => v !== null)
      .sort((a, b) => b - a)[0];

    if (lastNewest) {
      const backfilled = observations.filter((o) => o.ts !== null && o.ts > lastNewest);
      const gapHours = ((Date.now() / 1000 - lastNewest) / 3600).toFixed(1);
      console.log(`\n>>> THE ANSWER <<<`);
      console.log(`  Gap since last run : ${gapHours}h`);
      console.log(`  Messages recovered from that gap: ${backfilled.length}`);
      if (backfilled.length > 0) {
        const times = backfilled.map((o) => o.ts as number).sort((a, b) => a - b);
        console.log(`  Oldest recovered   : ${iso(times[0])}`);
        console.log(`  Newest recovered   : ${iso(times[times.length - 1])}`);
        console.log(`  => Daily-connect IS viable for a ${gapHours}h gap.`);
      } else {
        console.log(`  => Nothing from the gap came back. Daily-connect NOT viable as-is.`);
      }
    }
  } else {
    console.log('\nBaseline run recorded. Stop the process, wait ~24h, run it again.');
  }

  const bySource = new Map<string, number>();
  for (const o of observations) bySource.set(o.source, (bySource.get(o.source) ?? 0) + 1);
  console.log('\nDelivered via:');
  for (const [source, count] of [...bySource].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(6)}  ${source}`);
  }

  const byKind = new Map<Kind, Set<string>>();
  for (const o of observations) {
    if (!byKind.has(o.kind)) byKind.set(o.kind, new Set());
    byKind.get(o.kind)!.add(o.jid);
  }
  console.log('\nChat types covered (question 3):');
  for (const kind of ['group', 'dm', 'newsletter', 'broadcast', 'status', 'other'] as Kind[]) {
    const chats = byKind.get(kind);
    const msgs = observations.filter((o) => o.kind === kind).length;
    console.log(
      `  ${kind.padEnd(11)} ${chats ? `${chats.size} chat(s), ${msgs} message(s)` : '— none seen —'}`
    );
  }

  const stamped = observations.map((o) => o.ts).filter((t): t is number => t !== null);
  if (stamped.length) {
    stamped.sort((a, b) => a - b);
    console.log(`\nOldest message seen : ${iso(stamped[0])}`);
    console.log(`Newest message seen : ${iso(stamped[stamped.length - 1])}`);
    console.log(`(how far back a fresh sync reaches)`);
  }
  console.log(`\nFull log: ${OUT_FILE}\n${line}\n`);
}

async function main(): Promise<void> {
  console.log(`Spike ${RUN_ID} — syncFullHistory=${SYNC_FULL}, listening ${WINDOW_MIN} min`);
  console.log(`Auth dir: ${AUTH_DIR}   (delete it to force re-pairing)\n`);

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const socket = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }) as any,
    printQRInTerminal: false,
    // Stay invisible: never mark dealer messages read, never appear online.
    markOnlineOnConnect: false,
    // The whole point of the spike.
    syncFullHistory: SYNC_FULL,
  });

  if (USE_PAIRING && !socket.authState.creds.registered) {
    if (!PAIR_NUMBER) throw new Error('--pair needs a number, e.g. --pair +38761234567');
    await new Promise((r) => setTimeout(r, 3000));
    const code = await socket.requestPairingCode(PAIR_NUMBER.replace(/[^0-9]/g, ''));
    console.log(`Pairing code: ${code}  — WhatsApp > Linked devices > Link with phone number\n`);
  }

  socket.ev.on('creds.update', saveCreds);

  socket.ev.on('connection.update', (update: any) => {
    const { connection, lastDisconnect, qr, receivedPendingNotifications } = update;
    if (qr && !USE_PAIRING) {
      console.log('Scan this in WhatsApp > Linked devices:\n');
      qrcode.generate(qr, { small: true });
    }
    if (receivedPendingNotifications) {
      console.log('[sync] receivedPendingNotifications — offline backlog delivered');
    }
    if (connection === 'open') console.log('[conn] open');
    if (connection === 'close') {
      const code = (lastDisconnect?.error as any)?.output?.statusCode;
      console.log(`[conn] closed (${code ?? 'unknown'})`);
      if (code === DisconnectReason.loggedOut) {
        console.log('Session was revoked from the phone. Delete the auth dir and re-pair.');
        report();
        process.exit(2);
      }
    }
  });

  // The two paths the live bridge throws away.
  socket.ev.on('messaging-history.set', (set: any) => {
    const messages = set?.messages ?? [];
    console.log(
      `[hist] messaging-history.set: ${messages.length} message(s), ` +
        `${set?.chats?.length ?? 0} chat(s), syncType=${set?.syncType ?? '?'}, isLatest=${set?.isLatest}`
    );
    for (const m of messages) record('messaging-history.set', m);
  });

  socket.ev.on('messages.upsert', (event: any) => {
    for (const m of event.messages ?? []) record(`messages.upsert:${event.type}`, m);
  });

  setTimeout(
    () => {
      report();
      void socket.end(undefined);
      process.exit(0);
    },
    WINDOW_MIN * 60_000
  );

  process.on('SIGINT', () => {
    report();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Spike failed:', error);
  report();
  process.exit(1);
});
