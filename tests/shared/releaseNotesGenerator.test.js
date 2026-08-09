'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  parseCommitSubject,
  renderReleaseBody
} = require('../../scripts/generate-release-notes');

const workflowPath = path.join(__dirname, '..', '..', '.github', 'workflows', 'release.yml');

const template = `# English

## What's changed

<!-- app-update-notes:en:start -->
### Fixed
- Old release note.
<!-- app-update-notes:en:end -->

## 更新内容

<!-- app-update-notes:zh:start -->
### 修复
- 旧版本说明。
<!-- app-update-notes:zh:end -->
`;

test('release note generator classifies user-facing commits and replaces both locales', () => {
  const body = renderReleaseBody(template, {
    version: '0.38.0',
    commits: [
      'feat(settings): add a Windows-safe recovery hint',
      'fix(renderer): restore settings section interactions',
      'perf(collector): reduce duplicate scans',
      'docs: update the README',
      'chore(release): prepare version 0.38.0',
      'fix(renderer): restore settings section interactions'
    ]
  });

  assert.doesNotMatch(body, /Old release note|旧版本说明/);
  assert.match(body, /### Added\n- \*\*settings:\*\* add a Windows-safe recovery hint/);
  assert.match(body, /### Fixed\n- \*\*renderer:\*\* restore settings section interactions/);
  assert.match(body, /### 改进\n- \*\*采集器:\*\* reduce duplicate scans/);
  assert.match(body, /### 新增\n- \*\*设置:\*\* add a Windows-safe recovery hint/);
  assert.ok(body.indexOf('### Added') < body.indexOf('### Fixed'));
  assert.equal((body.match(/restore settings section interactions/g) || []).length, 2);
});

test('release note generator has a version-specific fallback for maintenance releases', () => {
  const body = renderReleaseBody(template, { version: '0.38.1', commits: ['docs: only documentation'] });
  assert.match(body, /Maintenance updates for v0\.38\.1\./);
  assert.match(body, /### 修复\n- \*\*发布流程:\*\* Maintenance updates for v0\.38\.1\./);
});

test('commit parser ignores internal maintenance commits', () => {
  assert.equal(parseCommitSubject('chore(release): prepare version 0.38.0'), null);
  assert.equal(parseCommitSubject('docs: update README'), null);
  assert.deepEqual(parseCommitSubject('fix(windows): restore settings'), {
    category: 'Fixed',
    scope: 'windows',
    summary: 'restore settings'
  });
});

test('release workflow renders notes from the version commit range', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /fetch-depth:\s*0/);
  assert.match(workflow, /scripts\/generate-release-notes\.js/);
  assert.match(workflow, /--output release-body\.md/);
  assert.doesNotMatch(workflow, /cat \.github\/RELEASE_TEMPLATE\.md/);
});
