# Getting dealer messages into WatchSphere

Two paths feed the same pipeline. Both POST to `/whatsapp-bridge/messages`,
which is idempotent on `(group_jid, message_id)`, so they can run side by side
or replace each other without duplicating a thing.

| | **Local reader** (preferred) | **Baileys bridge** (backup) |
|---|---|---|
| How | Reads WhatsApp for Mac's own SQLite file | Pairs an unofficial WhatsApp client |
| Ban risk | **None** — nothing contacts WhatsApp | Real; the number can be banned |
| Terms of Service | Reading your own files | Violation |
| Dedicated number | Not needed | Needed, and must be invited to each group |
| History | Everything the Mac holds — years | Only what arrives after it connects |
| Media | Linked to its message by a foreign key | Captions only; images not captured |
| Cadence | Every few minutes | Cron, or always-on |
| Needs | The Mac awake, WhatsApp signed in | A host that stays up |

Both reach groups with **Advanced Chat Privacy** enabled, where *Export chat*
is greyed out — the local reader because the app must store messages to display
them, the bridge because linked devices still sync.

**Use the local reader.** The bridge exists for when the Mac cannot be relied on.

---

## Local reader

`scripts/whatsapp_local_sync.py` reads
`~/Library/Group Containers/group.net.whatsapp.WhatsApp.shared/ChatStorage.sqlite`
— a plain, unencrypted SQLite database that needs **no Full Disk Access**.

```bash
export BRIDGE_API_BASE_URL=https://watchsphere-backend-production.up.railway.app/api/v1
export BRIDGE_API_TOKEN=…                 # must match WHATSAPP_BRIDGE_TOKEN on the backend
export WA_LOCAL_CHATS="HK Dealers,EU Trade"

python scripts/whatsapp_local_sync.py --dry-run   # see what it would send
python scripts/whatsapp_local_sync.py
```

`WA_LOCAL_CHATS` is **fail-closed**: unset means nothing is in scope, never
everything. Entries match a chat's name (case-insensitive substring) or its JID
exactly. One-to-one chats need `--include-dms`, off by default because a private
conversation is private in a way a dealer broadcast group is not.

State lives in `~/.watchsphere/whatsapp-local-sync.json` — the highest row id
delivered. `--reset` re-reads from the beginning to backfill history; the
backend deduplicates, so it does not create duplicates.

Exit codes: `0` delivered, `1` delivery failed, `2` the schema moved.

### Two things that fail silently if you get them wrong

**Never open the live file with `immutable=1`.** That makes SQLite ignore the
`-wal`, where the newest messages sit until it is checkpointed — so a reader
returns stale data and misses exactly what an incremental sync is looking for.
The script snapshots the database with its `-wal` and `-shm` to a temp
directory and reads the copy. The original is only ever read.

**The schema is undocumented and moves with app releases.** Every read is
preceded by a check of the tables and columns this depends on, and a mismatch
raises with exit code 2. "No new messages" and "the schema changed underneath
us" must never look the same from the outside.

### Running it on a schedule

`~/Library/LaunchAgents/io.watchsphere.whatsapp-sync.plist`, then
`launchctl load` it:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>io.watchsphere.whatsapp-sync</string>
  <key>ProgramArguments</key>
  <array>
    <string>/path/to/apps/backend/venv/bin/python</string>
    <string>/path/to/apps/backend/scripts/whatsapp_local_sync.py</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>BRIDGE_API_BASE_URL</key><string>https://…/api/v1</string>
    <key>BRIDGE_API_TOKEN</key><string>…</string>
    <key>WA_LOCAL_CHATS</key><string>HK Dealers,EU Trade</string>
  </dict>
  <key>StartInterval</key><integer>300</integer>
  <key>StandardErrorPath</key><string>/tmp/watchsphere-wa-sync.err</string>
</dict></plist>
```

Watch the error log. Exit code 2 there means an app update moved the schema and
the reader needs updating — until then it is syncing nothing, loudly.

## Turning captures into orders

Either path only fills `BridgeMessage`. Publishing is a separate step:

```bash
curl -X POST "$BRIDGE_API_BASE_URL/whatsapp-bridge/daily-ingest" \
  -H "X-Bridge-Token: $BRIDGE_API_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"hours": 24, "mode": "wts"}'
```

**Only matched rows are published.** Needs-review rows, watches missing from the
catalogue, and anything the price check quarantines are left for a human. An
unattended path must not be able to put a price into the order book that
contradicts its peers.

## What you are taking on

Neither path is neutral. Both capture messages other people wrote in a group,
into a database they know nothing about — and the local reader reaches chats
whose members deliberately turned on a setting to stop bulk extraction. That is
a decision about other people's data, not a technical detail. Only point either
at groups you are legitimately a member of, and check what your jurisdiction
asks of you as a processor of that data.
