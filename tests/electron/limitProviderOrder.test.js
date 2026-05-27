'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  moveLimitProvider,
  normalizeLimitProviderOrder,
  normalizeLimitProviderSelection,
  orderedLimitProviders
} = require('../../src/electron/renderer/limitProviderOrder');

const providers = [
  { id: 'claude', label: 'Claude' },
  { id: 'codex', label: 'Codex' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'antigravity', label: 'Antigravity' }
];

test('normalizeLimitProviderOrder drops invalid entries and appends missing providers', () => {
  assert.deepEqual(
    normalizeLimitProviderOrder('codex,unknown,codex,claude', providers),
    ['codex', 'claude', 'cursor', 'antigravity']
  );
});

test('normalizeLimitProviderSelection preserves disabled providers', () => {
  assert.deepEqual(
    normalizeLimitProviderSelection('codex,unknown,codex', providers),
    ['codex']
  );
});

test('orderedLimitProviders returns provider objects in the saved order', () => {
  assert.deepEqual(
    orderedLimitProviders(providers, 'cursor,codex').map((provider) => provider.id),
    ['cursor', 'codex', 'claude', 'antigravity']
  );
});

test('moveLimitProvider swaps a provider with its neighbor only when possible', () => {
  assert.equal(
    moveLimitProvider('claude,codex,cursor,antigravity', providers, 'cursor', 'up'),
    'claude,cursor,codex,antigravity'
  );
  assert.equal(
    moveLimitProvider('claude,codex,cursor,antigravity', providers, 'claude', 'up'),
    'claude,codex,cursor,antigravity'
  );
});
