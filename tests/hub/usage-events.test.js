'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { calculateUsageEventDeltas } = require('../../src/hub/usage-events');

function snapshot(totalTokens) {
  return {
    deviceId: 'sync-device',
    updatedAt: '2026-07-18T00:00:00.000Z',
    allTime: {
      totalTokens,
      clients: { codex: totalTokens },
      models: { 'gpt-5': totalTokens },
      clientModels: { codex: { 'gpt-5': totalTokens } }
    }
  };
}

test('sync payloads without all-time sessions use explicit snapshot aggregate ids', () => {
  const { candidates, events } = calculateUsageEventDeltas(null, snapshot(42));
  assert.equal(candidates[0].sessionId, 'snapshot:codex:gpt-5');
  assert.equal(events[0].totalTokens, 42);
});

test('client-model aggregate cost is allocated once rather than twice', () => {
  const record = {
    deviceId: 'cost-device',
    allTime: {
      totalTokens: 100,
      models: { 'gpt-5': 100 },
      modelCosts: { 'gpt-5': 10 },
      clientModels: { codex: { 'gpt-5': 40 }, claude: { 'gpt-5': 60 } },
      clientModelCosts: { codex: { 'gpt-5': 4 }, claude: { 'gpt-5': 6 } }
    }
  };
  const { candidates } = calculateUsageEventDeltas(null, record);
  assert.deepEqual(candidates.map((candidate) => candidate.payloadCostUsd).sort((a, b) => a - b), [4, 6]);
});
