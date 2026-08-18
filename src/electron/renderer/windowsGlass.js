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
    const systemGlassEnabled = settings.systemGlass !== false;
    const backdropMode = normalizeWindowsBackdropMode(settings.windowsBackdrop);
    return {
      showBackdropControl: isWindows && systemGlassEnabled && backdropSupported !== false,
      showAccentNote: isWindows && systemGlassEnabled && backdropSupported !== false && backdropMode === 'accent',
      showMicaNote: isWindows && systemGlassEnabled && backdropSupported !== false && backdropMode === 'mica',
      backdropMode
    };
  }

  return { appearanceState, normalizeWindowsBackdropMode };
});
