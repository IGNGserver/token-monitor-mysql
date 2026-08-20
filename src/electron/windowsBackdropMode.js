'use strict';

(function initWindowsBackdropMode(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TokenMonitorWindowsBackdropMode = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const WINDOWS_BACKDROP_ACRYLIC = 'acrylic';
  const WINDOWS_BACKDROP_MICA = 'mica';
  const WINDOWS_BACKDROP_ACCENT = 'accent';

  function normalizeWindowsBackdropMode(value) {
    if (value === WINDOWS_BACKDROP_MICA) return WINDOWS_BACKDROP_MICA;
    if (value === WINDOWS_BACKDROP_ACCENT) return WINDOWS_BACKDROP_ACCENT;
    return WINDOWS_BACKDROP_ACRYLIC;
  }

  function windowsElectronBackgroundMaterial(mode) {
    const normalized = normalizeWindowsBackdropMode(mode);
    if (normalized === WINDOWS_BACKDROP_MICA) {
      // `tabbed` is Mica Alt, which applies the stronger tint intended for a
      // window with a tabbed title bar. The setting exposed here is the base
      // Mica material used by long-lived Windows surfaces such as Settings.
      return 'mica';
    }
    return WINDOWS_BACKDROP_ACRYLIC;
  }

  return {
    WINDOWS_BACKDROP_ACRYLIC,
    WINDOWS_BACKDROP_MICA,
    WINDOWS_BACKDROP_ACCENT,
    normalizeWindowsBackdropMode,
    windowsElectronBackgroundMaterial
  };
});
