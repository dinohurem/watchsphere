import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

import type { CapturedMessage } from '../src/format.js';
import { Outbox } from '../src/outbox.js';

let directory: string;
let path: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'outbox-'));
  path = join(directory, 'outbox.jsonl');
});

afterEach(() => {
  directory = '';
});

function message(id: string, content = 'WTS 126610LN'): CapturedMessage {
  return {
    message_id: id,
    group_jid: '120363999@g.us',
    group_name: 'HK Dealers',
    sender: '+85265472648',
    sender_phone: '+85265472648',
    push_name: 'HK Dealer',
    content,
    timestamp: '2026-03-05T16:38:28.000Z',
    from_me: false,
    has_media: false,
    attachments: [],
  };
}

describe('Outbox', () => {
  it('starts empty when no file exists', async () => {
    const outbox = new Outbox(path);
    await outbox.load();
    assert.equal(outbox.size(), 0);
  });

  it('buffers messages and persists them', async () => {
    const outbox = new Outbox(path);
    await outbox.load();

    const added = await outbox.add([message('a'), message('b')]);

    assert.equal(added, 2);
    assert.equal(outbox.size(), 2);
    const contents = await readFile(path, 'utf8');
    assert.equal(contents.trim().split('\n').length, 2);
  });

  it('survives a restart — captures are the only copy that exists', async () => {
    const first = new Outbox(path);
    await first.load();
    await first.add([message('a'), message('b')]);

    const second = new Outbox(path);
    await second.load();

    assert.equal(second.size(), 2);
    assert.equal(second.peek(10)[0].message_id, 'a');
  });

  it('ignores messages already queued', async () => {
    const outbox = new Outbox(path);
    await outbox.load();
    await outbox.add([message('a')]);

    const added = await outbox.add([message('a'), message('b')]);

    assert.equal(added, 1);
    assert.equal(outbox.size(), 2);
  });

  it('acks only what was delivered', async () => {
    const outbox = new Outbox(path);
    await outbox.load();
    await outbox.add([message('a'), message('b'), message('c')]);

    await outbox.ack(2);

    assert.equal(outbox.size(), 1);
    assert.equal(outbox.peek(10)[0].message_id, 'c');
  });

  it('persists the ack so acked messages do not come back', async () => {
    const first = new Outbox(path);
    await first.load();
    await first.add([message('a'), message('b')]);
    await first.ack(1);

    const second = new Outbox(path);
    await second.load();

    assert.equal(second.size(), 1);
    assert.equal(second.peek(10)[0].message_id, 'b');
  });

  it('empties the file once everything is delivered', async () => {
    const outbox = new Outbox(path);
    await outbox.load();
    await outbox.add([message('a')]);
    await outbox.ack(1);

    assert.equal((await readFile(path, 'utf8')).trim(), '');
  });

  it('re-queues a message after it was acked and captured again', async () => {
    const outbox = new Outbox(path);
    await outbox.load();
    await outbox.add([message('a')]);
    await outbox.ack(1);

    assert.equal(await outbox.add([message('a')]), 1);
  });

  it('skips a torn line rather than refusing to start', async () => {
    const warnings: string[] = [];
    await writeFile(path, `${JSON.stringify(message('a'))}\n{"broken": `, 'utf8');

    const outbox = new Outbox(path, { onWarn: (m) => warnings.push(m) });
    await outbox.load();

    assert.equal(outbox.size(), 1);
    assert.equal(warnings.length, 1);
  });

  it('drops the oldest captures when the cap is hit', async () => {
    const warnings: string[] = [];
    const outbox = new Outbox(path, { maxSize: 3, onWarn: (m) => warnings.push(m) });
    await outbox.load();

    await outbox.add([message('a'), message('b')]);
    await outbox.add([message('c'), message('d')]);

    assert.equal(outbox.size(), 3);
    assert.deepEqual(
      outbox.peek(10).map((m) => m.message_id),
      ['b', 'c', 'd']
    );
    assert.equal(warnings.length, 1);
  });

  it('peek does not remove anything', async () => {
    const outbox = new Outbox(path);
    await outbox.load();
    await outbox.add([message('a'), message('b')]);

    assert.equal(outbox.peek(1).length, 1);
    assert.equal(outbox.size(), 2);
  });
});
