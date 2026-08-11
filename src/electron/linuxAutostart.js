'use strict';

// Linux "start at login" for AppImage builds. Electron's app.setLoginItemSettings
// is a no-op on Linux, so we manage an XDG autostart entry ourselves:
// ~/.config/autostart/token-monitor.desktop pointing Exec= at $APPIMAGE
// (the absolute path the AppImage runtime exports for the running image).

const fs = require('fs');
const os = require('os');
const path = require('path');

const DESKTOP_FILE_NAME = 'token-monitor.desktop';
const STARTED_AT_LOGIN_ARG = '--started-at-login';

function autostartSupported({ platform = process.platform, env = process.env } = {}) {
  return platform === 'linux' && Boolean(env.APPIMAGE);
}

// posix join on purpose: XDG paths are POSIX paths, and this keeps the module's
// output identical when the test suite runs on Windows CI.
function desktopFilePath({ env = process.env } = {}) {
  const configHome = env.XDG_CONFIG_HOME || path.posix.join(env.HOME || os.homedir(), '.config');
  return path.posix.join(configHome, 'autostart', DESKTOP_FILE_NAME);
}

// Desktop Entry spec quoting: the Exec argument is double-quoted with `"`, `` ` ``,
// `$` and `\` backslash-escaped, literal `%` doubled for field-code expansion,
// then the string-value layer doubles every backslash.
function quoteExecArgument(value) {
  const quoted = String(value).replace(/%/g, '%%').replace(/[\\"`$]/g, (char) => `\\${char}`);
  return `"${quoted.replace(/\\/g, '\\\\')}"`;
}

function desktopFileContents(appImagePath, { startedAtLogin = false } = {}) {
  const exec = `${quoteExecArgument(appImagePath)}${startedAtLogin ? ` ${STARTED_AT_LOGIN_ARG}` : ''}`;
  return [
    '[Desktop Entry]',
    'Type=Application',
    'Name=Token Monitor',
    `Exec=${exec}`,
    'X-GNOME-Autostart-enabled=true',
    ''
  ].join('\n');
}

function isAutostartEnabled(options) {
  const env = options?.env || process.env;
  if (!env.APPIMAGE) return false;
  try {
    const contents = fs.readFileSync(desktopFilePath({ env }), 'utf8');
    const execLine = contents.split(/\r?\n/).find((line) => line.startsWith('Exec='));
    const expected = `Exec=${quoteExecArgument(env.APPIMAGE)}`;
    return execLine === expected || execLine === `${expected} ${STARTED_AT_LOGIN_ARG}`;
  }
  catch (_) { return false; }
}

function setAutostartEnabled(enabled, options = {}) {
  const env = options.env || process.env;
  const filePath = desktopFilePath({ env });
  try {
    if (enabled) {
      if (!env.APPIMAGE) return false;
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, desktopFileContents(env.APPIMAGE, {
        startedAtLogin: Boolean(options.startedAtLogin)
      }), 'utf8');
    } else {
      fs.rmSync(filePath, { force: true });
    }
  } catch (_) { /* fall through to report the actual on-disk state */ }
  return isAutostartEnabled({ env });
}

function startedAtLoginFromArgs(argv = process.argv) {
  return Array.isArray(argv) && argv.some((arg) => String(arg) === STARTED_AT_LOGIN_ARG);
}

module.exports = {
  autostartSupported,
  desktopFilePath,
  desktopFileContents,
  isAutostartEnabled,
  setAutostartEnabled,
  startedAtLoginFromArgs,
  STARTED_AT_LOGIN_ARG
};
