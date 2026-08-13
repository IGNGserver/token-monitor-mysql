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

  function appearanceState(settings = {}, { isWindows = false, backdropSupported = true } = {}) {
    const backdropMode = normalizeWindowsBackdropMode(settings?.windowsBackdrop);
    return {
      showBackdropControl: isWindows && backdropSupported !== false,
      showAccentNote: false,
      showMicaNote: isWindows && backdropSupported !== false && backdropMode === 'mica',
      backdropMode
    };
  }

  // The native Windows backdrop belongs to the whole BrowserWindow, so the
  // renderer surface sits between the widget content and the DWM material.
  // Mica follows the wallpaper tint and must stay fairly translucent or it is
  // indistinguishable from a flat solid (which is how a near-opaque surface
  // reads as pure white on light themes). Acrylic's heavier blur tolerates a
  // denser surface. Both scale with the Glass slider so the material stays
  // visible across the whole range while keeping a readable floor for both
  // theme tones. Child menus get their own more opaque surface.
  function nativeSurfaceAlphas({ glassOpacity = 68, windowsBackdrop = 'acrylic', lightTheme = false } = {}) {
    const parsed = Number(glassOpacity);
    const opacity = (Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 68) / 100;
    const mode = normalizeWindowsBackdropMode(windowsBackdrop);
    const isMica = mode === WINDOWS_BACKDROP_MICA;
    const base = isMica ? 0.58 : 0.64;
    const tone = lightTheme ? 0.05 : 0;
    const surfaceAlpha = Math.min(0.94, base + tone + opacity * 0.28);
    const popoverAlpha = Math.max(lightTheme ? 0.92 : 0.88, Math.min(0.98, surfaceAlpha + 0.07));
    return {
      surfaceAlpha: Number(surfaceAlpha.toFixed(3)),
      popoverAlpha: Number(popoverAlpha.toFixed(3))
    };
  }

  return { appearanceState, nativeSurfaceAlphas, normalizeWindowsBackdropMode };
});
