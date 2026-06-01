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
