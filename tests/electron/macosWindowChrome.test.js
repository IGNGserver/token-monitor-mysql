'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  MACOS_TRAFFIC_LIGHT_POSITION,
  applyMacosNativeWindowButtons
} = require('../../src/electron/macosWindowChrome');

const ROOT = path.join(__dirname, '..', '..');

function read(...parts) {
  return fs.readFileSync(path.join(ROOT, ...parts), 'utf8');
}

test('macOS native traffic lights are positioned and shown for normal windows', () => {
  const calls = [];
  const win = {
    isDestroyed: () => false,
    setWindowButtonPosition: (position) => calls.push(['position', position]),
    setWindowButtonVisibility: (visible) => calls.push(['visibility', visible])
  };

  assert.equal(applyMacosNativeWindowButtons(win, { platform: 'darwin' }), true);
  assert.deepEqual(calls, [
    ['position', MACOS_TRAFFIC_LIGHT_POSITION],
    ['visibility', true]
  ]);
});

test('collapsed macOS floating bubbles hide native traffic lights', () => {
  const calls = [];
  const win = {
    isDestroyed: () => false,
    setWindowButtonPosition: (position) => calls.push(['position', position]),
    setWindowButtonVisibility: (visible) => calls.push(['visibility', visible])
  };

  assert.equal(applyMacosNativeWindowButtons(win, { platform: 'darwin', visible: false }), true);
  assert.deepEqual(calls, [['visibility', false]]);
});

test('native traffic-light helper is inert off macOS', () => {
  const calls = [];
  const win = {
    setWindowButtonPosition: () => calls.push('position'),
    setWindowButtonVisibility: () => calls.push('visibility')
  };

  assert.equal(applyMacosNativeWindowButtons(win, { platform: 'linux' }), false);
  assert.deepEqual(calls, []);
});

test('main and dashboard windows use native controls only on macOS', () => {
  const main = read('src', 'electron', 'main.js');
  const renderer = read('src', 'electron', 'renderer', 'app.js');
  const dashboard = read('src', 'electron', 'renderer', 'dashboard.js');
  const styles = read('src', 'electron', 'renderer', 'styles.css');
  const dashboardStyles = read('src', 'electron', 'renderer', 'dashboard.css');

  assert.match(main, /applyMacosNativeWindowButtons\(win, \{ visible: !collapsedFloatingBubble \}\)/);
  assert.match(main, /dashboardWindow = win;[\s\S]*?applyMacosNativeWindowButtons\(win\)/);
  assert.match(renderer, /classList\.toggle\('is-macos', isMac\)/);
  assert.match(dashboard, /classList\.toggle\('is-macos', isMac\)/);
  assert.match(styles, /body\.is-macos \.window-actions,[\s\S]*?body\.is-macos \.actions-hotspot/);
  assert.match(dashboardStyles, /body\.is-macos \.dash-header-actions #minBtn,[\s\S]*?body\.is-macos \.dash-header-actions #closeBtn/);
});
