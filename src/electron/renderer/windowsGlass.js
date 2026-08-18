'use strict';

(function initWindowsGlass(root, factory) {
  const backdropModeApi = typeof module === 'object' && module.exports
    ? require('../windowsBackdropMode')
    : root?.TokenMonitorWindowsBackdropMode;
  const api = factory(backdropModeApi);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TokenMonitorWindowsGlass = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, (backdropModeApi) => {
  const { normalizeWindowsBackdropMode } = backdropModeApi;

  function appearanceState(settings = {}, { isWindows = false, backdropSupported = true } = {}) {
    const systemGlassEnabled = settings?.systemGlass !== false;
    const backdropMode = normalizeWindowsBackdropMode(settings?.windowsBackdrop);
    return {
      showBackdropControl: isWindows && systemGlassEnabled && backdropSupported !== false,
      showAccentNote: false,
      showMicaNote: isWindows && systemGlassEnabled && backdropSupported !== false && backdropMode === 'mica',
      backdropMode
    };
  }

  // Native Mica/Acrylic is already the BrowserWindow's base layer. Only
  // transient HTML surfaces need an app-owned fill; the shell itself is kept
  // transparent in styles.css so it cannot cover the DWM material.
  function nativePopoverAlpha({ lightTheme = false } = {}) {
    return lightTheme ? 0.92 : 0.88;
  }

  return { appearanceState, nativePopoverAlpha, normalizeWindowsBackdropMode };
});
