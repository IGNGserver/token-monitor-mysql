'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { collectCustomRangeOnce } = require('../../src/shared/collector');

test('collectCustomRangeOnce filters tokscale rows by decorated timestamps', async () => {
  const result = await collectCustomRangeOnce({
    clients: 'codex',
    range: {
      startDate: '2026-07-24',
      endDate: '2026-07-24',
      startHour: 0,
      endHour: 23
    },
    commandTimeoutMs: 1000,
    projectsEnabled: false,
    runTokscale: async () => ({
      entries: [
        {
          client: 'codex',
          sessionId: 's1',
          model: 'gpt-5',
          input: 10,
          output: 5,
          cacheRead: 0,
          cacheWrite: 0,
          cost: 0.1,
          startedAt: '2026-07-24T03:00:00.000Z',
          lastUsedAt: '2026-07-24T04:00:00.000Z'
        }
      ]
    }),
    sessionMetadataDeps: {
      // prevent filesystem lookups
      findSessionFiles: () => [],
      sessionTimestampMap: () => new Map()
    },
    homeDir: process.cwd()
  });

  assert.equal(result.range.startDate, '2026-07-24');
  assert.ok(result.period);
  assert.equal(result.period.totalTokens > 0, true);
});
