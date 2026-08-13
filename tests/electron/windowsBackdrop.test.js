'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..', '..');
const main = fs.readFileSync(path.join(root, 'src/electron/main.js'), 'utf8');
const rendererDir = path.join(root, 'src/electron/renderer');
const app = fs.readFileSync(path.join(rendererDir, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(rendererDir, 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(rendererDir, 'index.html'), 'utf8');
const i18n = fs.readFileSync(path.join(rendererDir, 'i18n.js'), 'utf8');
const {
  DEFAULT_ACCENT_ARGB,
  applyWindowsAccentBlur,
  createAccentApi
} = require('../../src/electron/windowsBackdrop');
const { normalizeWindowsBackdropMode } = require('../../src/electron/windowsBackdropMode');
const {
  appearanceState,
  nativeSurfaceAlphas,
  normalizeWindowsBackdropMode: normalizeRendererMode
} = require('../../src/electron/renderer/windowsGlass');

test('Windows backdrop modes fail closed to documented Acrylic', () => {
  assert.equal(normalizeRendererMode, normalizeWindowsBackdropMode);
  for (const value of [undefined, null, '', 'nope', 'ACRYLIC', 'tabbed', 'accent']) {
    assert.equal(normalizeWindowsBackdropMode(value), 'acrylic');
    assert.equal(normalizeRendererMode(value), 'acrylic');
  }
  assert.equal(normalizeWindowsBackdropMode('mica'), 'mica');
  assert.equal(normalizeRendererMode('mica'), 'mica');
});

test('Windows glass appearance state covers platform boundaries', () => {
  assert.deepEqual(appearanceState({}, { isWindows: false }), {
    showBackdropControl: false,
    showAccentNote: false,
    showMicaNote: false,
    backdropMode: 'acrylic'
  });
  assert.deepEqual(appearanceState({ windowsBackdrop: 'acrylic' }, { isWindows: true }), {
    showBackdropControl: true,
    showAccentNote: false,
    showMicaNote: false,
    backdropMode: 'acrylic'
  });
  assert.deepEqual(appearanceState({ windowsBackdrop: 'mica' }, { isWindows: true }), {
    showBackdropControl: true,
    showAccentNote: false,
    showMicaNote: true,
    backdropMode: 'mica'
  });
  assert.deepEqual(appearanceState({ windowsBackdrop: 'mica' }, { isWindows: true, backdropSupported: false }), {
    showBackdropControl: false,
    showAccentNote: false,
    showMicaNote: false,
    backdropMode: 'mica'
  });
});

test('Windows material surfaces keep Mica visible across both theme tones', () => {
  const darkAcrylic = nativeSurfaceAlphas({ windowsBackdrop: 'acrylic', glassOpacity: 68, lightTheme: false });
  const darkMica = nativeSurfaceAlphas({ windowsBackdrop: 'mica', glassOpacity: 68, lightTheme: false });
  const lightAcrylic = nativeSurfaceAlphas({ windowsBackdrop: 'acrylic', glassOpacity: 68, lightTheme: true });
  const lightMica = nativeSurfaceAlphas({ windowsBackdrop: 'mica', glassOpacity: 68, lightTheme: true });

  for (const value of [darkAcrylic, darkMica, lightAcrylic, lightMica]) {
    assert.ok(value.surfaceAlpha >= 0.56, 'surface must stay translucent enough to show the material');
    assert.ok(value.surfaceAlpha <= 0.94, 'surface must keep a readable floor');
    assert.ok(value.popoverAlpha >= value.surfaceAlpha);
    assert.ok(value.popoverAlpha <= 0.98);
  }
  // Mica follows the wallpaper tint, so it needs a lighter surface than
  // Acrylic's heavier blur; a near-opaque shell reads as flat white instead.
  assert.ok(darkMica.surfaceAlpha < darkAcrylic.surfaceAlpha);
  assert.ok(lightMica.surfaceAlpha < lightAcrylic.surfaceAlpha);
  assert.ok(lightAcrylic.surfaceAlpha > darkAcrylic.surfaceAlpha);
  assert.ok(lightMica.surfaceAlpha > darkMica.surfaceAlpha);
  assert.ok(darkMica.surfaceAlpha < 0.85, 'default mica surface must not hide the wallpaper tint');

  const dim = nativeSurfaceAlphas({ windowsBackdrop: 'mica', glassOpacity: 0, lightTheme: false });
  const bright = nativeSurfaceAlphas({ windowsBackdrop: 'mica', glassOpacity: 100, lightTheme: false });
  assert.ok(bright.surfaceAlpha > darkMica.surfaceAlpha, 'surface tracks the Glass slider');
  assert.ok(darkMica.surfaceAlpha > dim.surfaceAlpha, 'surface tracks the Glass slider');
});

test('Accent blur passes the native HWND and configured tint to the native adapter', () => {
  const calls = [];
  const handle = Buffer.alloc(8);
  handle.writeBigUInt64LE(0x12345678n);
  const win = {
    getNativeWindowHandle: () => handle,
    isDestroyed: () => false
  };
  const api = {
    apply(hwnd, argb) {
      calls.push({ hwnd, argb });
      return true;
    }
  };

  assert.equal(applyWindowsAccentBlur(win, { platform: 'win32', api }), true);
  assert.deepEqual(calls, [{ hwnd: 0x12345678n, argb: DEFAULT_ACCENT_ARGB }]);
  assert.equal(applyWindowsAccentBlur(win, { platform: 'darwin', api }), false);
  assert.equal(applyWindowsAccentBlur({ ...win, isDestroyed: () => true }, { platform: 'win32', api }), false);
});

test('native Accent adapter enables a full blur region before applying policy and extending the frame', () => {
  const calls = [];
  const region = { pointer: 'region' };
  const fakeFunctions = {
    CreateRectRgn: (...args) => { calls.push(['region', ...args]); return region; },
    DwmEnableBlurBehindWindow: (_hwnd, value) => { calls.push(['blur', value]); return 0; },
    SetWindowCompositionAttribute: (_hwnd, value) => { calls.push(['accent', value]); return true; },
    DwmExtendFrameIntoClientArea: (_hwnd, value) => { calls.push(['frame', value]); return 0; },
    DeleteObject: (value) => { calls.push(['delete', value]); return true; }
  };
  const koffi = {
    load: () => ({
      func(signature) {
        const name = signature.match(/([A-Za-z0-9_]+)\(/)?.[1];
        return fakeFunctions[name];
      }
    }),
    struct: (name, fields) => ({ name, fields }),
    as: (value, type) => ({ value, type }),
    sizeof: () => 16
  };
  const api = createAccentApi(koffi);

  assert.equal(api.apply(7n, DEFAULT_ACCENT_ARGB), true);
  assert.deepEqual(calls.map(([name]) => name), ['region', 'blur', 'frame', 'accent', 'delete']);
  assert.equal(calls[1][1].dwFlags, 7);
  assert.equal(calls[1][1].hRgnBlur, region);
  assert.deepEqual(calls[2][1], {
    cxLeftWidth: -1,
    cxRightWidth: -1,
    cyTopHeight: -1,
    cyBottomHeight: -1
  });
  assert.equal(calls[3][1].Attrib, 19);
  assert.deepEqual(calls[3][1].pvData.value, {
    AccentState: 4,
    AccentFlags: 0,
    GradientColor: DEFAULT_ACCENT_ARGB,
    AnimationId: 0
  });
});

test('native Accent adapter rejects failed DWM setup before applying the Accent policy', () => {
  function run({ blurResult = 0, frameResult = 0 }) {
    const calls = [];
    const fakeFunctions = {
      CreateRectRgn: () => { calls.push('region'); return {}; },
      DwmEnableBlurBehindWindow: () => { calls.push('blur'); return blurResult; },
      DwmExtendFrameIntoClientArea: () => { calls.push('frame'); return frameResult; },
      SetWindowCompositionAttribute: () => { calls.push('accent'); return true; },
      DeleteObject: () => { calls.push('delete'); return true; }
    };
    const koffi = {
      load: () => ({
        func(signature) {
          return fakeFunctions[signature.match(/([A-Za-z0-9_]+)\(/)?.[1]];
        }
      }),
      struct: (name, fields) => ({ name, fields }),
      as: (value, type) => ({ value, type }),
      sizeof: () => 16
    };
    return { result: createAccentApi(koffi).apply(7n, DEFAULT_ACCENT_ARGB), calls };
  }

  assert.deepEqual(run({ blurResult: -1 }), {
    result: false,
    calls: ['region', 'blur', 'delete']
  });
  assert.deepEqual(run({ frameResult: -1 }), {
    result: false,
    calls: ['region', 'blur', 'frame', 'delete']
  });
  assert.deepEqual(run({ blurResult: 1, frameResult: 1 }), {
    result: true,
    calls: ['region', 'blur', 'frame', 'accent', 'delete']
  });
});

test('main process configures backgroundMaterial from windowsBackdrop', () => {
  assert.match(main, /windowsBackdrop: 'acrylic',/);
  assert.match(main, /windowsBackdrop: normalizeWindowsBackdropMode\(patch\.windowsBackdrop \?\? settings\.windowsBackdrop\)/);
  assert.match(main, /windowsElectronBackgroundMaterial\(/);
});

test('Windows exposes an accessible Acrylic and Mica selector', () => {
  assert.match(html, /name="systemGlassOption"/);
  assert.match(html, /id="glassInput"/);
  assert.match(html, /id="blurInput"/);
  assert.match(html, /id="windowsBackdropRow" class="settings-item hidden"/);
  assert.match(html, /id="windowsBackdropInput"/);
  assert.match(html, /option value="acrylic"/);
  assert.match(html, /option value="mica"/);
  assert.doesNotMatch(html, /option value="tabbed"/);
  assert.doesNotMatch(html, /option value="accent"/);
  assert.match(html, /data-i18n="settings\.appearance\.windowsBackdropNote"/);
  assert.match(html, /id="windowsBackdropNote"/);
  assert.match(html, /<script src="\.\.\/windowsBackdropMode\.js"><\/script>[\s\S]*<script src="windowsGlass\.js"><\/script>[\s\S]*<script src="app\.js"><\/script>/);
  assert.match(app, /windowsBackdropRow\?\.classList\.toggle\('hidden', !windowsGlass\.showBackdropControl\)/);
  assert.match(app, /const showNote = windowsGlass\.showAccentNote \|\| windowsGlass\.showMicaNote/);
  assert.match(app, /classList\.toggle\('hidden', !showNote\)/);
  assert.doesNotMatch(app, /backdropControlDisabled/);
  assert.equal((i18n.match(/'settings\.appearance\.windowsBackdrop':/g) || []).length, 5);
  assert.equal((i18n.match(/'settings\.appearance\.windowsBackdropMica':/g) || []).length, 5);
  assert.equal((i18n.match(/'settings\.appearance\.windowsBackdropMicaNote':/g) || []).length, 5);
  assert.match(i18n, /Keeps the background translucent and blurred, even when the window is not focused\./);
  assert.doesNotMatch(css, /windows-native-blur-only/);
  assert.match(css, /--windows-surface-alpha/);
  assert.match(css, /--windows-popover-alpha/);
  assert.doesNotMatch(css, /background:\s*rgba\(var\(--glass-rgb\),\s*0\.35\)/);
  assert.doesNotMatch(css, /background:\s*rgba\(var\(--glass-rgb\),\s*0\.45\)/);
  assert.match(app, /!systemGlassDisabled[\s\S]*windowsGlass\.showBackdropControl/);
  assert.match(app, /windowsBackdropUnsupported/);
  assert.match(main, /windowsNativeBackdropSupported\(\)/);
  assert.match(main, /build >= 22621/);
});

test('experimental Accent mode uses the shared glass surface treatment', () => {
  assert.doesNotMatch(app, /windows-accent-backdrop/);
  assert.doesNotMatch(css, /windows-accent-backdrop/);
  assert.match(css, /#windowsBackdropNote\.hidden \{ display: none; \}/);
});

test('normalizeWindowsBackdropMode accepts mica and acrylic', () => {
  const {
    normalizeWindowsBackdropMode,
    windowsElectronBackgroundMaterial,
    WINDOWS_BACKDROP_MICA,
    WINDOWS_BACKDROP_ACRYLIC
  } = require('../../src/electron/windowsBackdropMode');
  assert.equal(normalizeWindowsBackdropMode('mica'), WINDOWS_BACKDROP_MICA);
  assert.equal(normalizeWindowsBackdropMode('acrylic'), WINDOWS_BACKDROP_ACRYLIC);
  assert.equal(normalizeWindowsBackdropMode('tabbed'), WINDOWS_BACKDROP_ACRYLIC);
  assert.equal(normalizeWindowsBackdropMode('accent'), WINDOWS_BACKDROP_ACRYLIC);
  assert.equal(normalizeWindowsBackdropMode('nope'), WINDOWS_BACKDROP_ACRYLIC);
  assert.equal(windowsElectronBackgroundMaterial('mica'), 'tabbed');
  assert.equal(windowsElectronBackgroundMaterial('acrylic'), 'acrylic');
  assert.equal(windowsElectronBackgroundMaterial('tabbed'), 'acrylic');
});
