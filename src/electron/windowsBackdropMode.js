'use strict';

(function initWindowsBackdropMode(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TokenMonitorWindowsBackdropMode = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const WINDOWS_BACKDROP_ACRYLIC = 'acrylic';
  const WINDOWS_BACKDROP_MICA = 'mica';

  const ELECTRON_MATERIALS = new Set([
    WINDOWS_BACKDROP_ACRYLIC,
    WINDOWS_BACKDROP_MICA
  ]);

  function normalizeWindowsBackdropMode(value) {
    if (value === WINDOWS_BACKDROP_MICA) return WINDOWS_BACKDROP_MICA;
    return WINDOWS_BACKDROP_ACRYLIC;
  }

  function windowsElectronBackgroundMaterial(mode) {
    const normalized = normalizeWindowsBackdropMode(mode);
    return ELECTRON_MATERIALS.has(normalized) ? normalized : WINDOWS_BACKDROP_ACRYLIC;
  }

  return {
    WINDOWS_BACKDROP_ACRYLIC,
    WINDOWS_BACKDROP_MICA,
    normalizeWindowsBackdropMode,
    windowsElectronBackgroundMaterial
  };
});
