'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

function rendererSource() {
  return fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'electron', 'renderer', 'app.js'), 'utf8');
}

function rendererStyles() {
  return fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'electron', 'renderer', 'styles.css'), 'utf8');
}

function clientLabelIds(source) {
  const match = source.match(/const clientLabels = \{([^}]+)\};/);
  assert.ok(match, 'clientLabels declaration should exist');
  return new Set([...match[1].matchAll(/([a-z0-9_-]+)\s*:/g)].map((item) => item[1]));
}

function knownClientIds(source) {
  const match = source.match(/const KNOWN_CLIENTS = \[([\s\S]*?)\];/);
  assert.ok(match, 'KNOWN_CLIENTS declaration should exist');
  return [...match[1].matchAll(/id:\s*'([^']+)'/g)].map((item) => item[1]);
}

test('renderer client labels cover every known client', () => {
  const source = rendererSource();
  const labels = clientLabelIds(source);
  const missing = knownClientIds(source).filter((id) => !labels.has(id));

  assert.deepEqual(missing, []);
});

test('renderer known clients include current tokscale-supported tools', () => {
  const clients = knownClientIds(rendererSource());
  for (const client of ['cline', 'kimi', 'qwen', 'grok', 'copilot', 'pi', 'zed', 'kilocode', 'micode', 'zcode']) {
    assert.ok(clients.includes(client), `${client} should be a known renderer client`);
  }
});

test('renderer distinguishes Grok model and Grok Build tool icons', () => {
  const styles = rendererStyles();
  assert.match(styles, /\.row-icon-xai\s*\{[^}]*assets\/icons\/grok\.svg/s);
  assert.match(styles, /\.row-icon-grok\s*\{[^}]*assets\/icons\/xai\.svg/s);
  assert.match(styles, /\.limit-icon-grok\s*\{[^}]*assets\/icons\/grok\.svg/s);
  assert.match(styles, /\.limit-icon-copilot\s*\{[^}]*assets\/icons\/copilot\.svg/s);
});

test('renderer reuses vendor icons for MiMo Code and ZCode tool rows', () => {
  const styles = rendererStyles();
  assert.match(styles, /\.row-icon-micode\s*\{[^}]*assets\/icons\/xiaomi\.svg/s);
  assert.match(styles, /\.row-icon-zcode\s*\{[^}]*assets\/icons\/zai\.svg/s);
});
