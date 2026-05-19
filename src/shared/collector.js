'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const chokidar = require('chokidar');
const { extractUsageFromTokscale } = require('./usage');

const TOKSCALE_BIN_JS = require.resolve('tokscale/bin.js');

function resolvePlatformBinary() {
  const binaryName = process.platform === 'win32' ? 'tokscale.exe' : 'tokscale';
  const candidates = [];
  if (process.platform === 'darwin') {
    if (process.arch === 'arm64') candidates.push('@tokscale/cli-darwin-arm64');
    if (process.arch === 'x64') candidates.push('@tokscale/cli-darwin-x64');
  } else if (process.platform === 'win32') {
    if (process.arch === 'arm64') candidates.push('@tokscale/cli-win32-arm64-msvc');
    if (process.arch === 'x64') candidates.push('@tokscale/cli-win32-x64-msvc');
  } else if (process.platform === 'linux') {
    if (process.arch === 'arm64') candidates.push('@tokscale/cli-linux-arm64-gnu', '@tokscale/cli-linux-arm64-musl');
    if (process.arch === 'x64') candidates.push('@tokscale/cli-linux-x64-gnu', '@tokscale/cli-linux-x64-musl');
  }
  for (const pkg of candidates) {
    try {
      const pkgPath = require.resolve(`${pkg}/package.json`);
      const binPath = path.join(path.dirname(pkgPath), 'bin', binaryName);
      if (fs.existsSync(binPath)) return binPath;
    } catch (_) {}
  }
  return null;
}
const TOKSCALE_PLATFORM_BIN = resolvePlatformBinary();

function parseJsonOutput(stdout) {
  const text = String(stdout || '').trim();
  if (!text) throw new Error('tokscale produced empty stdout');
  try { return JSON.parse(text); } catch (_) {
    const starts = [text.indexOf('{'), text.indexOf('[')].filter((value) => value >= 0).sort((a, b) => a - b);
    for (const start of starts) {
      try { return JSON.parse(text.slice(start)); } catch (_inner) {}
    }
  }
  throw new Error(`Could not parse tokscale JSON output: ${text.slice(0, 300)}`);
}

function runTokscale({ clients, flags, commandTimeoutMs }) {
  const userArgs = ['--json', '--client', clients, '--group-by', 'client,model', ...flags];
  const useDirect = Boolean(TOKSCALE_PLATFORM_BIN);
  const bin = useDirect ? TOKSCALE_PLATFORM_BIN : process.execPath;
  const args = useDirect ? userArgs : [TOKSCALE_BIN_JS, ...userArgs];
  const spawnOpts = useDirect
    ? { windowsHide: true }
    : { windowsHide: true, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } };
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, spawnOpts);
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => { child.kill('SIGTERM'); reject(new Error(`tokscale timed out after ${commandTimeoutMs}ms`)); }, commandTimeoutMs);
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => { clearTimeout(timeout); reject(error); });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) return reject(new Error(`tokscale exited with code ${code}: ${stderr.trim() || stdout.trim()}`));
      try { resolve(parseJsonOutput(stdout)); } catch (error) { reject(error); }
    });
  });
}

async function collectUsageOnce(options) {
  const { clients, allTimeSince, commandTimeoutMs, deviceId, agentVersion = '0.1.0' } = options;
  const todayJson = await runTokscale({ clients, flags: ['--today'], commandTimeoutMs });
  const monthJson = await runTokscale({ clients, flags: ['--month'], commandTimeoutMs });
  const allTimeJson = await runTokscale({ clients, flags: ['--since', allTimeSince], commandTimeoutMs });
  return {
    deviceId,
    hostname: os.hostname(),
    platform: `${process.platform}-${process.arch}`,
    updatedAt: new Date().toISOString(),
    agentVersion,
    today: extractUsageFromTokscale(todayJson),
    month: extractUsageFromTokscale(monthJson),
    allTime: extractUsageFromTokscale(allTimeJson)
  };
}

function watchPathsForClients(clientsCsv) {
  const home = os.homedir();
  const enabled = new Set(String(clientsCsv || '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean));
  const candidates = [];
  if (enabled.has('claude')) {
    candidates.push(path.join(home, '.claude', 'projects'));
    candidates.push(path.join(home, '.claude', 'transcripts'));
  }
  if (enabled.has('codex')) {
    candidates.push(path.join(home, '.codex', 'sessions'));
  }
  if (enabled.has('hermes')) {
    candidates.push(process.env.HERMES_HOME || path.join(home, '.hermes'));
  }
  return candidates.filter((candidate) => { try { return fs.statSync(candidate).isDirectory(); } catch (_) { return false; } });
}

function startCollector(options) {
  const {
    clients, allTimeSince, commandTimeoutMs, deviceId, agentVersion,
    intervalMs, watchEnabled, watchDebounceMs,
    onUpdate, onError, logger
  } = options;
  const log = logger || (() => {});
  let tickInFlight = false;
  let tickPending = false;
  let debounceTimer = null;
  let intervalTimer = null;
  let stopped = false;
  const watchers = [];

  async function performTick(reason) {
    try {
      const summary = await collectUsageOnce({ clients, allTimeSince, commandTimeoutMs, deviceId, agentVersion });
      if (stopped) return;
      onUpdate?.(summary, reason);
    } catch (error) {
      if (stopped) return;
      if (onError) onError(error, reason); else log(`collector tick failed (${reason}): ${error.message}`);
    }
  }

  async function runTick(reason) {
    if (tickInFlight) { tickPending = true; return; }
    tickInFlight = true;
    await performTick(reason);
    tickInFlight = false;
    if (tickPending && !stopped) {
      tickPending = false;
      setImmediate(() => runTick('coalesced'));
    }
  }

  function scheduleTick(reason) {
    if (stopped) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => { debounceTimer = null; runTick(reason); }, watchDebounceMs);
  }

  function setupWatchers() {
    if (!watchEnabled) return;
    const dirs = watchPathsForClients(clients);
    if (dirs.length === 0) {
      log('No watchable client data directories found; relying on fallback interval only.');
      return;
    }
    try {
      const watcher = chokidar.watch(dirs, {
        ignoreInitial: true,
        persistent: true,
        usePolling: true,
        interval: 2000,
        binaryInterval: 5000,
        awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 200 }
      });
      watcher.on('all', (event, filePath) => scheduleTick(`watch:${event}:${path.basename(filePath || '')}`));
      watcher.on('error', (error) => log(`chokidar error: ${error.message}`));
      watchers.push(watcher);
      for (const dir of dirs) log(`Watching ${dir} (polling 2s)`);
    } catch (error) {
      log(`Cannot watch ${dirs.join(', ')}: ${error.message}`);
    }
  }

  function loop() {
    if (stopped) return;
    runTick('interval').finally(() => {
      if (stopped) return;
      intervalTimer = setTimeout(loop, intervalMs);
    });
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
    if (intervalTimer) { clearTimeout(intervalTimer); intervalTimer = null; }
    for (const watcher of watchers) {
      try { watcher.close(); } catch (_) {}
    }
    watchers.length = 0;
  }

  setupWatchers();
  loop();

  return { stop, tick: (reason = 'manual') => runTick(reason) };
}

module.exports = { collectUsageOnce, startCollector, watchPathsForClients };
