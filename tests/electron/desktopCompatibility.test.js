'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..', '..');
const rendererRoot = path.join(root, 'src', 'electron', 'renderer');
const read = (name) => fs.readFileSync(path.join(rendererRoot, name), 'utf8');
const app = read('app.js');
const html = read('index.html');
const css = read('styles.css');
const { normalizeInitialRendererViewState } = require('../../src/electron/floatingBubble');

function providerIds() {
  const start = app.indexOf('const LIMIT_PROVIDERS = [');
  const end = app.indexOf('];', start);
  return [...app.slice(start, end).matchAll(/id: '([^']+)'/g)].map((match) => match[1]);
}

test('legacy settings entry points remain available after the upstream port', () => {
  for (const id of ['startInTrayInput', 'closeToTrayInput', 'floatingBubbleTriggerInput', 'showLimitUsedInput']) {
    assert.match(html, new RegExp(`id="${id}"`), `${id} should remain in the desktop settings DOM`);
  }
  assert.match(html, /data-settings-section="accounts"/);
  assert.match(html, /id="accountsSettingsDetails" class="settings-section-details hidden"/);
  assert.match(app, /SETTINGS_SECTION_IDS = \['general', 'main', 'window', 'appearance', 'tools', 'limits', 'accounts', 'subscriptions', 'sync'\]/);
  assert.match(app, /startInTrayInput\?\.addEventListener\('change'/);
  assert.match(app, /closeToTrayInput\?\.addEventListener\('change'/);
});

test('renderer limit provider order is unique and matches the shared provider contract', () => {
  const { LIMIT_PROVIDER_IDS } = require('../../src/shared/limitProviders');
  const ids = providerIds();
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...ids].sort(), [...LIMIT_PROVIDER_IDS].sort());
  assert.deepEqual(ids.slice(0, 18), [
    'claude', 'codex', 'cursor', 'antigravity', 'opencode', 'openrouter',
    'deepseek', 'minimax', 'mimo', 'grok', 'copilot', 'kiro', 'zai',
    'zaiteam', 'volcengine', 'qoder', 'kimi', 'ollama'
  ]);
});

test('account panels stay in Accounts unless an embedded limits row owns them', () => {
  const start = app.indexOf('function limitProviderAccountGroup(');
  const end = app.indexOf('\n}', start) + 2;
  const body = app.slice(start, end);
  assert.match(body, /closest\(`#limitProviderOptions-\$\{providerId\}`\)/);
  assert.match(app, /if \(accountGroup\) \{\s*moveLimitProviderLiveNode\(actions, accountStatus, disclosureIcon\);/);
});

test('platform surface handling is wired in both widget and Dashboard renderers', () => {
  const dashboard = read('dashboard.js');
  assert.match(app, /dataset\.windowsBackdrop = windowsGlass\.backdropMode/);
  assert.match(app, /dataset\.macosGlass = macosGlass\.effectiveStyle/);
  assert.match(dashboard, /function applyWindowsBackdrop\(settings\)/);
  assert.match(dashboard, /function applyMacosGlass\(settings\)/);
  assert.match(dashboard, /state\.settings = \{ \.\.\.state\.settings, \.\.\.next \}/);
  assert.match(dashboard, /next\.themeColors[\s\S]*?applyAppearance\(state\.settings\)/);
  assert.match(css, /html\.is-windows\[data-windows-backdrop\] \.shell/);
});

test('fixed period selections survive a window rebuild', () => {
  for (const period of ['week', 'last7', 'last30']) {
    assert.deepEqual(
      normalizeInitialRendererViewState({ period, breakdown: 'home' }),
      { period, breakdown: 'home' }
    );
  }
});

test('legacy and new provider artwork stay mapped', () => {
  assert.match(css, /\.row-icon-claude-desktop\s*\{[^}]*assets\/icons\/claude-desktop\.svg/);
  assert.match(read('trayProviderIcons.js'), /kimi: '\.\.\/\.\.\/\.\.\/assets\/icons\/moonshot\.svg'/);
  assert.ok(fs.existsSync(path.join(root, 'assets', 'icons', 'claude-desktop.svg')));
});
