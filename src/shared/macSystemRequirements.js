'use strict';

// electron-builder writes the marketing version into LSMinimumSystemVersion,
// while electron-updater compares update metadata against Darwin's os.release().
const MAC_APP_MIN_VERSION = '12.0';
const MAC_APP_MIN_DARWIN_VERSION = '21.0.0';
const MAC_WIDGET_MIN_VERSION = '14.0';
const MAC_WIDGET_MIN_DARWIN_VERSION = '23.0.0';

const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-.*)?$/;

function parseSemverTuple(value) {
  if (typeof value !== 'string') return null;
  const match = SEMVER_RE.exec(value.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareSemverTuples(a, b) {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
  }
  return 0;
}

function macWidgetRuntimeSupport({ platform = process.platform, osRelease = '' } = {}) {
  if (platform !== 'darwin') {
    return { supported: false, reason: 'unsupported-platform' };
  }
  const current = parseSemverTuple(String(osRelease || '').trim());
  const required = parseSemverTuple(MAC_WIDGET_MIN_DARWIN_VERSION);
  if (!current || compareSemverTuples(current, required) < 0) {
    return { supported: false, reason: 'unsupported-os' };
  }
  return { supported: true, reason: null };
}

module.exports = {
  MAC_APP_MIN_DARWIN_VERSION,
  MAC_APP_MIN_VERSION,
  MAC_WIDGET_MIN_DARWIN_VERSION,
  MAC_WIDGET_MIN_VERSION,
  macWidgetRuntimeSupport
};
