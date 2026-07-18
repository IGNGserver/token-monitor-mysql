'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { createHub, resolveBindHost } = require('../../src/hub/server');
const { MemoryRepository } = require('./memory-repository');

function createMemoryHub(options = {}) {
  const repository = options.repository || new MemoryRepository();
  return { repository, hub: createHub({ port: 0, host: '127.0.0.1', secret: '', repository, logger: { error() {}, warn() {} }, ...options }) };
}

function payload(totalTokens, { deviceId = 'dev-a', model = 'gpt-5', inputTokens = totalTokens, updatedAt = '2026-07-18T00:00:00.000Z' } = {}) {
  return {
    deviceId,
    updatedAt,
    allTime: {
      totalTokens,
      costUsd: totalTokens / 1_000_000,
      clients: { codex: totalTokens },
      clientCosts: { codex: totalTokens / 1_000_000 },
      models: { [model]: totalTokens },
      modelCosts: { [model]: totalTokens / 1_000_000 },
      clientModels: { codex: { [model]: totalTokens } },
      clientModelCosts: { codex: { [model]: totalTokens / 1_000_000 } },
      sessions: {
        'codex:session-1': {
          client: 'codex', sessionId: 'session-1', totalTokens, inputTokens,
          models: { [model]: totalTokens }, modelCosts: { [model]: totalTokens / 1_000_000 },
          lastUsedAt: updatedAt, startedAt: updatedAt
        }
      }
    },
    today: { totalTokens },
    month: { totalTokens }
  };
}

test('resolveBindHost keeps the requested host when a secret is set', () => {
  assert.equal(resolveBindHost('0.0.0.0', 's3cret'), '0.0.0.0');
  assert.equal(resolveBindHost('192.168.1.10', 's3cret'), '192.168.1.10');
});

test('resolveBindHost forces localhost when no secret and a non-loopback host is requested', () => {
  assert.equal(resolveBindHost('0.0.0.0', ''), '127.0.0.1');
  assert.equal(resolveBindHost('192.168.1.10', ''), '127.0.0.1');
  assert.equal(resolveBindHost('', ''), '127.0.0.1');
});

test('a hub without a secret binds to localhost only even when asked to bind every interface', async () => {
  const { hub } = createMemoryHub({ host: '0.0.0.0' });
  await hub.start();
  try {
    assert.equal(hub.bindHost, '127.0.0.1');
    assert.equal(hub.server.address().address, '127.0.0.1');
  } finally {
    await hub.stop();
  }
});

test('ingest records initial, incremental, and reset deltas without negative events', async () => {
  const { hub, repository } = createMemoryHub();
  await hub.ingest(payload(100, { updatedAt: '2026-07-18T00:00:00.000Z' }));
  await hub.ingest(payload(160, { updatedAt: '2026-07-18T00:01:00.000Z' }));
  await hub.ingest(payload(20, { updatedAt: '2026-07-18T00:02:00.000Z' }));

  assert.deepEqual(repository.events.map((event) => event.totalTokens), [100, 60, 20]);
  assert.ok(repository.events.every((event) => event.inputTokens >= 0 && event.costUsd >= 0));
  assert.equal((await hub.getStats()).periods.allTime.totalTokens, 20);
});

test('pricing changes do not mutate existing event snapshots or costs', async () => {
  const { hub, repository } = createMemoryHub();
  await hub.setPricing('gpt-5', {
    inputPricePerMillion: 1,
    outputPricePerMillion: 0,
    cacheReadPricePerMillion: 0,
    cacheWritePricePerMillion: 0
  });
  await hub.ingest(payload(1_000_000));
  const first = { ...repository.events[0] };
  await hub.setPricing('gpt-5', {
    inputPricePerMillion: 3,
    outputPricePerMillion: 0,
    cacheReadPricePerMillion: 0,
    cacheWritePricePerMillion: 0
  });
  await hub.ingest(payload(2_000_000, { updatedAt: '2026-07-18T00:01:00.000Z' }));

  assert.equal(first.priceInputPerMillion, 1);
  assert.equal(first.costUsd, 1);
  assert.equal(repository.events[0].priceInputPerMillion, 1);
  assert.equal(repository.events[0].costUsd, 1);
  assert.equal(repository.events[1].priceInputPerMillion, 3);
  assert.equal(repository.events[1].costUsd, 3);
});

test('HTTP ingest round-trips the existing stats shape and device deletion keeps events', async () => {
  const { hub, repository } = createMemoryHub();
  await hub.start();
  try {
    const { port } = hub.server.address();
    const ingest = await fetch(`http://127.0.0.1:${port}/api/ingest`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload(5))
    });
    assert.equal(ingest.status, 200);
    const stats = await (await fetch(`http://127.0.0.1:${port}/api/stats`)).json();
    assert.equal(stats.periods.allTime.totalTokens, 5);
    assert.equal(stats.devices[0].deviceId, 'dev-a');

    const deleted = await fetch(`http://127.0.0.1:${port}/api/devices/dev-a`, { method: 'DELETE' });
    assert.equal(deleted.status, 200);
    assert.equal((await hub.getStats()).devices.length, 0);
    assert.equal(repository.events.length, 1);
    assert.equal(repository.events[0].deviceId, null);
  } finally {
    await hub.stop();
  }
});

test('pricing endpoints accept manual and tokscale-upstream data', async () => {
  const { repository, hub } = createMemoryHub({
    lookupPricing: async () => ({ pricing: {
      inputCostPerToken: 0.000002, outputCostPerToken: 0.000004,
      cacheReadInputTokenCost: 0.0000002, cacheCreationInputTokenCost: 0.0000004
    } })
  });
  await hub.start();
  try {
    const { port } = hub.server.address();
    const manual = await fetch(`http://127.0.0.1:${port}/api/pricing/gpt-5`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ inputPricePerMillion: 1, outputPricePerMillion: 2, cacheReadPricePerMillion: 0.1, cacheWritePricePerMillion: 0.2 })
    });
    assert.equal(manual.status, 200);
    const upstream = await fetch(`http://127.0.0.1:${port}/api/pricing/gpt-5/fetch-upstream`, { method: 'POST' });
    assert.equal(upstream.status, 200);
    assert.equal(repository.pricing.get('gpt-5').source, 'tokscale_upstream');
    assert.equal(repository.pricing.get('gpt-5').inputPricePerMillion, 2);
  } finally {
    await hub.stop();
  }
});

test('oversized ingest returns 413 without storing the device', async () => {
  const { hub } = createMemoryHub();
  await hub.start();
  try {
    const { port } = hub.server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/ingest`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ deviceId: 'oversized', padding: 'x'.repeat(1024 * 1024) })
    });
    assert.equal(response.status, 413);
    assert.equal((await hub.getStats()).devices.length, 0);
  } finally {
    await hub.stop();
  }
});
