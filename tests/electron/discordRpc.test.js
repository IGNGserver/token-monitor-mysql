'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadBuildPayload() {
  const filePath = path.join(__dirname, '..', '..', 'src', 'electron', 'discordRpc.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const sandbox = {
    console,
    module: { exports: {} },
    require(name) {
      if (name === '@xhayper/discord-rpc') return { Client: class {} };
      if (name === '../shared/currency') return require('../../src/shared/currency');
      return require(name);
    },
    setTimeout,
    clearTimeout,
    Date
  };

  vm.runInNewContext(`${source}\nmodule.exports.__buildPayload = buildPayload;`, sandbox, { filename: filePath });
  return sandbox.module.exports.__buildPayload;
}

test('Discord Rich Presence uses Antigravity label and uploaded asset key', () => {
  const buildPayload = loadBuildPayload();
  const payload = buildPayload({
    periods: {
      today: {
        totalTokens: 12_345,
        costUsd: 0.125,
        clients: { antigravity: 12_345 }
      }
    }
  });

  assert.equal(payload.details, 'Antigravity · 12.3K tokens');
  assert.equal(payload.smallImageKey, 'antigravity');
  assert.equal(payload.smallImageText, 'Antigravity');
});

test('Discord Rich Presence formats today cost with selected currency', () => {
  const buildPayload = loadBuildPayload();
  const payload = buildPayload({
    periods: {
      today: {
        totalTokens: 12_345,
        costUsd: 1,
        clients: { codex: 12_345 }
      }
    }
  }, 'CNY');

  assert.equal(payload.state, '¥6.80 today');
});
