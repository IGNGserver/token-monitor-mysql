'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rendererDir = path.join(__dirname, '..', '..', 'src', 'electron', 'renderer');

function read(name) {
  return fs.readFileSync(path.join(rendererDir, name), 'utf8');
}

test('third-party API settings use the shared section icon and structured form', () => {
  const html = read('index.html');
  const group = html.match(/<div class="settings-group settings-collapsible-group settings-thirdparty-group">[\s\S]*?<div class="settings-group settings-collapsible-group settings-sync-group">/)?.[0] || '';

  assert.match(group, /settings-section-icon-thirdparty/);
  assert.match(group, /class="thirdparty-profile-list"/);
  assert.match(group, /class="thirdparty-form-card"/);
  assert.match(group, /data-i18n="settings\.thirdparty\.endpoint"/);
  assert.match(group, /data-i18n="settings\.thirdparty\.authentication"/);
  assert.match(group, /id="thirdpartyAccessTokenField"/);
  assert.match(group, /id="thirdpartyUserIdField"/);
  assert.match(group, /id="thirdpartyApiKeyField"/);
});

test('third-party profiles expose endpoint, authentication mode, and safe state controls', () => {
  const app = read('app.js');
  const css = read('styles.css');
  const icon = fs.readFileSync(path.join(rendererDir, 'icons', 'settings', 'api.svg'), 'utf8');

  assert.match(app, /thirdPartyProfileAuthLabel/);
  assert.match(app, /thirdparty-profile-card/);
  assert.match(app, /thirdparty-profile-toggle/);
  assert.match(app, /setProfileEnabled\(name, toggle\.checked\)/);
  assert.match(app, /profile\.baseUrl/);
  assert.match(css, /\.settings-section-icon-thirdparty/);
  assert.match(css, /\.thirdparty-profile-icon/);
  assert.match(css, /assets\/icons\/newapi\.svg/);
  assert.match(icon, /<circle/);
});
