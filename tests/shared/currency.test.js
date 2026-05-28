'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  CURRENCY_CODES,
  convertUsd,
  formatCurrencyFromUsd,
  normalizeCurrency
} = require('../../src/shared/currency');

test('currency options keep USD as the default first option', () => {
  assert.deepEqual(CURRENCY_CODES, ['USD', 'TWD', 'HKD', 'CNY']);
  assert.equal(normalizeCurrency(), 'USD');
  assert.equal(normalizeCurrency(''), 'USD');
  assert.equal(normalizeCurrency('twd'), 'TWD');
  assert.equal(normalizeCurrency('jpy'), 'USD');
});

test('converts USD costs into supported display currencies', () => {
  assert.equal(convertUsd(1, 'USD'), 1);
  assert.equal(convertUsd(1, 'TWD'), 31.5);
  assert.equal(convertUsd(1, 'HKD'), 7.8);
  assert.equal(convertUsd(1, 'CNY'), 6.8);
});

test('formats converted costs with unambiguous symbols', () => {
  assert.equal(formatCurrencyFromUsd(1, 'USD'), '$1.0000');
  assert.equal(formatCurrencyFromUsd(1, 'TWD'), 'NT$31.50');
  assert.equal(formatCurrencyFromUsd(1, 'HKD'), 'HK$7.80');
  assert.equal(formatCurrencyFromUsd(1, 'CNY'), '¥6.80');
});
