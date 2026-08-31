import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, it } from 'node:test';

import { ApiClient, ApiError } from '../src/api.js';
import { Flusher } from '../src/flusher.js';
import type { CapturedMessage } from '../src/format.js';
import { Outbox } from '../src/outbox.js';

let path: string;

beforeEach(async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flusher-'));
  path = join(directory, 'outbox.jsonl');
});

function message(id: string): CapturedMessage {
  return {
    message_id: id,
    group_jid: '120363999@g.us',
    group_name: 'HK Dealers',
    sender: '+85265472648',
    sender_phone: '+85265472648',
    push_name: null,
    content: `msg ${id}`,
    timestamp: '2026-03-05T16:38:28.000Z',
    from_me: false,
    has_media: false,
    attachments: [],
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function clientWith(fetchImpl: typeof fetch, maxRetries = 0): ApiClient {
  return new ApiClient({
    baseUrl: 'http://backend/api/v1',
    token: 'secret',
    bridgeId: 'bridge-1',
    maxRetries,
    fetchImpl,
    sleepImpl: async () => {},
  });
}

describe('ApiClient', () => {
  it('sends the bridge token and batch payload', async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    const api = clientWith(async (url, init) => {
      captured = { url: String(url), init: init as RequestInit };
      return jsonResponse({ received: 1, inserted: 1, duplicates: 0 });
    });

    await api.sendMessages([message('a')]);

    assert.equal(captured!.url, 'http://backend/api/v1/whatsapp-bridge/messages');
    assert.equal((captured!.init.headers as Record<string, string>)['X-Bridge-Token'], 'secret');
    const body = JSON.parse(captured!.init.body as string);
    assert.equal(body.bridge_id, 'bridge-1');
    assert.equal(body.messages.length, 1);
  });

  it('retries transport failures', async () => {
    let attempts = 0;
    const api = clientWith(async () => {
      attempts += 1;
      if (attempts < 3) throw new Error('ECONNREFUSED');
      return jsonResponse({ received: 1, inserted: 1, duplicates: 0 });
    }, 4);

    const result = await api.sendMessages([message('a')]);

    assert.equal(attempts, 3);
    assert.equal(result.inserted, 1);
  });

  it('retries 5xx', async () => {
    let attempts = 0;
    const api = clientWith(async () => {
      attempts += 1;
      if (attempts === 1) return jsonResponse({ detail: 'boom' }, 503);
      return jsonResponse({ received: 1, inserted: 1, duplicates: 0 });
    }, 4);

    await api.sendMessages([message('a')]);
    assert.equal(attempts, 2);
  });

  it('sends the pairing QR on the heartbeat', async () => {
    // This is what lets an admin re-pair from the web UI instead of needing
    // shell access to the bridge host.
    let body: any = null;
    const api = clientWith(async (_url, init) => {
      body = JSON.parse((init as RequestInit).body as string);
      return jsonResponse({ ok: true });
    });

    await api.sendHeartbeat({ state: 'qr_required', qr: '2@abc,def' });

    assert.equal(body.state, 'qr_required');
    assert.equal(body.qr, '2@abc,def');
    assert.equal(body.bridge_id, 'bridge-1');
  });

  it('sends a null QR when not pairing, so a dead code is cleared', async () => {
    let body: any = null;
    const api = clientWith(async (_url, init) => {
      body = JSON.parse((init as RequestInit).body as string);
      return jsonResponse({ ok: true });
    });

    await api.sendHeartbeat({ state: 'connected', phoneNumber: '+38761111111' });

    assert.equal(body.qr, null);
  });

  it('does not retry a rejected token', async () => {
    let attempts = 0;
    const api = clientWith(async () => {
      attempts += 1;
      return jsonResponse({ detail: 'Invalid bridge token' }, 401);
    }, 4);

    await assert.rejects(() => api.sendMessages([message('a')]), ApiError);
    assert.equal(attempts, 1);
  });
});

describe('Flusher', () => {
  it('delivers everything and empties the outbox', async () => {
    const outbox = new Outbox(path);
    await outbox.load();
    await outbox.add([message('a'), message('b')]);

    const api = clientWith(async (_url, init) => {
      const body = JSON.parse((init as RequestInit).body as string);
      return jsonResponse({
        received: body.messages.length,
        inserted: body.messages.length,
        duplicates: 0,
      });
    });
    const flusher = new Flusher(outbox, api, { batchSize: 10, intervalMs: 1000 });

    const result = await flusher.flush();

    assert.deepEqual(result, { sent: 2, inserted: 2 });
    assert.equal(outbox.size(), 0);
  });

  it('sends in batches until drained', async () => {
    const outbox = new Outbox(path);
    await outbox.load();
    await outbox.add([message('a'), message('b'), message('c')]);

    const batchSizes: number[] = [];
    const api = clientWith(async (_url, init) => {
      const body = JSON.parse((init as RequestInit).body as string);
      batchSizes.push(body.messages.length);
      return jsonResponse({
        received: body.messages.length,
        inserted: body.messages.length,
        duplicates: 0,
      });
    });
    const flusher = new Flusher(outbox, api, { batchSize: 2, intervalMs: 1000 });

    await flusher.flush();

    assert.deepEqual(batchSizes, [2, 1]);
    assert.equal(outbox.size(), 0);
  });

  it('keeps messages queued when the backend is down', async () => {
    const outbox = new Outbox(path);
    await outbox.load();
    await outbox.add([message('a'), message('b')]);

    const errors: Error[] = [];
    const api = clientWith(async () => {
      throw new Error('ECONNREFUSED');
    });
    const flusher = new Flusher(outbox, api, {
      batchSize: 10,
      intervalMs: 1000,
      onError: (error) => errors.push(error),
    });

    await flusher.flush();

    assert.equal(outbox.size(), 2, 'nothing may be acked when delivery failed');
    assert.equal(errors.length, 1);
  });

  it('keeps the undelivered remainder after a mid-drain failure', async () => {
    const outbox = new Outbox(path);
    await outbox.load();
    await outbox.add([message('a'), message('b'), message('c'), message('d')]);

    let calls = 0;
    const api = clientWith(async (_url, init) => {
      calls += 1;
      if (calls === 2) throw new Error('connection reset');
      const body = JSON.parse((init as RequestInit).body as string);
      return jsonResponse({
        received: body.messages.length,
        inserted: body.messages.length,
        duplicates: 0,
      });
    });
    const flusher = new Flusher(outbox, api, { batchSize: 2, intervalMs: 1000, onError: () => {} });

    await flusher.flush();

    assert.equal(outbox.size(), 2);
    assert.deepEqual(
      outbox.peek(10).map((m) => m.message_id),
      ['c', 'd']
    );
  });

  it('counts server-side duplicates as delivered', async () => {
    const outbox = new Outbox(path);
    await outbox.load();
    await outbox.add([message('a')]);

    const api = clientWith(async () => jsonResponse({ received: 1, inserted: 0, duplicates: 1 }));
    const flusher = new Flusher(outbox, api, { batchSize: 10, intervalMs: 1000 });

    const result = await flusher.flush();

    assert.deepEqual(result, { sent: 1, inserted: 0 });
    assert.equal(outbox.size(), 0, 'a duplicate is still delivered — it must not be retried forever');
  });

  it('does not run two drains at once', async () => {
    const outbox = new Outbox(path);
    await outbox.load();
    await outbox.add([message('a')]);

    let inFlight = 0;
    let maxInFlight = 0;
    const api = clientWith(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 10));
      inFlight -= 1;
      return jsonResponse({ received: 1, inserted: 1, duplicates: 0 });
    });
    const flusher = new Flusher(outbox, api, { batchSize: 10, intervalMs: 1000 });

    await Promise.all([flusher.flush(), flusher.flush()]);

    assert.equal(maxInFlight, 1);
  });
});
