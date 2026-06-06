'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  limitProviderCapabilityTags,
  limitProviderMainDeviceLabel,
  limitProviderProvenance,
  limitProviderSettingsTags
} = require('../../src/electron/renderer/limitProviderPresentation');

const rendererDir = path.join(__dirname, '..', '..', 'src', 'electron', 'renderer');

function readRendererFile(name) {
  return fs.readFileSync(path.join(rendererDir, name), 'utf8');
}

function functionBody(source, name, nextName) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} function should exist`);
  const end = source.indexOf(`function ${nextName}(`, start);
  assert.notEqual(end, -1, `${nextName} function should follow ${name}`);
  return source.slice(start, end);
}

test('capability tags explain how each provider is collected in settings', () => {
  assert.deepEqual(limitProviderCapabilityTags('claude'), ['Auto', 'OAuth/CLI']);
  assert.deepEqual(limitProviderCapabilityTags('codex'), ['Auto', 'CLI RPC']);
  assert.deepEqual(limitProviderCapabilityTags('cursor'), ['Manual login', 'Web']);
  assert.deepEqual(limitProviderCapabilityTags('antigravity'), ['App must be open', 'RPC']);
  assert.deepEqual(limitProviderCapabilityTags('opencode'), ['Local/Zen', 'Manual login']);
  assert.deepEqual(limitProviderCapabilityTags('unknown'), []);
});

test('undetected settings tags include status and supported collection hints', () => {
  assert.deepEqual(
    limitProviderSettingsTags({ provider: 'antigravity', status: 'notConfigured', source: 'rpc' })
      .map((tag) => tag.label),
    ['Open app', 'App must be open', 'RPC']
  );
  assert.deepEqual(
    limitProviderSettingsTags({ provider: 'cursor', status: 'notConfigured', source: 'web' })
      .map((tag) => tag.label),
    ['Sign in', 'Manual login', 'Web']
  );
});

test('detected settings tags show only current source after status', () => {
  assert.deepEqual(
    limitProviderSettingsTags({ provider: 'cursor', status: 'ok', source: 'web' })
      .map((tag) => tag.label),
    ['Linked', 'Web']
  );
  assert.deepEqual(
    limitProviderSettingsTags({ provider: 'codex', status: 'ok', source: 'rpc' })
      .map((tag) => tag.label),
    ['Live', 'CLI RPC']
  );
  assert.deepEqual(
    limitProviderSettingsTags({ provider: 'opencode', status: 'ok', source: 'web' })
      .map((tag) => tag.label),
    ['Linked', 'Zen']
  );
});

test('remote synced provider tags show the selected source device and local availability', () => {
  const provider = { provider: 'codex', status: 'ok', source: 'rpc', sourceDeviceId: 'work-mac' };
  const provenance = limitProviderProvenance(provider, {
    localDeviceId: 'local-mac',
    syncActive: true,
    devices: [
      {
        deviceId: 'local-mac',
        hostname: 'local.local',
        limits: { providers: [{ provider: 'codex', status: 'ok', source: 'rpc', accountKey: 'same' }] }
      },
      {
        deviceId: 'work-mac',
        hostname: 'work.local',
        limits: { providers: [{ provider: 'codex', status: 'ok', source: 'rpc', accountKey: 'same' }] }
      }
    ]
  });

  assert.deepEqual(
    limitProviderSettingsTags(provider, provenance).map((tag) => tag.key || tag.label),
    ['Live', 'CLI RPC', 'settings.limits.device.from', 'settings.limits.device.localAlso']
  );
  assert.equal(provenance.selectedDeviceLabel, 'work-mac');
  assert.equal(limitProviderMainDeviceLabel(provenance), 'work-mac');
});

test('local provider tags show when synced devices also have provider data', () => {
  const provider = { provider: 'cursor', status: 'ok', source: 'web', sourceDeviceId: 'local-mac' };
  const provenance = limitProviderProvenance(provider, {
    localDeviceId: 'local-mac',
    syncActive: true,
    devices: [
      {
        deviceId: 'local-mac',
        limits: { providers: [{ provider: 'cursor', status: 'ok', source: 'web', accountKey: 'cursor' }] }
      },
      {
        deviceId: 'office-pc',
        limits: { providers: [{ provider: 'cursor', status: 'ok', source: 'web', accountKey: 'cursor' }] }
      }
    ]
  });

  assert.deepEqual(
    limitProviderSettingsTags(provider, provenance).map((tag) => tag.key || tag.label),
    ['Linked', 'Web', 'settings.limits.device.localAndSynced']
  );
  assert.equal(limitProviderSettingsTags(provider, provenance)[2].count, 1);
  assert.equal(limitProviderMainDeviceLabel(provenance), '');
});

test('single local synced provider tags identify local provenance without main panel noise', () => {
  const provider = { provider: 'opencode', status: 'ok', source: 'web', sourceDeviceId: 'local-mac' };
  const provenance = limitProviderProvenance(provider, {
    localDeviceId: 'local-mac',
    syncActive: true,
    devices: [
      {
        deviceId: 'local-mac',
        limits: { providers: [{ provider: 'opencode', status: 'ok', source: 'web', accountKey: 'zen' }] }
      }
    ]
  });

  assert.deepEqual(
    limitProviderSettingsTags(provider, provenance).map((tag) => tag.key || tag.label),
    ['Linked', 'Zen', 'settings.limits.device.local']
  );
  assert.equal(limitProviderMainDeviceLabel(provenance), '');
});

test('capability tags are settings-only and do not alter the main Limits panel', () => {
  const app = readRendererFile('app.js');
  const styles = readRendererFile('styles.css');
  const renderLimits = functionBody(app, 'renderLimits', 'nextBreakdown');
  const renderSettings = functionBody(app, 'renderLimitProviderCheckboxes', 'onToolTrackingToggle');

  assert.doesNotMatch(renderLimits, /limitProviderCapabilityTags|limit-status|limitProviderStatus/);
  assert.match(renderLimits, /const provenance = limitProviderProvenance\(provider\);/);
  assert.match(renderLimits, /limitProviderMeta\(provider, provenance\)/);
  assert.doesNotMatch(renderLimits, /limitProviderSettingsTags/);
  assert.match(renderLimits, /head\.append\(titleBlock, plan\);/);
  assert.match(renderSettings, /limitProviderSettingsTags\(provider, provenance/);
  assert.doesNotMatch(styles, /\.limit-status\b/);
});

test('settings provider status waits for stats and refreshes when stats arrive', () => {
  const app = readRendererFile('app.js');
  const renderSettings = functionBody(app, 'renderLimitProviderCheckboxes', 'onToolTrackingToggle');
  const refreshStats = functionBody(app, 'refreshStats', 'publishViewState');
  const statsPush = app.match(/window\.tokenMonitor\.onStatsPush\?\.\(\(payload\) => \{[\s\S]*?\n\}\);/)?.[0] || '';

  assert.doesNotMatch(renderSettings, /state\.stats \? missingLimitProviderStatus\(\) : 'unavailable'/);
  assert.match(refreshStats, /renderLimitProviderCheckboxes\(\);/);
  assert.match(statsPush, /renderLimitProviderCheckboxes\(\);/);
});
