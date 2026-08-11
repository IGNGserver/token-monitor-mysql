'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  chooseLinuxOzonePlatform,
  configureLinuxDisplayBackend,
  isWaylandSession,
  mergeEnableFeatures
} = require('../../src/electron/linuxDisplay');

test('Wayland detection is limited to Linux sessions', () => {
  assert.equal(isWaylandSession({ platform: 'linux', env: { XDG_SESSION_TYPE: 'wayland' } }), true);
  assert.equal(isWaylandSession({ platform: 'linux', env: { WAYLAND_DISPLAY: 'wayland-0' } }), true);
  assert.equal(isWaylandSession({ platform: 'linux', env: { XDG_SESSION_TYPE: 'x11' } }), false);
  assert.equal(isWaylandSession({ platform: 'win32', env: { XDG_SESSION_TYPE: 'wayland' } }), false);
});

test('Wayland sessions with XWayland use X11 unless explicitly overridden', () => {
  const env = { XDG_SESSION_TYPE: 'wayland', WAYLAND_DISPLAY: 'wayland-0', DISPLAY: ':0' };
  assert.equal(chooseLinuxOzonePlatform({ platform: 'linux', env, argv: [] }), 'x11');
  assert.equal(chooseLinuxOzonePlatform({ platform: 'linux', env, argv: ['--ozone-platform=wayland'] }), null);
  assert.equal(chooseLinuxOzonePlatform({ platform: 'linux', env: { ...env, DISPLAY: '' }, argv: [] }), null);
});

test('Wayland display setup enables the global shortcuts portal and preserves existing features', () => {
  const calls = [];
  const result = configureLinuxDisplayBackend({
    platform: 'linux',
    env: { XDG_SESSION_TYPE: 'wayland', WAYLAND_DISPLAY: 'wayland-0', DISPLAY: ':0' },
    argv: ['electron', '--enable-features=UseOzonePlatform'],
    app: { commandLine: { appendSwitch: (...args) => calls.push(args) } }
  });

  assert.deepEqual(result, { wayland: true, ozonePlatform: 'x11', globalShortcutsPortal: true });
  assert.deepEqual(calls, [
    ['enable-features', 'UseOzonePlatform,GlobalShortcutsPortal'],
    ['ozone-platform', 'x11']
  ]);
});

test('Wayland display setup does not override an existing portal feature or non-Linux backend', () => {
  const calls = [];
  const app = { commandLine: { appendSwitch: (...args) => calls.push(args) } };
  assert.deepEqual(configureLinuxDisplayBackend({
    platform: 'linux',
    env: { XDG_SESSION_TYPE: 'wayland', WAYLAND_DISPLAY: 'wayland-0', DISPLAY: ':0' },
    argv: ['--enable-features=GlobalShortcutsPortal', '--ozone-platform=wayland'],
    app
  }), { wayland: true, ozonePlatform: null, globalShortcutsPortal: true });
  assert.deepEqual(calls, []);
  assert.deepEqual(configureLinuxDisplayBackend({ platform: 'darwin', env: { XDG_SESSION_TYPE: 'wayland' }, app }), {
    wayland: false,
    ozonePlatform: null,
    globalShortcutsPortal: false
  });
});

test('mergeEnableFeatures de-duplicates and appends the portal feature', () => {
  assert.equal(mergeEnableFeatures('A, GlobalShortcutsPortal, A'), 'A,GlobalShortcutsPortal,A');
  assert.equal(mergeEnableFeatures('A'), 'A,GlobalShortcutsPortal');
  assert.equal(mergeEnableFeatures(''), 'GlobalShortcutsPortal');
});
