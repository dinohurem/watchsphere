import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  extractContent,
  isGroupJid,
  normalizeTimestamp,
  senderIdentity,
  toCapturedMessage,
  unwrapMessage,
} from '../src/format.js';

const GROUP = '120363999@g.us';

function raw(overrides: Record<string, any> = {}) {
  return {
    key: {
      remoteJid: GROUP,
      fromMe: false,
      id: 'MSG1',
      participant: '85265472648@s.whatsapp.net',
      ...(overrides.key ?? {}),
    },
    message: overrides.message ?? { conversation: 'WTS 126610LN 12,000 USD' },
    // `in` rather than `??` so a test can pass an explicit null.
    messageTimestamp: 'messageTimestamp' in overrides ? overrides.messageTimestamp : 1772728708,
    pushName: 'pushName' in overrides ? overrides.pushName : 'HK Dealer',
    ...(overrides.messageStubType !== undefined ? { messageStubType: overrides.messageStubType } : {}),
  };
}

describe('extractContent', () => {
  it('reads a plain conversation', () => {
    const result = extractContent({ conversation: 'hello' });
    assert.equal(result.text, 'hello');
    assert.equal(result.hasMedia, false);
  });

  it('reads extended text (replies, link previews)', () => {
    const result = extractContent({ extendedTextMessage: { text: 'WTB 5711' } });
    assert.equal(result.text, 'WTB 5711');
  });

  it('reads an image caption and flags media', () => {
    const result = extractContent({ imageMessage: { caption: '126334G N2 162,000' } });
    assert.equal(result.text, '126334G N2 162,000');
    assert.equal(result.hasMedia, true);
  });

  it('returns empty text for media with no caption', () => {
    const result = extractContent({ imageMessage: {} });
    assert.equal(result.text, '');
    assert.equal(result.hasMedia, true);
  });

  it('records a document filename as an attachment', () => {
    const result = extractContent({
      documentMessage: { caption: 'stock list', fileName: 'stock.pdf' },
    });
    assert.deepEqual(result.attachments, ['stock.pdf']);
  });

  it('handles a null message', () => {
    assert.equal(extractContent(null).text, '');
  });
});

describe('unwrapMessage', () => {
  it('unwraps disappearing messages', () => {
    const unwrapped = unwrapMessage({
      ephemeralMessage: { message: { conversation: 'inside' } },
    });
    assert.equal(unwrapped?.conversation, 'inside');
  });

  it('unwraps nested wrappers', () => {
    const unwrapped = unwrapMessage({
      ephemeralMessage: { message: { viewOnceMessageV2: { message: { conversation: 'deep' } } } },
    });
    assert.equal(unwrapped?.conversation, 'deep');
  });

  it('does not spin on a self-referential payload', () => {
    const cyclic: Record<string, any> = {};
    cyclic.ephemeralMessage = { message: cyclic };
    assert.doesNotThrow(() => unwrapMessage(cyclic));
  });
});

describe('normalizeTimestamp', () => {
  it('accepts unix seconds', () => {
    assert.deepEqual(normalizeTimestamp(1772728708), new Date('2026-03-05T16:38:28.000Z'));
  });

  it('accepts a protobuf Long', () => {
    assert.deepEqual(
      normalizeTimestamp({ low: 1772728708, high: 0 }),
      new Date('2026-03-05T16:38:28.000Z')
    );
  });

  it('accepts a bigint', () => {
    assert.deepEqual(normalizeTimestamp(1772728708n), new Date('2026-03-05T16:38:28.000Z'));
  });

  it('rejects missing or nonsensical values', () => {
    assert.equal(normalizeTimestamp(null), null);
    assert.equal(normalizeTimestamp(0), null);
    assert.equal(normalizeTimestamp(-5), null);
  });
});

describe('senderIdentity', () => {
  it('turns a phone JID into a dialable number', () => {
    const identity = senderIdentity('85265472648@s.whatsapp.net', 'HK Dealer');
    assert.equal(identity.sender, '+85265472648');
    assert.equal(identity.senderPhone, '+85265472648');
  });

  it('strips the device suffix', () => {
    assert.equal(senderIdentity('85265472648:12@s.whatsapp.net', null).sender, '+85265472648');
  });

  it('never treats a @lid identity as a phone number', () => {
    // A LID is an opaque id. Reading it as a number would assign a bogus
    // country prefix and therefore the wrong default currency.
    const identity = senderIdentity('192837465@lid', 'Mei Li');
    assert.equal(identity.sender, 'Mei Li');
    assert.equal(identity.senderPhone, null);
  });

  it('falls back to the push name, then to Unknown', () => {
    assert.equal(senderIdentity(null, 'Hakimi HK').sender, 'Hakimi HK');
    assert.equal(senderIdentity(null, null).sender, 'Unknown');
  });
});

describe('isGroupJid', () => {
  it('accepts groups and rejects private chats', () => {
    assert.equal(isGroupJid(GROUP), true);
    assert.equal(isGroupJid('85265472648@s.whatsapp.net'), false);
    assert.equal(isGroupJid(null), false);
  });
});

describe('toCapturedMessage', () => {
  const options = { groupName: 'HK Dealers' };

  it('converts a group text message', () => {
    const captured = toCapturedMessage(raw(), options);

    assert.ok(captured);
    assert.equal(captured.message_id, 'MSG1');
    assert.equal(captured.group_jid, GROUP);
    assert.equal(captured.group_name, 'HK Dealers');
    assert.equal(captured.sender, '+85265472648');
    assert.equal(captured.sender_phone, '+85265472648');
    assert.equal(captured.push_name, 'HK Dealer');
    assert.equal(captured.content, 'WTS 126610LN 12,000 USD');
    assert.equal(captured.timestamp, '2026-03-05T16:38:28.000Z');
    assert.equal(captured.from_me, false);
  });

  it('preserves multi-line stock lists verbatim', () => {
    const stockList = '*Stock List*\nPatek Used\n5968A N2 1.17m hkd';
    const captured = toCapturedMessage(raw({ message: { conversation: stockList } }), options);

    assert.equal(captured?.content, stockList);
  });

  // Scope used to be enforced here, by rejecting every non-group JID. It moved
  // upstream to BRIDGE_CHAT_KINDS plus the allowlist, which default to groups
  // only — see the chat kinds tests in config.test.ts. Keeping the old rule
  // here would have made that feature dead code.
  it('converts a private chat, because scope is decided before conversion', () => {
    const message = raw({ key: { remoteJid: '85265472648@s.whatsapp.net' } });
    const captured = toCapturedMessage(message, options);

    assert.ok(captured);
    // No key.participant in a 1:1 chat — the counterparty is remoteJid, and
    // the phone must survive because country and currency are derived from it.
    assert.equal(captured?.sender_phone, '+85265472648');
  });

  it('still refuses what is never a conversation', () => {
    // The stories feed, and anything malformed.
    assert.equal(
      toCapturedMessage(raw({ key: { remoteJid: 'status@broadcast' } }), options),
      null
    );
    assert.equal(toCapturedMessage(raw({ key: { remoteJid: 'nonsense' } }), options), null);
    assert.equal(toCapturedMessage(raw({ key: { remoteJid: '' } }), options), null);
  });

  it('drops system/stub messages', () => {
    assert.equal(toCapturedMessage(raw({ messageStubType: 27 }), options), null);
  });

  it('drops messages with no text', () => {
    assert.equal(toCapturedMessage(raw({ message: { imageMessage: {} } }), options), null);
    assert.equal(toCapturedMessage(raw({ message: {} }), options), null);
    assert.equal(toCapturedMessage(raw({ message: { conversation: '   ' } }), options), null);
  });

  it('drops messages with no usable timestamp', () => {
    assert.equal(toCapturedMessage(raw({ messageTimestamp: null }), options), null);
  });

  it('ignores the bridge account by default but can include it', () => {
    const own = raw({ key: { fromMe: true } });

    assert.equal(toCapturedMessage(own, options), null);
    assert.ok(toCapturedMessage(own, { ...options, captureOwnMessages: true }));
  });

  it('captures an image caption as content', () => {
    const captured = toCapturedMessage(
      raw({ message: { imageMessage: { caption: 'RM07-01 448k usdt' } } }),
      options
    );

    assert.equal(captured?.content, 'RM07-01 448k usdt');
    assert.equal(captured?.has_media, true);
  });
});
