'use strict';

(function initWindowsGlass(root, factory) {
  const backdropModeApi = typeof module === 'object' && module.exports
    ? require('../windowsBackdropMode')
    : root?.TokenMonitorWindowsBackdropMode;
  const api = factory(backdropModeApi);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TokenMonitorWindowsGlass = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, (backdropModeApi) => {
  const {
    WINDOWS_BACKDROP_MICA,
    normalizeWindowsBackdropMode
  } = backdropModeApi;

  function appearanceState(settings = {}, { isWindows = false } = {}) {
    const backdropMode = normalizeWindowsBackdropMode(settings?.windowsBackdrop);
    return {
      showBackdropControl: isWindows,
      showAccentNote: false,
      showMicaNote: isWindows && backdropMode === 'mica',
      backdropMode
    };
  }

  // The native Windows backdrop belongs to the whole BrowserWindow. Child
  // menus therefore need a substantially more opaque themed surface of their
  // own, otherwise the widget's content (or the desktop material underneath)
  // remains legible through the menu. Keep a little room for Mica/Acrylic to
  // show through, while enforcing a readable floor for both theme tones.
  function nativeSurfaceAlphas({ glassOpacity = 68, windowsBackdrop = 'acrylic', lightTheme = false } = {}) {
    const parsed = Number(glassOpacity);
    const opacity = (Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 68) / 100;
    const mode = normalizeWindowsBackdropMode(windowsBackdrop);
    const base = lightTheme
      ? (mode === WINDOWS_BACKDROP_MICA ? 0.96 : 0.93)
      : (mode === WINDOWS_BACKDROP_MICA ? 0.91 : 0.88);
    const floor = lightTheme ? 0.90 : 0.84;
    const surfaceAlpha = Math.max(floor, Math.min(0.98, base - ((1 - opacity) * 0.06)));
    const popoverAlpha = Math.max(lightTheme ? 0.95 : 0.93, Math.min(0.99, surfaceAlpha + 0.05));
    return {
      surfaceAlpha: Number(surfaceAlpha.toFixed(3)),
      popoverAlpha: Number(popoverAlpha.toFixed(3))
    };
  }

  return { appearanceState, nativeSurfaceAlphas, normalizeWindowsBackdropMode };
});
