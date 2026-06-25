'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

let trackingApi = {};
try {
  trackingApi = require('../../src/shared/clientTracking');
} catch (_) {}

const { DEFAULT_CLIENTS, clientsCsvForSetting } = trackingApi;

test('clientsCsvForSetting uses defaults only for missing settings', () => {
  assert.equal(typeof DEFAULT_CLIENTS, 'string');
  assert.equal(typeof clientsCsvForSetting, 'function');
  assert.equal(clientsCsvForSetting(undefined), DEFAULT_CLIENTS);
  assert.equal(clientsCsvForSetting(null), DEFAULT_CLIENTS);
});

test('default tracked clients include current tokscale-supported tools', () => {
  const clients = DEFAULT_CLIENTS.split(',');
  for (const client of ['cline', 'kimi', 'qwen', 'grok', 'copilot', 'pi', 'zed', 'kilocode', 'micode', 'zcode']) {
    assert.ok(clients.includes(client), `${client} should be tracked by default`);
  }
});

test('default tracked clients are accepted by bundled tokscale', () => {
  const result = spawnSync(process.execPath, [require.resolve('tokscale/bin.js'), '--help'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const help = `${result.stdout || ''}\n${result.stderr || ''}`;
  const possibleValues = help.match(/\[possible values: ([^\]]+)\]/);
  assert.ok(possibleValues, 'tokscale --help should list --client possible values');
  const supported = new Set(possibleValues[1].split(',').map((client) => client.trim()).filter(Boolean));
  const unsupported = DEFAULT_CLIENTS.split(',').filter((client) => !supported.has(client));
  assert.deepEqual(unsupported, []);
});

test('clientsCsvForSetting preserves explicit empty tracked-tool selection', () => {
  assert.equal(clientsCsvForSetting(''), '');
  assert.equal(clientsCsvForSetting('  '), '');
});

test('clientsCsvForSetting normalizes saved client csv values', () => {
  assert.equal(clientsCsvForSetting(' Claude , Codex,,hermes '), 'claude,codex,hermes');
});
