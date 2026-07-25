'use strict';

(function initWindowsBackdropMode(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TokenMonitorWindowsBackdropMode = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const WINDOWS_BACKDROP_ACRYLIC = 'acrylic';
  const WINDOWS_BACKDROP_MICA = 'mica';
  const WINDOWS_BACKDROP_TABBED = 'tabbed';
  const WINDOWS_BACKDROP_ACCENT = 'accent';

  const ELECTRON_MATERIALS = new Set([
    WINDOWS_BACKDROP_ACRYLIC,
    WINDOWS_BACKDROP_MICA,
    WINDOWS_BACKDROP_TABBED
  ]);

  function normalizeWindowsBackdropMode(value) {
    if (value === WINDOWS_BACKDROP_ACCENT) return WINDOWS_BACKDROP_ACCENT;
    if (value === WINDOWS_BACKDROP_MICA) return WINDOWS_BACKDROP_MICA;
    if (value === WINDOWS_BACKDROP_TABBED) return WINDOWS_BACKDROP_TABBED;
    return WINDOWS_BACKDROP_ACRYLIC;
  }

  function windowsElectronBackgroundMaterial(mode) {
    const normalized = normalizeWindowsBackdropMode(mode);
    return ELECTRON_MATERIALS.has(normalized) ? normalized : WINDOWS_BACKDROP_ACRYLIC;
  }

  function isWindowsAccentBackdrop(mode) {
    return normalizeWindowsBackdropMode(mode) === WINDOWS_BACKDROP_ACCENT;
  }

  return {
    WINDOWS_BACKDROP_ACRYLIC,
    WINDOWS_BACKDROP_MICA,
    WINDOWS_BACKDROP_TABBED,
    WINDOWS_BACKDROP_ACCENT,
    normalizeWindowsBackdropMode,
    windowsElectronBackgroundMaterial,
    isWindowsAccentBackdrop
  };
});
