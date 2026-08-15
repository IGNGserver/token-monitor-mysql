'use strict';

const MACOS_TRAFFIC_LIGHT_POSITION = Object.freeze({ x: 14, y: 12 });

function applyMacosNativeWindowButtons(win, options = {}) {
  const platform = options.platform || process.platform;
  if (platform !== 'darwin') return false;
  if (!win || win.isDestroyed?.()) return false;

  const visible = options.visible !== false;
  const position = options.position || MACOS_TRAFFIC_LIGHT_POSITION;
  let applied = false;

  if (visible && typeof win.setWindowButtonPosition === 'function') {
    try {
      win.setWindowButtonPosition({ x: Number(position.x), y: Number(position.y) });
    } catch (_) {}
  }
  if (typeof win.setWindowButtonVisibility === 'function') {
    try {
      win.setWindowButtonVisibility(visible);
      applied = true;
    } catch (_) {}
  }
  return applied;
}

module.exports = {
  MACOS_TRAFFIC_LIGHT_POSITION,
  applyMacosNativeWindowButtons
};
