'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  CLIENT_ID,
  buildClaudeDesktopHistoryGraph,
  buildClaudeDesktopPeriods,
  buildClaudeDesktopRangeJson,
  buildTokscaleJson,
  collectClaudeDesktopRows,
  discoverDesktopAppRoots,
  resolveClaudeDesktopSessionFile
} = require('../../src/shared/claudeDesktopUsage');
const { extractUsageFromTokscale, normalizeClientName } = require('../../src/shared/usage');

function writeJsonl(filePath, rows) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`);
}

function assistantRow({ id, model = 'claude-sonnet-5', createdAt, input = 0, output = 0, cacheRead = 0, cacheWrite = 0 }) {
  return {
    type: 'assistant',
    timestamp: createdAt,
    message: {
      id,
      model,
      usage: {
        input_tokens: input,
        output_tokens: output,
        cache_read_input_tokens: cacheRead,
        cache_creation_input_tokens: cacheWrite
      }
    }
  };
}

function makeDesktopFixture(root) {
  const sessionHome = path.join(root, 'Claude-3p', 'local-agent-mode-sessions', 'acct', '0000', 'local_demo');
  const projects = path.join(sessionHome, '.claude', 'projects', 'workspace');
  const sessionFile = path.join(projects, 'sess-alpha.jsonl');
  fs.mkdirSync(projects, { recursive: true });
  fs.writeFileSync(`${sessionHome}.json`, JSON.stringify({
    sessionId: 'local_demo',
    cliSessionId: 'sess-alpha',
    title: 'Compression tool development',
    userSelectedFolders: [],
    model: 'claude-sonnet-5'
  }));
  // audit and non-project noise should be ignored
  writeJsonl(path.join(sessionHome, 'audit.jsonl'), [
    assistantRow({ id: 'audit-noise', createdAt: '2026-07-09T12:00:00.000Z', input: 999 })
  ]);
  return { sessionHome, sessionFile, projects };
}

test('normalizeClientName keeps claude-desktop separate from claude', () => {
  assert.equal(normalizeClientName('claude-desktop'), 'claude-desktop');
  assert.equal(normalizeClientName('Claude Desktop'), 'claude-desktop');
  assert.equal(normalizeClientName('claude'), 'claude');
  assert.equal(normalizeClientName('Claude Code'), 'claude');
});

test('Claude Desktop daily window filters messages before per-model aggregation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-desktop-usage-'));
  const { sessionFile } = makeDesktopFixture(root);
  const yesterday = '2026-07-08T23:50:00.000Z';
  const today = '2026-07-09T00:05:00.000Z';
  const todayStart = Date.parse('2026-07-09T00:00:00.000Z');

  writeJsonl(sessionFile, [
    assistantRow({ id: 'old-message', createdAt: yesterday, input: 100, output: 1 }),
    assistantRow({ id: 'today-message', createdAt: today, input: 40, output: 3, cacheRead: 2 })
  ]);

  const rows = collectClaudeDesktopRows({
    homeDir: root,
    platform: 'win32',
    env: { LOCALAPPDATA: root }
  });
  const todayUsage = extractUsageFromTokscale(buildTokscaleJson({ todayStart }, { rows }));
  assert.equal(todayUsage.clients[CLIENT_ID], 45);
  assert.equal(todayUsage.models['claude-sonnet-5'], 45);
  assert.equal(todayUsage.sessions[`${CLIENT_ID}:sess-alpha`].projectLabel, 'Compression tool development');
});

test('Claude Desktop collapses streamed chunks by max usage but keeps the latest message time', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-desktop-usage-'));
  const { sessionFile } = makeDesktopFixture(root);
  const beforeToday = '2026-07-08T23:59:00.000Z';
  const afterToday = '2026-07-09T00:00:02.000Z';
  const todayStart = Date.parse('2026-07-09T00:00:00.000Z');

  writeJsonl(sessionFile, [
    assistantRow({ id: 'streamed-message', createdAt: beforeToday, input: 100 }),
    assistantRow({ id: 'streamed-message', createdAt: afterToday, input: 20 })
  ]);

  const rows = collectClaudeDesktopRows({ homeDir: root, platform: 'win32', env: { LOCALAPPDATA: root } });
  const usage = extractUsageFromTokscale(buildTokscaleJson({ todayStart }, { rows }));
  assert.equal(usage.clients[CLIENT_ID], 100);
});

test('Claude Desktop periods read each session file once before deriving all windows', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-desktop-usage-'));
  const { sessionFile } = makeDesktopFixture(root);
  writeJsonl(sessionFile, [assistantRow({ id: 'message', createdAt: '2026-07-09T12:00:00.000Z', input: 10 })]);
  const originalReadFileSync = fs.readFileSync;
  let reads = 0;
  fs.readFileSync = (...args) => {
    if (args[0] === sessionFile) reads += 1;
    return originalReadFileSync(...args);
  };
  try {
    const rows = collectClaudeDesktopRows({ homeDir: root, platform: 'win32', env: { LOCALAPPDATA: root } });
    const periods = buildClaudeDesktopPeriods({
      now: '2026-07-09T13:00:00.000Z',
      allTimeSince: '2026-01-01',
      rows
    });
    assert.equal(reads, 1);
    assert.equal(extractUsageFromTokscale(periods.today).totalTokens, 10);
    assert.equal(extractUsageFromTokscale(periods.month).totalTokens, 10);
    assert.equal(extractUsageFromTokscale(periods.allTime).totalTokens, 10);
  } finally {
    fs.readFileSync = originalReadFileSync;
  }
});

test('Claude Desktop all-time window honors the configured cutoff', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-desktop-usage-'));
  const { sessionFile } = makeDesktopFixture(root);
  writeJsonl(sessionFile, [
    assistantRow({ id: 'before-cutoff', createdAt: '2025-01-01T00:00:00.000Z', input: 100 }),
    assistantRow({ id: 'after-cutoff', createdAt: '2026-02-01T00:00:00.000Z', input: 40, output: 2 })
  ]);
  const rows = collectClaudeDesktopRows({ homeDir: root, platform: 'win32', env: { LOCALAPPDATA: root } });
  const periods = buildClaudeDesktopPeriods({
    now: '2026-07-09T12:00:00.000Z',
    allTimeSince: '2026-01-01',
    rows
  });
  assert.equal(extractUsageFromTokscale(periods.allTime).clients[CLIENT_ID], 42);
});

test('Claude Desktop custom range filters by message timestamps', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-desktop-usage-'));
  const { sessionFile } = makeDesktopFixture(root);
  writeJsonl(sessionFile, [
    assistantRow({ id: 'early', createdAt: '2026-07-01T10:00:00.000Z', input: 10 }),
    assistantRow({ id: 'mid', createdAt: '2026-07-05T10:00:00.000Z', input: 20 }),
    assistantRow({ id: 'late', createdAt: '2026-07-10T10:00:00.000Z', input: 40 })
  ]);
  const rows = collectClaudeDesktopRows({ homeDir: root, platform: 'win32', env: { LOCALAPPDATA: root } });
  const rangeJson = buildClaudeDesktopRangeJson({
    startMs: Date.parse('2026-07-05T00:00:00.000Z'),
    endMs: Date.parse('2026-07-05T23:59:59.999Z')
  }, { rows });
  assert.equal(extractUsageFromTokscale(rangeJson).totalTokens, 20);
});

test('Claude Desktop history graph attributes to claude-desktop client id', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-desktop-usage-'));
  const { sessionFile } = makeDesktopFixture(root);
  writeJsonl(sessionFile, [
    assistantRow({ id: 'a', createdAt: '2026-07-09T12:00:00.000Z', input: 5, output: 1 })
  ]);
  const rows = collectClaudeDesktopRows({ homeDir: root, platform: 'win32', env: { LOCALAPPDATA: root } });
  const graph = buildClaudeDesktopHistoryGraph({ rows });
  assert.equal(graph.contributions[0].clients[0].client, CLIENT_ID);
  assert.equal(graph.contributions[0].clients[0].tokens.input, 5);
});

test('resolveClaudeDesktopSessionFile finds transcripts under desktop roots', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-desktop-usage-'));
  const { sessionFile } = makeDesktopFixture(root);
  writeJsonl(sessionFile, [assistantRow({ id: 'a', createdAt: '2026-07-09T12:00:00.000Z', input: 1 })]);
  const resolved = resolveClaudeDesktopSessionFile('sess-alpha', {
    homeDir: root,
    platform: 'win32',
    env: { LOCALAPPDATA: root }
  });
  assert.equal(resolved, sessionFile);
  assert.equal(resolveClaudeDesktopSessionFile('sess-alpha@deadbeef', {
    homeDir: root,
    platform: 'win32',
    env: { LOCALAPPDATA: root }
  }), sessionFile);
});

test('discoverDesktopAppRoots only returns existing dirs', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-desktop-roots-'));
  fs.mkdirSync(path.join(root, 'Claude-3p'), { recursive: true });
  const found = discoverDesktopAppRoots({ homeDir: root, platform: 'win32', env: { LOCALAPPDATA: root } });
  assert.deepEqual(found, [path.join(root, 'Claude-3p')]);
});
