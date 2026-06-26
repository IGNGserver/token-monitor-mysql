'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { aggregateLimits, publicLimits, syncLimits } = require('../../src/shared/limits');
const { collectLimitsOnce } = require('../../src/shared/limitCollector');

function codexProvider(accountKey, accountEmail, remainingPercent, updatedAt) {
  return {
    provider: 'codex',
    accountKey,
    accountName: accountEmail.split('@')[0],
    accountEmail,
    accountLabel: 'Plus',
    status: 'ok',
    source: 'rpc',
    sourceDetail: 'managed',
    updatedAt,
    windows: [
      {
        kind: 'session',
        usedPercent: 100 - remainingPercent,
        remainingPercent,
        resetsAt: '2026-06-14T18:00:00.000Z',
        windowMinutes: 300
      }
    ]
  };
}

test('aggregateLimits preserves distinct Codex accounts by hashed account key', () => {
  const aggregate = aggregateLimits([
    {
      deviceId: 'macbook',
      limits: {
        updatedAt: '2026-06-14T10:00:00.000Z',
        providers: [
          codexProvider('sha256:codex-a', 'a@example.com', 18, '2026-06-14T10:00:00.000Z'),
          codexProvider('sha256:codex-b', 'b@example.com', 72, '2026-06-14T10:01:00.000Z')
        ]
      }
    }
  ], 0, Date.parse('2026-06-14T10:02:00.000Z'));

  const codexProviders = aggregate.providers.filter((provider) => provider.provider === 'codex');
  assert.equal(codexProviders.length, 2);
  assert.deepEqual(
    new Set(codexProviders.map((provider) => provider.accountKey)),
    new Set(['sha256:codex-a', 'sha256:codex-b'])
  );
  assert.deepEqual(
    new Set(codexProviders.map((provider) => provider.accountEmail)),
    new Set(['a@example.com', 'b@example.com'])
  );
});

test('aggregateLimits merges the same Codex account across devices and keeps distinct ones', () => {
  const aggregate = aggregateLimits([
    {
      deviceId: 'macbook',
      limits: {
        updatedAt: '2026-06-14T10:01:00.000Z',
        providers: [
          codexProvider('sha256:codex-a', 'a@example.com', 18, '2026-06-14T10:00:00.000Z'),
          codexProvider('sha256:codex-b', 'b@example.com', 72, '2026-06-14T10:01:00.000Z')
        ]
      }
    },
    {
      deviceId: 'desktop',
      limits: {
        updatedAt: '2026-06-14T10:05:00.000Z',
        providers: [
          codexProvider('sha256:codex-a', 'a@example.com', 50, '2026-06-14T10:05:00.000Z'),
          codexProvider('sha256:codex-c', 'c@example.com', 30, '2026-06-14T10:03:00.000Z')
        ]
      }
    }
  ], 0, Date.parse('2026-06-14T10:06:00.000Z'));

  const codexProviders = aggregate.providers.filter((provider) => provider.provider === 'codex');
  assert.deepEqual(
    new Set(codexProviders.map((provider) => provider.accountKey)),
    new Set(['sha256:codex-a', 'sha256:codex-b', 'sha256:codex-c'])
  );
  // The account both devices report merges into one, keeping the freshest snapshot.
  const accountA = codexProviders.find((provider) => provider.accountKey === 'sha256:codex-a');
  assert.equal(accountA.windows[0].remainingPercent, 50);
  assert.equal(accountA.sourceDeviceId, 'desktop');
});

test('syncLimits carries Codex account key, email and plan label to the authenticated hub', () => {
  const payload = syncLimits({
    updatedAt: '2026-06-14T10:00:00.000Z',
    providers: [
      codexProvider('sha256:codex-a', 'a@example.com', 18, '2026-06-14T10:00:00.000Z')
    ]
  });

  assert.equal(payload.providers.length, 1);
  assert.equal(payload.providers[0].provider, 'codex');
  assert.equal(payload.providers[0].accountKey, 'sha256:codex-a');
  assert.equal(payload.providers[0].accountName, 'a');
  assert.equal(payload.providers[0].accountEmail, 'a@example.com');
  assert.equal(payload.providers[0].accountLabel, 'Plus');
});

test('publicLimits strips Codex account identity fields', () => {
  const payload = publicLimits({
    updatedAt: '2026-06-14T10:00:00.000Z',
    providers: [
      codexProvider('sha256:codex-a', 'a@example.com', 18, '2026-06-14T10:00:00.000Z')
    ]
  });

  assert.equal(payload.providers.length, 1);
  assert.equal(payload.providers[0].provider, 'codex');
  assert.equal(Object.hasOwn(payload.providers[0], 'accountKey'), false);
  assert.equal(Object.hasOwn(payload.providers[0], 'accountName'), false);
  assert.equal(Object.hasOwn(payload.providers[0], 'accountEmail'), false);
  assert.equal(Object.hasOwn(payload.providers[0], 'accountLabel'), false);
});

test('collectLimitsOnce flattens multiple providers returned by a provider fetcher', async () => {
  const summary = await collectLimitsOnce({ limitProviders: 'codex' }, {
    now: () => Date.parse('2026-06-14T10:02:00.000Z'),
    providerFetchers: {
      codex: async () => [
        codexProvider('sha256:codex-a', 'a@example.com', 18, '2026-06-14T10:00:00.000Z'),
        codexProvider('sha256:codex-b', 'b@example.com', 72, '2026-06-14T10:01:00.000Z')
      ]
    }
  });

  assert.equal(summary.providers.length, 2);
  assert.deepEqual(
    new Set(summary.providers.map((provider) => provider.accountKey)),
    new Set(['sha256:codex-a', 'sha256:codex-b'])
  );
});

// Regression guard for the renderer's localProviderStatus(): a sync-mode account
// card (DeepSeek/Minimax/Grok) must read the local device's RAW limits from
// stats.devices, not stats.limits.providers. This test pins the root cause:
// aggregateLimits collapses a local `unauthorized` row out in favor of a remote
// `ok`, so the local row is GONE from the aggregate. If the card read the
// aggregate, an invalid local key would be validated by the remote ok and the
// UI would falsely report "Linked".
function apikeyProvider(name, accountKey, status, updatedAt) {
  return {
    provider: name,
    accountKey,
    accountLabel: 'Plan',
    status,
    source: 'api',
    updatedAt,
    windows: []
  };
}

test('aggregateLimits drops a local unauthorized row when a remote device has ok (deepseek/minimax/grok collapse by name)', () => {
  const aggregate = aggregateLimits([
    {
      deviceId: 'this-mac',
      limits: {
        updatedAt: '2026-06-24T10:00:00.000Z',
        providers: [apikeyProvider('minimax', 'sha256:local-bad-key', 'unauthorized', '2026-06-24T10:00:00.000Z')]
      }
    },
    {
      deviceId: 'office-pc',
      limits: {
        updatedAt: '2026-06-24T10:01:00.000Z',
        providers: [apikeyProvider('minimax', 'sha256:remote-good-key', 'ok', '2026-06-24T10:01:00.000Z')]
      }
    }
  ], 0, Date.parse('2026-06-24T10:02:00.000Z'));

  const minimaxRows = aggregate.providers.filter((provider) => provider.provider === 'minimax');
  assert.equal(minimaxRows.length, 1);
  // The local unauthorized row is gone; only the remote ok survives.
  assert.equal(minimaxRows[0].status, 'ok');
  assert.equal(minimaxRows[0].sourceDeviceId, 'office-pc');
  assert.equal(minimaxRows[0].accountKey, 'sha256:remote-good-key');
});

test('the local device raw limits still carry the unauthorized row the aggregate dropped', () => {
  // This is the data the renderer's localDeviceLimitsProviders() reads. It proves
  // the local unauthorized survives in stats.devices[..].limits.providers even
  // though aggregateLimits removed it from stats.limits.providers.
  const thisMac = {
    deviceId: 'this-mac',
    limits: {
      updatedAt: '2026-06-24T10:00:00.000Z',
      providers: [apikeyProvider('grok', 'sha256:local-bad-key', 'unauthorized', '2026-06-24T10:00:00.000Z')]
    }
  };
  const officePc = {
    deviceId: 'office-pc',
    limits: {
      updatedAt: '2026-06-24T10:01:00.000Z',
      providers: [apikeyProvider('grok', 'sha256:remote-good-key', 'ok', '2026-06-24T10:01:00.000Z')]
    }
  };

  // Aggregate: only remote ok.
  const aggregate = aggregateLimits([thisMac, officePc], 0, Date.parse('2026-06-24T10:02:00.000Z'));
  assert.equal(aggregate.providers.filter((provider) => provider.provider === 'grok').length, 1);

  // Raw local device limits: the unauthorized row is still here, so a card that
  // reads stats.devices (not stats.limits.providers) will correctly surface
  // 'unauthorized' for the local credential.
  const localGrok = thisMac.limits.providers.find((provider) => provider.provider === 'grok');
  assert.equal(localGrok.status, 'unauthorized');
  assert.equal(localGrok.accountKey, 'sha256:local-bad-key');
});
