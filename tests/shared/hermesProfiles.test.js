'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const {
  discoverHermesProfileScanPaths,
  mergeTokscaleExtraDirs,
  resolveHermesHome,
  tokscaleEnvFromSpawnArgs,
  tokscaleEnvWithHermesProfiles
} = require('../../src/shared/hermesProfiles');

test('resolveHermesHome prefers HERMES_HOME when set', () => {
  assert.equal(
    resolveHermesHome({ env: { HERMES_HOME: 'C:\\hermes-root' }, homeDir: 'C:\\Users\\u', platform: 'win32' }),
    'C:\\hermes-root'
  );
});

test('resolveHermesHome prefers home-relative .hermes before Windows LocalAppData', () => {
  const homeDir = 'C:\\Users\\u';
  const dotHermes = path.join(homeDir, '.hermes');
  const winNative = path.join(homeDir, 'AppData', 'Local', 'hermes');
  assert.equal(
    resolveHermesHome({
      env: {},
      homeDir,
      platform: 'win32',
      existsSync: (target) => target === path.join(dotHermes, 'state.db')
        || target === path.join(winNative, 'state.db')
    }),
    dotHermes
  );
});

test('resolveHermesHome falls back to Windows LocalAppData when native state.db exists', () => {
  const homeDir = 'C:\\Users\\u';
  const winNative = path.join(homeDir, 'AppData', 'Local', 'hermes');
  assert.equal(
    resolveHermesHome({
      env: {},
      homeDir,
      platform: 'win32',
      existsSync: (target) => target === path.join(winNative, 'state.db')
    }),
    winNative
  );
});

test('resolveHermesHome falls back to ~/.hermes on other platforms', () => {
  assert.equal(
    resolveHermesHome({ env: {}, homeDir: '/home/u', platform: 'linux' }),
    path.join('/home/u', '.hermes')
  );
});

test('discoverHermesProfileScanPaths returns profile dirs that contain state.db', () => {
  const hermesHome = '/home/u/.hermes';
  const paths = discoverHermesProfileScanPaths(hermesHome, {
    existsSync: (target) => {
      if (target === path.join(hermesHome, 'profiles')) return true;
      return target.endsWith(`${path.sep}lab-a${path.sep}state.db`)
        || target.endsWith(`${path.sep}research${path.sep}state.db`);
    },
    readdirSync: () => [
      { name: 'lab-a', isDirectory: () => true },
      { name: 'empty', isDirectory: () => true },
      { name: 'notes.txt', isDirectory: () => false },
      { name: 'research', isDirectory: () => true }
    ]
  });

  assert.deepEqual(paths, [
    path.join(hermesHome, 'profiles', 'lab-a'),
    path.join(hermesHome, 'profiles', 'research')
  ]);
});

test('tokscaleEnvWithHermesProfiles injects hermes profile dirs into TOKSCALE_EXTRA_DIRS', () => {
  const hermesHome = 'C:\\Users\\u\\AppData\\Local\\hermes';
  const env = tokscaleEnvWithHermesProfiles(
    { FOO: 'bar', TOKSCALE_EXTRA_DIRS: 'codex:C:\\extra' },
    'claude,hermes',
    {
      env: { HERMES_HOME: hermesHome },
      homeDir: 'C:\\Users\\u',
      platform: 'win32',
      existsSync: (target) => target.endsWith(`${path.sep}profiles`)
        || target.endsWith(`${path.sep}lab-a${path.sep}state.db`),
      readdirSync: () => [{ name: 'lab-a', isDirectory: () => true }]
    }
  );

  const profileDir = path.join(hermesHome, 'profiles', 'lab-a');
  assert.equal(env.FOO, 'bar');
  assert.equal(env.TOKSCALE_EXTRA_DIRS, `codex:C:\\extra,hermes:${profileDir}`);
});

test('tokscaleEnvWithHermesProfiles leaves env untouched when hermes is not enabled', () => {
  const base = { FOO: 'bar' };
  assert.equal(
    tokscaleEnvWithHermesProfiles(base, 'claude,codex', { env: {}, homeDir: '/home/u', platform: 'linux' }),
    base
  );
});

test('tokscaleEnvFromSpawnArgs reads --client from tokscale argv', () => {
  const hermesHome = path.join('/home/u', '.hermes');
  const profileDir = path.join(hermesHome, 'profiles', 'research');
  const env = tokscaleEnvFromSpawnArgs(
    {},
    ['--json', '--client', 'hermes', '--group-by', 'client,session,model'],
    {
      env: { HERMES_HOME: hermesHome },
      homeDir: '/home/u',
      platform: 'linux',
      existsSync: (target) => target === path.join(hermesHome, 'profiles')
        || target === path.join(profileDir, 'state.db'),
      readdirSync: () => [{ name: 'research', isDirectory: () => true }]
    }
  );

  assert.equal(env.TOKSCALE_EXTRA_DIRS, `hermes:${profileDir}`);
});

test('tokscaleEnvFromSpawnArgs skips injection for --home scans (tokscale ignores extra dirs there)', () => {
  const base = { FOO: 'bar' };
  const env = tokscaleEnvFromSpawnArgs(
    base,
    ['--json', '--client', 'hermes', '--group-by', 'client,model', '--home', '\\\\wsl$\\Ubuntu\\home\\u'],
    {
      env: { HERMES_HOME: path.join('/home/u', '.hermes') },
      homeDir: '/home/u',
      platform: 'linux',
      existsSync: () => true,
      readdirSync: () => [{ name: 'research', isDirectory: () => true }]
    }
  );

  assert.equal(env, base);
  assert.equal(env.TOKSCALE_EXTRA_DIRS, undefined);
});

test('mergeTokscaleExtraDirs appends without duplicating the env object fields', () => {
  const env = mergeTokscaleExtraDirs({ A: '1' }, ['hermes:/tmp/p1', 'hermes:/tmp/p2']);
  assert.equal(env.A, '1');
  assert.equal(env.TOKSCALE_EXTRA_DIRS, 'hermes:/tmp/p1,hermes:/tmp/p2');
});
