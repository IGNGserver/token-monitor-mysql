'use strict';

(function initMacosGlass(root, factory) {
  const modeApi = typeof module === 'object' && module.exports
    ? require('../macosGlassMode')
    : root?.TokenMonitorMacosGlassMode;
  const api = factory(modeApi);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TokenMonitorMacosGlass = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, (modeApi) => {
  function appearanceState(settings = {}, { isMac = false, liquidAvailable = false } = {}) {
    const systemGlassEnabled = settings?.systemGlass !== false;
    const requestedStyle = modeApi.normalizeMacosGlassStyle(settings?.macosGlassStyle);
    const effectiveStyle = requestedStyle === modeApi.MACOS_GLASS_LIQUID && liquidAvailable
      ? modeApi.MACOS_GLASS_LIQUID
      : modeApi.MACOS_GLASS_VIBRANCY;
    return {
      showStyleControl: isMac && systemGlassEnabled,
      showLiquidNote: isMac && systemGlassEnabled
        && requestedStyle === modeApi.MACOS_GLASS_LIQUID
        && !liquidAvailable,
      requestedStyle,
      effectiveStyle,
      liquidAvailable
    };
  }

  return { appearanceState };
});
