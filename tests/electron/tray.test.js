'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { formatTrayText, pickUsageTrayIconId } = require('../../src/electron/tray');

const stats = {
  periods: {
    today: {
      clients: { claude: 10, codex: 25 },
      clientCosts: { claude: 0.5, codex: 0.2 }
    },
    allTime: {
      clients: { claude: 100, codex: 40 },
      clientCosts: { claude: 1, codex: 2 }
    }
  }
};

test('usage tray icon picks the top token client for day and total token modes', () => {
  assert.equal(pickUsageTrayIconId(stats, 'tokens', ['claude', 'codex']), 'codex');
  assert.equal(pickUsageTrayIconId(stats, 'both', ['claude', 'codex']), 'codex');
  assert.equal(pickUsageTrayIconId(stats, 'tokensAll', ['claude', 'codex']), 'claude');
  assert.equal(pickUsageTrayIconId(stats, 'bothAll', ['claude', 'codex']), 'claude');
});

test('usage tray icon picks the top cost client for day and total cost modes', () => {
  assert.equal(pickUsageTrayIconId(stats, 'cost', ['claude', 'codex']), 'claude');
  assert.equal(pickUsageTrayIconId(stats, 'costAll', ['claude', 'codex']), 'codex');
});

test('usage tray icon falls back to token usage when cost breakdown is unavailable', () => {
  assert.equal(
    pickUsageTrayIconId({ periods: { today: { clients: { claude: 3, codex: 9 } } } }, 'cost', ['claude', 'codex']),
    'codex'
  );
});

test('usage tray icon leaves pure icon and bar modes to their existing icon paths', () => {
  assert.equal(pickUsageTrayIconId(stats, 'icon', ['claude', 'codex']), null);
  assert.equal(pickUsageTrayIconId(stats, 'bars', ['claude', 'codex']), null);
  assert.equal(pickUsageTrayIconId(stats, 'barsSession', ['claude', 'codex']), null);
});

test('usage tray icon returns null when the top client has no available icon', () => {
  assert.equal(
    pickUsageTrayIconId({ periods: { today: { clients: { unknown: 20, codex: 10 } } } }, 'tokens', ['codex']),
    null
  );
});

test('tray cost text uses the selected display currency', () => {
  assert.equal(formatTrayText({ periods: { today: { costUsd: 1, totalTokens: 12_000 } } }, 'cost'), '$1.0000');
  assert.equal(formatTrayText({ periods: { today: { costUsd: 1, totalTokens: 12_000 } } }, 'cost', 'TWD'), 'NT$31.50');
  assert.equal(formatTrayText({ periods: { today: { costUsd: 1, totalTokens: 12_000 } } }, 'both', 'HKD'), '12.0K · HK$7.80');
});
