'use strict';

(function initMacosGlassMode(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TokenMonitorMacosGlassMode = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const MACOS_GLASS_VIBRANCY = 'vibrancy';
  const MACOS_GLASS_LIQUID = 'liquid-glass';
  // macOS 26 (Tahoe) uses Darwin 25.x.
  const MACOS_LIQUID_GLASS_DARWIN_MAJOR = 25;

  function normalizeMacosGlassStyle(value) {
    return value === MACOS_GLASS_LIQUID ? MACOS_GLASS_LIQUID : MACOS_GLASS_VIBRANCY;
  }

  function darwinMajor(osRelease) {
    const major = Number.parseInt(String(osRelease || '').split('.')[0], 10);
    return Number.isFinite(major) ? major : 0;
  }

  function macosLiquidGlassAvailable({ platform, osRelease } = {}) {
    return platform === 'darwin' && darwinMajor(osRelease) >= MACOS_LIQUID_GLASS_DARWIN_MAJOR;
  }

  function effectiveMacosGlassStyle(settingsOrStyle, context = {}) {
    const requested = typeof settingsOrStyle === 'object' && settingsOrStyle !== null
      ? settingsOrStyle.macosGlassStyle
      : settingsOrStyle;
    const normalized = normalizeMacosGlassStyle(requested);
    return normalized === MACOS_GLASS_LIQUID && macosLiquidGlassAvailable(context)
      ? MACOS_GLASS_LIQUID
      : MACOS_GLASS_VIBRANCY;
  }

  return {
    MACOS_GLASS_VIBRANCY,
    MACOS_GLASS_LIQUID,
    MACOS_LIQUID_GLASS_DARWIN_MAJOR,
    normalizeMacosGlassStyle,
    darwinMajor,
    macosLiquidGlassAvailable,
    effectiveMacosGlassStyle
  };
});
