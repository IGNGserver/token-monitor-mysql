'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

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

function cssRule(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `${selector} rule should exist`);
  return match[1];
}

test('preference drag only selects sortable rows, not nested controls', () => {
  const body = functionBody(readRendererFile('app.js'), 'preferenceRows', 'preferenceOrder');
  assert.match(body, /\.tool-preference-row\[data-client\]/);
  assert.match(body, /\.limit-provider-row\[data-provider\]/);
  assert.match(body, /\.view-preference-row\[data-view\]/);
  assert.doesNotMatch(body, /querySelectorAll\(`\\\[data-\$\{attr\}\\\]`\)/);
});

test('preference drag does not animate row transforms during pointer movement', () => {
  const app = readRendererFile('app.js');
  const css = readRendererFile('styles.css');
  assert.doesNotMatch(app, /animatePreferenceOrderChange/);
  assert.doesNotMatch(app, /translateY\(/);
  assert.doesNotMatch(cssRule(css, '.tool-preference-row'), /transform/);
  assert.doesNotMatch(cssRule(css, '.view-preference-row'), /transform/);
  assert.doesNotMatch(cssRule(css, '.settings-panel .limit-provider-row'), /transform/);
  assert.doesNotMatch(cssRule(css, '.preference-order-handle'), /transition:\s*transform/);
});

test('tool preference controls use compact header actions without icon-only legends', () => {
  const html = readRendererFile('index.html');
  const group = html.match(/<div class="settings-subgroup settings-tools-subgroup">[\s\S]*?<div id="clientDisplayList"/)?.[0] || '';
  assert.match(html, /<div class="settings-group settings-collapsible-group settings-tools-group"/);
  assert.match(group, /<div class="settings-group-header settings-tools-header">/);
  assert.match(group, /<div class="tool-header-actions">/);
  assert.match(group, /class="tool-header-action"/);
  assert.doesNotMatch(group, /<div class="settings-actions tool-settings-actions">/);
  assert.doesNotMatch(group, /class="tool-preference-head"/);
  assert.doesNotMatch(group, /tool-preference-legend-/);

  const css = readRendererFile('styles.css');
  assert.match(cssRule(css, '.tool-preference-row'), /grid-template-columns:\s*minmax\(0,\s*1fr\) repeat\(4,\s*22px\)/);
  assert.match(cssRule(css, '.tool-preference-actions'), /display:\s*contents/);
  assert.doesNotMatch(css, /\.tool-preference-head/);
  assert.doesNotMatch(css, /\.tool-preference-legend-/);
});

test('tool preference rows include compact per-tool pin controls', () => {
  const body = functionBody(readRendererFile('app.js'), 'renderToolPreferences', 'renderLimitProviderCheckboxes');
  assert.match(body, /tool-pin-button/);
  assert.match(body, /settings\.tools\.pinClient/);
  assert.match(body, /settings\.tools\.unpinClient/);
  assert.match(body, /onClientPinnedToggle/);
});

test('view preferences use compact visibility and order controls', () => {
  const html = readRendererFile('index.html');
  const group = html.match(/<div class="settings-subgroup settings-main-screen-group">[\s\S]*?<div id="viewDisplayList"/)?.[0] || '';
  assert.match(html, /<div class="settings-group settings-collapsible-group settings-main-group"/);
  assert.match(group, /<div class="settings-group-header settings-views-header">/);
  assert.match(group, /<div class="tool-header-actions">/);
  assert.match(group, /id="resetViewDisplayOrderButton"/);
  assert.match(group, /id="showAllViewsButton"/);
  assert.doesNotMatch(group, /class="view-preference-head"/);

  const body = functionBody(readRendererFile('app.js'), 'renderViewPreferences', 'renderToolPreferences');
  assert.match(body, /view-preference-row/);
  assert.match(body, /settings\.views\.hideView/);
  assert.match(body, /settings\.views\.showView/);
  assert.match(body, /createPreferenceOrderHandle\(\{ kind: 'view'/);
});

test('settings page uses collapsible icon sections with summaries', () => {
  const html = readRendererFile('index.html');
  assert.match(html, /class="settings-section-toggle"/);
  assert.match(html, /class="settings-section-icon settings-section-icon-general"/);
  assert.match(html, /class="settings-section-icon settings-section-icon-main"/);
  assert.match(html, /class="settings-section-icon settings-section-icon-window"/);
  assert.match(html, /class="settings-section-icon settings-section-icon-tools"/);
  assert.match(html, /class="settings-section-icon settings-section-icon-limits"/);
  assert.match(html, /class="settings-section-icon settings-section-icon-accounts"/);
  assert.match(html, /class="settings-section-icon settings-section-icon-sync"/);
  assert.match(html, /id="generalSettingsSummary"/);
  assert.match(html, /id="mainSettingsSummary"/);
  assert.match(html, /id="windowSettingsSummary"/);
  assert.match(html, /id="toolsSettingsSummary"/);
  assert.match(html, /id="viewsSettingsSummary"/);
  assert.match(html, /id="limitsSettingsSummary"/);
  assert.match(html, /data-settings-section="general"/);
  assert.match(html, /data-settings-section="main"/);
  assert.match(html, /data-settings-section="window"/);
  assert.match(html, /data-settings-section="tools"/);
  assert.match(html, /aria-controls="generalSettingsDetails"/);
  assert.match(html, /aria-controls="mainSettingsDetails"/);
  assert.match(html, /aria-controls="windowSettingsDetails"/);

  const app = readRendererFile('app.js');
  assert.match(app, /setupSettingsSections/);
  assert.match(app, /renderSettingsSummaries/);
  assert.match(app, /settingsSectionSummary/);
  assert.match(app, /for \(const other of SETTINGS_SECTION_IDS\)/);

  const css = readRendererFile('styles.css');
  assert.match(css, /\.settings-section-toggle/);
  assert.match(css, /\.settings-section-icon/);
  assert.match(css, /\.settings-section-summary/);
});

test('main section holds views and appearance; window section holds behavior and presence', () => {
  const html = readRendererFile('index.html');

  const main = html.slice(
    html.indexOf('<div id="mainSettingsDetails"'),
    html.indexOf('<div class="settings-group settings-collapsible-group settings-window-section-group"')
  );
  assert.notEqual(main, '', 'main section should exist');
  const mainScreenIndex = main.indexOf('settings-main-screen-group');
  const appearanceIndex = main.indexOf('settings-appearance-group');
  assert.ok(mainScreenIndex >= 0, 'main screen group should be first-class');
  assert.ok(appearanceIndex > mainScreenIndex, 'appearance group should follow main screen');
  assert.doesNotMatch(main, /settings\.language\.title/);

  const mainScreen = main.match(/<div class="settings-subgroup settings-main-screen-group">[\s\S]*?<div class="settings-subgroup settings-appearance-group">/)?.[0] || '';
  assert.match(mainScreen, /id="viewDisplayList"/);
  assert.match(mainScreen, /id="currencyInput"/);

  const windowSection = html.slice(
    html.indexOf('<div id="windowSettingsDetails"'),
    html.indexOf('<div class="settings-group settings-collapsible-group settings-tools-group"')
  );
  assert.notEqual(windowSection, '', 'window section should exist');
  const windowIndex = windowSection.indexOf('settings-window-group');
  const presenceIndex = windowSection.indexOf('settings-presence-group');
  assert.ok(windowIndex >= 0, 'window behavior group should be present');
  assert.ok(presenceIndex > windowIndex, 'floating and tray group should follow window');

  const windowGroup = windowSection.match(/<div class="settings-subgroup settings-window-group">[\s\S]*?<div class="settings-subgroup settings-presence-group">/)?.[0] || '';
  assert.match(windowGroup, /id="windowBehaviorInput"/);
  assert.match(windowGroup, /id="windowToggleShortcutRecordButton"/);
  assert.doesNotMatch(windowGroup, /id="floatingBubbleInput"/);

  const presenceGroup = windowSection.slice(presenceIndex);
  assert.match(presenceGroup, /id="floatingBubbleInput"/);
  assert.match(presenceGroup, /id="trayModeInput"/);
});

test('general section owns app-level preferences before startup and updates', () => {
  const html = readRendererFile('index.html');
  const generalSection = html.slice(
    html.indexOf('<div id="generalSettingsDetails"'),
    html.indexOf('<div class="settings-group settings-collapsible-group settings-main-group"')
  );
  assert.match(generalSection, /settings-language-group/);
  assert.ok(generalSection.indexOf('settings-language-group') < generalSection.indexOf('id="startupGroup"'));
  assert.match(generalSection, /id="languageInput"/);
  assert.doesNotMatch(generalSection, /id="currencyInput"/);
});

test('sync section icon reads as a hub network instead of a refresh arrow', () => {
  const css = readRendererFile('styles.css');
  const syncBefore = cssRule(css, '.settings-section-icon-sync::before');
  const syncAfter = cssRule(css, '.settings-section-icon-sync::after');
  assert.match(syncBefore, /box-shadow/);
  assert.doesNotMatch(syncBefore, /inset:\s*2px/);
  assert.doesNotMatch(syncAfter, /transform:\s*rotate/);
});

test('startup setting stays visible when login items are unsupported', () => {
  const html = readRendererFile('index.html');
  const startupGroup = html.match(/<div id="startupGroup"[\s\S]*?<p id="startupNote"/)?.[0] || '';
  assert.match(startupGroup, /id="startAtLoginInput"/);

  const app = readRendererFile('app.js');
  const syncBody = functionBody(app, 'syncSettingsForm', 'enabledClientSet');
  assert.doesNotMatch(syncBody, /startupGroup\?\.[\s\S]*classList\.toggle\(['"]hidden['"]/);
  assert.match(syncBody, /startAtLoginInput[\s\S]*\.disabled\s*=\s*!state\.appInfo\?\.loginItemSupported/);

  const summaryBody = functionBody(app, 'settingsSectionSummary', 'renderSettingsSummaries');
  assert.match(summaryBody, /settings\.summary\.unavailable/);
});

test('expanded settings sections keep content full width', () => {
  const css = readRendererFile('styles.css');
  assert.doesNotMatch(cssRule(css, '.settings-section-details'), /padding:\s*[^;]*24px/);
});

test('renderer applies the first visible view on cold startup only', () => {
  const app = readRendererFile('app.js');
  const body = functionBody(app, 'applyInitialBreakdownPreference', 'syncSettingsForm');
  assert.match(body, /initialBreakdownPreferenceApplied/);
  assert.match(body, /preferFirst:\s*true/);
  assert.match(body, /preferredViewId/);

  const syncBody = functionBody(app, 'syncSettingsForm', 'enabledClientSet');
  assert.match(syncBody, /applyInitialBreakdownPreference\(\)/);
});
