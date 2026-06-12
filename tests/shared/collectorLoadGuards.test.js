'use strict';

// Guards against the runaway-collection loop from issue #15: watching our own
// sync-cache dirs re-triggered ticks forever, and each tick spawned concurrent
// tokscale scans plus an unconditional antigravity sync.

const assert = require('node:assert/strict');
const test = require('node:test');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const collectorPath = require.resolve('../../src/shared/collector');

function freshCollector() {
  delete require.cache[collectorPath];
  return require(collectorPath);
}

function withTmpHome(prepare) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'token-monitor-home-'));
  for (const dir of prepare) fs.mkdirSync(path.join(tmp, dir), { recursive: true });
  return tmp;
}

function recordingSpawn(calls) {
  return (_bin, args) => {
    calls.push(args);
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { end: () => {} };
    child.kill = () => {};
    setImmediate(() => {
      child.stdout.emit('data', Buffer.from(JSON.stringify({ entries: [] })));
      child.emit('close', 0);
    });
    return child;
  };
}

test('watchPathsForClients excludes the tokscale cache dirs our own syncs write', () => {
  const tmp = withTmpHome([
    path.join('.claude', 'projects'),
    path.join('.config', 'tokscale', 'cursor-cache'),
    path.join('.config', 'tokscale', 'antigravity-cache')
  ]);
  const originalHomedir = os.homedir;
  os.homedir = () => tmp;
  try {
    const { watchPathsForClients } = freshCollector();
    const dirs = watchPathsForClients('claude,cursor,antigravity');
    assert.ok(dirs.includes(path.join(tmp, '.claude', 'projects')));
    assert.equal(dirs.filter((dir) => dir.includes(path.join('.config', 'tokscale'))).length, 0);
  } finally {
    os.homedir = originalHomedir;
    delete require.cache[collectorPath];
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('clientDataDirPresence still detects cursor/antigravity via their cache dirs', () => {
  const tmp = withTmpHome([
    path.join('.config', 'tokscale', 'cursor-cache'),
    path.join('.config', 'tokscale', 'antigravity-cache')
  ]);
  const originalHomedir = os.homedir;
  os.homedir = () => tmp;
  try {
    const { clientDataDirPresence } = freshCollector();
    const presence = clientDataDirPresence('cursor,antigravity');
    assert.equal(presence.cursor, true);
    assert.equal(presence.antigravity, true);
  } finally {
    os.homedir = originalHomedir;
    delete require.cache[collectorPath];
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('collectUsageOnce skips antigravity sync when no antigravity data root exists', async () => {
  const tmp = withTmpHome([]);
  const childProcess = require('node:child_process');
  const originalSpawn = childProcess.spawn;
  const calls = [];
  childProcess.spawn = recordingSpawn(calls);
  try {
    const { collectUsageOnce } = freshCollector();
    await collectUsageOnce({
      clients: 'antigravity',
      allTimeSince: '2024-01-01',
      commandTimeoutMs: 1000,
      deviceId: 'test-device',
      agentVersion: 'test',
      limitsEnabled: false,
      homeDir: tmp
    });
    assert.equal(calls.filter((args) => args.includes('sync')).length, 0);
  } finally {
    childProcess.spawn = originalSpawn;
    delete require.cache[collectorPath];
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('antigravity sync runs at most once per throttle window across ticks', async () => {
  const tmp = withTmpHome([path.join('.gemini', 'antigravity')]);
  const childProcess = require('node:child_process');
  const originalSpawn = childProcess.spawn;
  const calls = [];
  childProcess.spawn = recordingSpawn(calls);
  try {
    const { collectUsageOnce } = freshCollector();
    const options = {
      clients: 'antigravity',
      allTimeSince: '2024-01-01',
      commandTimeoutMs: 1000,
      deviceId: 'test-device',
      agentVersion: 'test',
      limitsEnabled: false,
      homeDir: tmp
    };
    await collectUsageOnce(options);
    await collectUsageOnce(options);
    assert.equal(calls.filter((args) => args.includes('sync')).length, 1);
  } finally {
    childProcess.spawn = originalSpawn;
    delete require.cache[collectorPath];
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('cursor sync runs at most once per throttle window across ticks', async () => {
  const childProcess = require('node:child_process');
  const originalSpawn = childProcess.spawn;
  childProcess.spawn = recordingSpawn([]);
  const cursorAuth = require('../../src/shared/cursorAuth');
  const originalReadActiveAccount = cursorAuth.readActiveAccount;
  const originalRunCursorSync = cursorAuth.runCursorSync;
  let syncCalls = 0;
  cursorAuth.readActiveAccount = () => ({ accessToken: 'token' });
  cursorAuth.runCursorSync = async () => { syncCalls += 1; };
  try {
    const { collectUsageOnce } = freshCollector();
    const options = {
      clients: 'cursor',
      allTimeSince: '2024-01-01',
      commandTimeoutMs: 1000,
      deviceId: 'test-device',
      agentVersion: 'test',
      limitsEnabled: false
    };
    await collectUsageOnce(options);
    await collectUsageOnce(options);
    assert.equal(syncCalls, 1);
  } finally {
    childProcess.spawn = originalSpawn;
    cursorAuth.readActiveAccount = originalReadActiveAccount;
    cursorAuth.runCursorSync = originalRunCursorSync;
    delete require.cache[collectorPath];
  }
});

test('collectUsageOnce runs the three tokscale scans serially, not concurrently', async () => {
  const childProcess = require('node:child_process');
  const originalSpawn = childProcess.spawn;
  let active = 0;
  let maxActive = 0;
  childProcess.spawn = () => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { end: () => {} };
    child.kill = () => {};
    setImmediate(() => {
      child.stdout.emit('data', Buffer.from(JSON.stringify({ entries: [] })));
      active -= 1;
      child.emit('close', 0);
    });
    return child;
  };
  try {
    const { collectUsageOnce } = freshCollector();
    await collectUsageOnce({
      clients: 'claude',
      allTimeSince: '2024-01-01',
      commandTimeoutMs: 1000,
      deviceId: 'test-device',
      agentVersion: 'test',
      limitsEnabled: false
    });
    assert.equal(maxActive, 1);
  } finally {
    childProcess.spawn = originalSpawn;
    delete require.cache[collectorPath];
  }
});

test('collector exposes no watch-cooldown knob (refresh cadence is debounce-only)', () => {
  const collector = freshCollector();
  assert.equal(collector.watchDelayMs, undefined);
});
