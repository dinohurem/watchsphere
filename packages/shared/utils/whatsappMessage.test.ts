// Run: npm test (node:test with native TypeScript stripping, Node >= 22.6)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWhatsAppOrderMessage as build,
  buildWhatsAppUrl,
  extractYear,
} from './whatsappMessage.ts';

test('WTS with year and price', () => {
  assert.equal(
    build({ orderType: 'sell', wsCode: '126500LN White', year: 2026, price: 276000, currency: 'HKD' }),
    'Hi, is the 126500LN White 2026 276,000 HKD still available?'
  );
});

test('WTS without year', () => {
  assert.equal(
    build({ orderType: 'sell', wsCode: '126500LN White', price: 276000, currency: 'HKD' }),
    'Hi, is the 126500LN White 276,000 HKD still available?'
  );
});

test('WTS without price', () => {
  assert.equal(
    build({ orderType: 'sell', wsCode: '126500LN White', year: '2026', price: null }),
    'Hi, is the 126500LN White 2026 still available?'
  );
});

test('WTS without year and price', () => {
  assert.equal(build({ orderType: 'sell', wsCode: 'X1' }), 'Hi, is the X1 still available?');
});

test('falls back to reference when there is no ws_code', () => {
  assert.equal(
    build({ orderType: 'sell', wsCode: '', reference: '126500LN', price: 1500, currency: 'EUR' }),
    'Hi, is the 126500LN 1,500 EUR still available?'
  );
});

test('WTB', () => {
  assert.equal(
    build({ orderType: 'buy', wsCode: '126500LN White', year: 2026, price: 1 }),
    'Hi, I have a 126500LN White available. Are you still looking?'
  );
  assert.equal(
    build({ orderType: 'buy', reference: '126500LN' }),
    'Hi, I have a 126500LN available. Are you still looking?'
  );
});

test('extractYear', () => {
  assert.equal(extractYear(2026), '2026');
  assert.equal(extractYear('2026'), '2026');
  assert.equal(extractYear('11/2026'), '2026');
  assert.equal(extractYear('2022+'), '2022');
  assert.equal(extractYear('2020-2022'), undefined);
  assert.equal(extractYear('2020-22'), undefined);
  assert.equal(extractYear('03/26'), undefined);
  assert.equal(extractYear(''), undefined);
  assert.equal(extractYear(null), undefined);
});

test('price formatting keeps the order currency and decimals', () => {
  assert.equal(
    build({ wsCode: 'A', price: 1234567.5, currency: 'USD' }),
    'Hi, is the A 1,234,567.50 USD still available?'
  );
  assert.equal(
    build({ wsCode: 'A', price: 950, currency: 'CHF' }),
    'Hi, is the A 950 CHF still available?'
  );
});

test('url', () => {
  assert.equal(
    buildWhatsAppUrl('+1 (234) 567', 'Hi, a b'),
    'https://wa.me/1234567?text=Hi%2C%20a%20b'
  );
});
