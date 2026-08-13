'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rendererDir = path.join(__dirname, '..', '..', 'src', 'electron', 'renderer');
const app = fs.readFileSync(path.join(rendererDir, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(rendererDir, 'index.html'), 'utf8');

test('appearance controls are wired with unguarded bindings', () => {
  const appearance = html.slice(
    html.indexOf('<div id="appearanceSettingsDetails"'),
    html.indexOf('<div class="settings-group settings-collapsible-group settings-tools-group"')
  );
  assert.match(appearance, /id="glassInput"/);
  assert.match(appearance, /id="blurInput"/);

  const legacyBindings = app.slice(
    app.indexOf('els.resetGlassButton'),
    app.indexOf('els.openConfigButton')
  );
  assert.match(legacyBindings, /els\.resetZoomButton\?\.addEventListener\('click'/);
  assert.match(legacyBindings, /els\.resetGlassButton\.addEventListener\('click'/);
  assert.match(legacyBindings, /els\.resetDepthButton\.addEventListener\('click'/);
  assert.match(legacyBindings, /els\.glassInput\.addEventListener\('input'/);
  assert.match(legacyBindings, /els\.blurInput\.addEventListener\('input'/);
  assert.doesNotMatch(legacyBindings, /els\.(?:glassInput|blurInput|resetGlassButton|resetDepthButton)\?\.addEventListener/);
});
