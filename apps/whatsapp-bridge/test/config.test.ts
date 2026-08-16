import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ConfigError, isGroupAllowed, loadConfig, parseAllowlist } from '../src/config.js';

const BASE_ENV = {
  BRIDGE_API_BASE_URL: 'http://localhost:8787/api/v1',
  BRIDGE_API_TOKEN: 'secret',
} as NodeJS.ProcessEnv;

describe('loadConfig', () => {
  it('applies defaults', () => {
    const config = loadConfig({ ...BASE_ENV });

    assert.equal(config.bridgeId, 'bridge-1');
    assert.equal(config.flushIntervalMs, 10_000);
    assert.equal(config.maxBatchSize, 500);
    assert.equal(config.captureOwnMessages, false);
  });

  it('requires the API url and token', () => {
    assert.throws(() => loadConfig({ BRIDGE_API_TOKEN: 'x' }), ConfigError);
    assert.throws(() => loadConfig({ BRIDGE_API_BASE_URL: 'http://x' }), ConfigError);
  });

  it('trims a trailing slash off the API url', () => {
    const config = loadConfig({ ...BASE_ENV, BRIDGE_API_BASE_URL: 'http://x/api/v1//' });
    assert.equal(config.apiBaseUrl, 'http://x/api/v1');
  });

  it('rejects a batch size above the server limit', () => {
    assert.throws(() => loadConfig({ ...BASE_ENV, BRIDGE_MAX_BATCH_SIZE: '5000' }), ConfigError);
  });

  it('rejects a non-numeric interval', () => {
    assert.throws(() => loadConfig({ ...BASE_ENV, BRIDGE_FLUSH_INTERVAL_MS: 'soon' }), ConfigError);
  });
});

describe('parseAllowlist', () => {
  it('splits, trims and drops blanks', () => {
    assert.deepEqual(parseAllowlist(' HK Dealers , EU Trade ,, '), ['HK Dealers', 'EU Trade']);
  });

  it('treats missing config as empty', () => {
    assert.deepEqual(parseAllowlist(undefined), []);
  });
});

describe('isGroupAllowed', () => {
  const jid = '120363999@g.us';

  it('captures nothing when the allowlist is empty', () => {
    // Fail-closed: this process is paired to a real account, and a config slip
    // must not turn it into a wiretap on every chat the number can see.
    assert.equal(isGroupAllowed([], jid, 'HK Dealers'), false);
  });

  it('matches a group name case-insensitively', () => {
    assert.equal(isGroupAllowed(['hk dealers'], jid, 'HK Dealers 🇭🇰'), true);
  });

  it('matches on a substring of the subject', () => {
    assert.equal(isGroupAllowed(['Dealers'], jid, 'HK Dealers'), true);
  });

  it('matches an exact JID', () => {
    assert.equal(isGroupAllowed([jid], jid, undefined), true);
  });

  it('rejects an unlisted group', () => {
    assert.equal(isGroupAllowed(['HK Dealers'], jid, 'Family Chat'), false);
  });

  it('rejects when the subject is unknown and only names are listed', () => {
    assert.equal(isGroupAllowed(['HK Dealers'], jid, undefined), false);
  });
});
