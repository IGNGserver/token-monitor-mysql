'use strict';

(function initWindowsBackdropMode(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TokenMonitorWindowsBackdropMode = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const WINDOWS_BACKDROP_ACRYLIC = 'acrylic';
  const WINDOWS_BACKDROP_MICA = 'mica';


  function normalizeWindowsBackdropMode(value) {
    if (value === WINDOWS_BACKDROP_MICA) return WINDOWS_BACKDROP_MICA;
    return WINDOWS_BACKDROP_ACRYLIC;
  }

  function windowsElectronBackgroundMaterial(mode) {
    const normalized = normalizeWindowsBackdropMode(mode);
    if (normalized === WINDOWS_BACKDROP_MICA) {
      return 'tabbed';
    }
    return WINDOWS_BACKDROP_ACRYLIC;
  }

  return {
    WINDOWS_BACKDROP_ACRYLIC,
    WINDOWS_BACKDROP_MICA,
    normalizeWindowsBackdropMode,
    windowsElectronBackgroundMaterial
  };
});
