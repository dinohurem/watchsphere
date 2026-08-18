# @watchsphere/whatsapp-bridge

A long-running WhatsApp client that captures messages from dealer groups and
streams them into the WTS/WTB pipeline. It exists for groups where **"Export
chat" is unavailable** — the ones with Advanced Chat Privacy enabled — which the
upload-based flow cannot reach at all.

## Read this before you deploy it

This uses [Baileys](https://github.com/WhiskeySockets/Baileys), an unofficial
reimplementation of the WhatsApp Web protocol. That has consequences you should
accept deliberately, not discover later:

- **It is against WhatsApp's Terms of Service.** The number can be banned.
- **Use a dedicated number.** Never pair a personal or business-critical
  account. A ban costs you that number and nothing else.
- **It cannot run on Vercel.** The backend is serverless; this process is
  stateful and must stay connected. It needs a small always-on host
  (Railway, Fly, a VPS — anything that keeps a process alive with a persistent
  disk).
- **It captures other people's messages.** Only point it at groups you are
  legitimately a member of, and check what your jurisdiction requires of you as
  a processor of that data.

The allowlist is fail-closed: with no `BRIDGE_GROUPS` configured it captures
nothing rather than everything.

## How it fits the existing pipeline

```
WhatsApp group ──▶ bridge ──▶ POST /whatsapp-bridge/messages ──▶ BridgeMessage
                                                                      │
                                              rendered to export .txt │
                                                                      ▼
                                                    the existing WTS/WTB generator
                                                                      │
                                            matched / needs-review CSVs (admin review)
                                                                      │
                                                                      ▼
                                                 POST /whatsapp/admin/whatsapp/import
```

Captured messages are stored raw and rendered back into WhatsApp export format
on demand, so the generator, matcher, AI passes and dedup all run unchanged.
**Nothing reaches the order book automatically** — an admin still generates and
reviews the CSVs, exactly as with a manual export.

## Setup

```bash
cd apps/whatsapp-bridge
npm install
cp .env.example .env      # fill in BRIDGE_API_TOKEN and BRIDGE_GROUPS
npm run build
```

Set the matching secret on the backend:

```bash
WHATSAPP_BRIDGE_TOKEN=<same value as BRIDGE_API_TOKEN>
```

Without it the bridge endpoints return 503 — an unset secret disables the
feature rather than leaving it open.

### Pairing

QR (default):

```bash
npm start          # scan the QR in WhatsApp > Linked devices
```

Pairing code, for a headless host:

```bash
npm run pair -- +38761234567
```

The session lands in `BRIDGE_AUTH_DIR` (`./auth`). Back that directory up and
never commit it — it grants full access to the account. If the session is
revoked from the phone, the bridge reports `logged_out`; delete the auth
directory and restart, and the bridge will ask to be paired again.

**Re-pairing without shell access.** While the bridge waits to be paired it
pushes the QR up on every rotation, and **Admin → WhatsApp Bridge** renders it.
Scanning from that screen is equivalent to scanning the terminal. A code older
than 60 seconds is withheld, so a dead QR is never shown.

## Running

```bash
npm start
```

It reconnects on its own with exponential backoff, and reports state to
`/whatsapp-bridge/status` every minute. Captures are written to a disk-backed
outbox *before* the network is involved, so a backend outage, a crash or a
restart cannot lose messages — they are only dropped from the queue once the
backend has accepted them.

### Replay mode

Feeds a JSON fixture of raw WhatsApp messages through the exact capture path
with no WhatsApp session involved. Use it to verify a deployment end to end:

```bash
npm run replay -- fixtures/sample-group.json
```

Exits non-zero if anything could not be delivered.

## Admin UI

**Admin → WhatsApp Bridge** (`/admin/whatsapp-bridge`) covers the day-to-day
work: bridge health (with a stale-heartbeat warning, since a silent bridge looks
healthier than a failing one), the pairing QR, captured groups with their
coverage windows, generation over an optional time range, CSV downloads, and
retention cleanup. The generated CSVs are imported on the existing WhatsApp
Import page, unchanged.

## Admin endpoints

| Endpoint | Purpose |
|---|---|
| `GET /whatsapp-bridge/status` | Connection state per bridge; flags stale instances |
| `GET /whatsapp-bridge/groups` | Groups captured, message counts, coverage window |
| `GET /whatsapp-bridge/export` | Download captures as a WhatsApp export `.txt` |
| `POST /whatsapp-bridge/generate` | Run the WTS/WTB generator over captures |
| `DELETE /whatsapp-bridge/messages` | Retention cleanup (by group and/or age) |

`export` and `generate` accept `start` / `end` to bound the window, and
`tz_offset_minutes` to shift stored UTC timestamps into local time — real
exports are written in the phone's local time with no timezone marker, so match
this to the number's timezone if you compare against manual exports.

## Testing

```bash
npm test          # builds, then runs the unit suite
```

Backend side:

```bash
cd apps/backend && ./venv/bin/python -m pytest tests/
```

## Limitations

- **Text only.** Image captions are captured; the images themselves are not, so
  the image-based variant disambiguation layer still needs a manual
  "export with media" `.zip`.
- **No history.** Capture starts when the bridge connects; it does not backfill
  messages sent before that.
- **One number, one session.** Running two bridges on the same number will fight
  over the session. Use separate numbers or a single instance.
