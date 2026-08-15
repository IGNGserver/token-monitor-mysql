'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..', '..');
const main = fs.readFileSync(path.join(root, 'src/electron/main.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src/electron/renderer/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/electron/renderer/styles.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'src/electron/renderer/index.html'), 'utf8');
const i18n = fs.readFileSync(path.join(root, 'src/electron/renderer/i18n.js'), 'utf8');
const {
  MACOS_GLASS_VIBRANCY,
  MACOS_GLASS_LIQUID,
  normalizeMacosGlassStyle,
  macosLiquidGlassAvailable,
  effectiveMacosGlassStyle
} = require('../../src/electron/macosGlassMode');
const { appearanceState } = require('../../src/electron/renderer/macosGlass');
const {
  applyMacosGlass,
  clearMacosGlass,
  macosLiquidGlassSupported
} = require('../../src/electron/macosGlassNative');

test('macOS glass mode follows the Darwin 25 boundary', () => {
  assert.equal(normalizeMacosGlassStyle('vibrancy'), MACOS_GLASS_VIBRANCY);
  assert.equal(normalizeMacosGlassStyle('liquid-glass'), MACOS_GLASS_LIQUID);
  assert.equal(normalizeMacosGlassStyle('mica'), MACOS_GLASS_VIBRANCY);
  assert.equal(macosLiquidGlassAvailable({ platform: 'darwin', osRelease: '24.6.0' }), false);
  assert.equal(macosLiquidGlassAvailable({ platform: 'darwin', osRelease: '25.0.0' }), true);
  assert.equal(macosLiquidGlassAvailable({ platform: 'win32', osRelease: '25.0.0' }), false);
  assert.equal(effectiveMacosGlassStyle({ macosGlassStyle: MACOS_GLASS_LIQUID }, { platform: 'darwin', osRelease: '24.6.0' }), MACOS_GLASS_VIBRANCY);
  assert.equal(effectiveMacosGlassStyle({ macosGlassStyle: MACOS_GLASS_LIQUID }, { platform: 'darwin', osRelease: '25.0.0' }), MACOS_GLASS_LIQUID);
});

test('macOS glass appearance exposes the selector and falls back on old systems', () => {
  assert.deepEqual(appearanceState({ macosGlassStyle: MACOS_GLASS_VIBRANCY }, { isMac: false, liquidAvailable: true }), {
    showStyleControl: false,
    showLiquidNote: false,
    requestedStyle: MACOS_GLASS_VIBRANCY,
    effectiveStyle: MACOS_GLASS_VIBRANCY,
    liquidAvailable: true
  });
  assert.deepEqual(appearanceState({ macosGlassStyle: MACOS_GLASS_LIQUID }, { isMac: true, liquidAvailable: false }), {
    showStyleControl: true,
    showLiquidNote: true,
    requestedStyle: MACOS_GLASS_LIQUID,
    effectiveStyle: MACOS_GLASS_VIBRANCY,
    liquidAvailable: false
  });
  assert.deepEqual(appearanceState({ systemGlass: false, macosGlassStyle: MACOS_GLASS_LIQUID }, { isMac: true, liquidAvailable: true }), {
    showStyleControl: false,
    showLiquidNote: false,
    requestedStyle: MACOS_GLASS_LIQUID,
    effectiveStyle: MACOS_GLASS_LIQUID,
    liquidAvailable: true
  });
});

test('macOS native glass adapter passes the NSView handle and selected mode', () => {
  const handle = Buffer.alloc(8);
  handle.writeBigUInt64LE(0x12345678n);
  const calls = [];
  const win = { getNativeWindowHandle: () => handle, isDestroyed: () => false };
  const api = {
    apply(nativeView, style) { calls.push(['apply', nativeView, style]); return true; },
    clear(nativeView) { calls.push(['clear', nativeView]); return true; },
    supported: true
  };

  assert.equal(applyMacosGlass(win, MACOS_GLASS_LIQUID, { platform: 'darwin', api }), true);
  assert.equal(clearMacosGlass(win, { platform: 'darwin', api }), true);
  assert.deepEqual(calls, [
    ['apply', 0x12345678n, MACOS_GLASS_LIQUID],
    ['clear', 0x12345678n]
  ]);
  assert.equal(macosLiquidGlassSupported({ api }), true);
  assert.equal(applyMacosGlass(win, MACOS_GLASS_LIQUID, { platform: 'win32', api }), false);
});

test('macOS glass selector and native Liquid Glass surface are wired into the renderer', () => {
  assert.match(main, /macosGlassStyle: macosLiquidGlassAvailable\(\{ platform: process\.platform/);
  assert.match(main, /macosGlassStyle: normalizeMacosGlassStyle\(patch\.macosGlassStyle/);
  assert.match(main, /applyMacosGlass\(win, style\)/);
  assert.match(main, /macosGlassEffectiveStyle: macosGlassStyleFor\(settings\)/);
  assert.match(html, /id="macosGlassRow" class="settings-item hidden"/);
  assert.match(html, /id="macosGlassInput"/);
  assert.match(html, /option value="vibrancy"/);
  assert.match(html, /option value="liquid-glass"/);
  assert.match(html, /data-i18n="settings\.appearance\.macosGlassLiquidNote"/);
  assert.match(app, /macosGlassRow\?\.classList\.toggle\('hidden', !macosGlass\.showStyleControl\)/);
  assert.match(app, /dataset\.macosGlass = macosGlass\.effectiveStyle/);
  assert.match(css, /html\[data-macos-glass="liquid-glass"\] \.shell/);
  assert.match(css, /backdrop-filter: none/);
  assert.equal((i18n.match(/'settings\.appearance\.macosGlassStyle':/g) || []).length, 5);
  assert.equal((i18n.match(/'settings\.appearance\.macosGlassLiquid':/g) || []).length, 5);
});
