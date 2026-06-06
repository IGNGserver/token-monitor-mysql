'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rendererDir = path.join(__dirname, '..', '..', 'src', 'electron', 'renderer');

function readRendererFile(name) {
  return fs.readFileSync(path.join(rendererDir, name), 'utf8');
}

function cssRule(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `${selector} rule should exist`);
  return match[1];
}

function declaration(rule, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = rule.match(new RegExp(`${escaped}\\s*:\\s*([^;]+);`));
  return match?.[1].trim() || '';
}

function functionBody(source, name, nextName) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} function should exist`);
  const end = source.indexOf(`function ${nextName}(`, start);
  assert.notEqual(end, -1, `${nextName} function should follow ${name}`);
  return source.slice(start, end);
}

function functionBodyBeforeMarker(source, name, marker) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} function should exist`);
  const end = source.indexOf(marker, start);
  assert.notEqual(end, -1, `${marker} marker should follow ${name}`);
  return source.slice(start, end);
}

test('Cursor account status stays inline with an email-only summary', () => {
  const html = readRendererFile('index.html');
  const toggle = html.match(/<button id="cursorSettingsToggle"[\s\S]*?<\/button>/)?.[0] || '';
  assert.match(
    toggle,
    /<span data-i18n="settings\.cursor\.title"[\s\S]*?<\/span>\s*<span class="cursor-settings-summary">[\s\S]*?<span id="cursorAccountStatus"[\s\S]*?<\/span>\s*<span class="cursor-disclosure-icon"/,
    'status pill and disclosure icon should stay on the title row'
  );
  assert.match(
    toggle,
    /<span class="cursor-disclosure-icon" aria-hidden="true"><\/span>/,
    'CSS chevron should not render on top of a text arrow'
  );

  const css = readRendererFile('styles.css');
  const toggleRule = cssRule(css, '.cursor-settings-toggle');
  assert.equal(declaration(toggleRule, 'flex-wrap'), '');

  const summaryRule = cssRule(css, '.settings-group-header .cursor-settings-summary');
  assert.equal(declaration(summaryRule, 'max-width'), '58%');

  const pillRule = cssRule(css, '.cursor-status-pill');
  assert.equal(declaration(pillRule, 'white-space'), 'nowrap');
  assert.equal(declaration(pillRule, 'overflow-wrap'), '');

  const iconRule = cssRule(css, '.cursor-disclosure-icon');
  assert.equal(declaration(iconRule, 'display'), 'inline-grid');
  assert.equal(declaration(iconRule, 'place-items'), 'center');
  assert.equal(declaration(iconRule, 'height'), '12px');
  assert.equal(declaration(iconRule, 'transform-origin'), 'center');
  assert.equal(declaration(iconRule, 'transform'), '');

  const expandedRule = cssRule(css, '.cursor-account-group.expanded .cursor-disclosure-icon');
  assert.equal(declaration(expandedRule, 'transform'), 'rotate(180deg)');
});

test('Cursor account header omits plan and reset details', () => {
  const body = functionBody(readRendererFile('app.js'), 'renderCursorStatus', 'refreshCursorStatus');
  assert.match(body, /const summary = status\.email \|\| t\('settings\.cursor\.loggedIn'\);/);
  assert.match(body, /setCursorStatusText\(statusEl, summary\);/);
  assert.doesNotMatch(body, /membershipType|billingCycleEnd|billingResets/);
});

test('OpenCode account panel mirrors Cursor linked-state controls', () => {
  const html = readRendererFile('index.html');
  const details = html.match(/<div id="opencodeSettingsDetails"[\s\S]*?<div id="opencodeErrorMessage" class="settings-note error hidden"><\/div>/)?.[0] || '';
  assert.match(details, /<button id="opencodeLogoutButton" class="hidden" data-i18n="settings\.common\.logout">/);
  assert.match(details, /<button id="opencodeRefreshButton" class="hidden" data-i18n="settings\.common\.refresh">/);
  assert.match(details, /<div id="opencodeManualPanel">[\s\S]*?<textarea id="opencodeCookieInput"/);
  assert.match(details, /data-i18n="settings\.opencode\.step3Before">Copy the<\/span> <code>auth<\/code> <span data-i18n="settings\.opencode\.step3After">value\.<\/span>/);
  assert.doesNotMatch(details, /Name\/Value columns/);
  assert.doesNotMatch(details, /auth=&lt;auth value&gt;/);
  assert.doesNotMatch(details, /oc_locale/);
  assert.doesNotMatch(details, /full Cookie header/);
  assert.match(details, /placeholder="auth=\.\.\."/);
  assert.match(details, /<div id="opencodeErrorMessage" class="settings-note error hidden"><\/div>/);

  const app = readRendererFile('app.js');
  const renderBody = functionBody(app, 'renderOpencodeStatus', 'refreshOpencodeStatus');
  assert.match(
    renderBody,
    /if \(status\.saveFailed\) \{[\s\S]*logoutBtn\.classList\.add\('hidden'\);[\s\S]*refreshBtn\.classList\.add\('hidden'\);[\s\S]*manualPanel\.classList\.remove\('hidden'\);/,
    'failed manual saves should not expose linked-account controls'
  );
  assert.match(renderBody, /t\('settings\.opencode\.statusLinked'\)/);
  assert.match(renderBody, /logoutBtn\.classList\.remove\('hidden'\)/);
  assert.match(renderBody, /refreshBtn\.classList\.remove\('hidden'\)/);
  assert.match(renderBody, /manualPanel\.classList\.add\('hidden'\)/);

  const setupBody = functionBodyBeforeMarker(app, 'setupCursorAccountUI', '\nsetupCursorAccountUI();');
  assert.match(setupBody, /window\.tokenMonitor\.openExternal\('https:\/\/opencode\.ai\/auth'\)/);
  assert.match(setupBody, /saveFailed: true/);
  assert.match(setupBody, /window\.tokenMonitor\.opencode\.logout\(\)/);
  assert.match(setupBody, /refreshOpencodeStatus\(\)/);
});
