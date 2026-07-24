'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { aggregateHistoryRange, createHub } = require('../../src/hub/server');
const { MemoryRepository } = require('./memory-repository');

test('aggregateHistoryRange sums overlapping daily history', () => {
  const history = {
    daily: [
      {
        date: '2026-07-20',
        tokens: 100,
        cost: 1,
        perClient: { codex: { tokens: 60, cost: 0.6 }, claude: { tokens: 40, cost: 0.4 } },
        perModel: { 'gpt-5': { tokens: 100, cost: 1 } }
      },
      {
        date: '2026-07-21',
        tokens: 50,
        cost: 0.5,
        perClient: { codex: { tokens: 50, cost: 0.5 } },
        perModel: { 'gpt-5': { tokens: 50, cost: 0.5 } }
      },
      {
        date: '2026-07-22',
        tokens: 999,
        cost: 9,
        perClient: { codex: { tokens: 999, cost: 9 } },
        perModel: { 'gpt-5': { tokens: 999, cost: 9 } }
      }
    ]
  };
  const result = aggregateHistoryRange(
    history,
    new Date('2026-07-20T10:00:00.000Z'),
    new Date('2026-07-22T00:00:00.000Z')
  );
  assert.equal(result.totalTokens, 150);
  assert.equal(result.costUsd, 1.5);
  assert.equal(result.clients.codex, 110);
  assert.equal(result.clients.claude, 40);
  assert.equal(result.models['gpt-5'], 150);
});

test('GET /api/usage/range aggregates usage_events then falls back to history', async () => {
  const repository = new MemoryRepository();
  await repository.insertUsageEvents('dev-a', [{
    client: 'codex',
    sessionId: 's1',
    model: 'gpt-5',
    recordedAt: '2026-07-20T12:30:00.000Z',
    inputTokens: 40,
    outputTokens: 10,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costUsd: 0.2
  }]);
  await repository.saveDevice({
    deviceId: 'dev-a',
    history: {
      daily: [{
        date: '2026-07-20',
        tokens: 999,
        cost: 9,
        perClient: { codex: { tokens: 999, cost: 9 } },
        perModel: { 'gpt-5': { tokens: 999, cost: 9 } }
      }],
      monthly: [],
      summary: {}
    }
  });

  const hub = createHub({
    port: 0,
    host: '127.0.0.1',
    secret: 'range-secret',
    repository,
    logger: { error() {}, warn() {} }
  });
  await hub.start();
  try {
    const { port } = hub.server.address();
    const base = `http://127.0.0.1:${port}`;
    const headers = { authorization: 'Bearer range-secret' };

    const withEvents = await fetch(
      `${base}/api/usage/range?from=${encodeURIComponent('2026-07-20T12:00:00.000Z')}&to=${encodeURIComponent('2026-07-20T13:00:00.000Z')}`,
      { headers }
    );
    assert.equal(withEvents.status, 200);
    const eventBody = await withEvents.json();
    assert.equal(eventBody.source, 'usage_events');
    assert.equal(eventBody.totalTokens, 50);
    assert.equal(eventBody.clients.codex, 50);
    assert.equal(eventBody.models['gpt-5'], 50);
    assert.equal(eventBody.clientModels.codex['gpt-5'], 50);

    const emptyWindow = await fetch(
      `${base}/api/usage/range?from=${encodeURIComponent('2026-07-21T00:00:00.000Z')}&to=${encodeURIComponent('2026-07-22T00:00:00.000Z')}`,
      { headers }
    );
    assert.equal(emptyWindow.status, 200);
    const fallback = await emptyWindow.json();
    // No events and no overlapping history day → empty history_daily
    assert.equal(fallback.source, 'history_daily');
    assert.equal(fallback.totalTokens, 0);

    const bad = await fetch(`${base}/api/usage/range?from=nope&to=2026-07-21T00:00:00.000Z`, { headers });
    assert.equal(bad.status, 400);
  } finally {
    await hub.stop();
  }
});
