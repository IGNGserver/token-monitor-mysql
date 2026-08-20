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

const template = `# 更新内容

<!-- app-update-notes:zh:start -->
### 修复
- 旧版本说明。
<!-- app-update-notes:zh:end -->

## 下载

- **macOS Apple Silicon** — [Token-Monitor-0.37.0-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.37.0/Token-Monitor-0.37.0-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.37.0-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.37.0/Token-Monitor-0.37.0-x64.dmg)
- **Windows 安装版** — [Token-Monitor-Setup-0.37.0.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.37.0/Token-Monitor-Setup-0.37.0.exe)（推荐）
- **Windows 便携版** — [Token-Monitor-0.37.0.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.37.0/Token-Monitor-0.37.0.exe)（免安装）
- **Linux x64** — [Token-Monitor-0.37.0.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.37.0/Token-Monitor-0.37.0.AppImage)

---

<details>
<summary><strong>Full Changelog:</strong> <a href="https://github.com/IGNGserver/token-monitor-suite/compare/v0.36.0...v0.37.0">v0.36.0...v0.37.0</a></summary>

<!-- github-generated-release-notes -->

</details>
`;

test('release note generator classifies user-facing commits into Chinese categories and updates links', () => {
  const body = renderReleaseBody(template, {
    version: '0.38.0',
    previousTag: 'v0.37.0',
    commits: [
      'feat(settings): add a Windows-safe recovery hint',
      'fix(renderer): restore settings section interactions',
      'perf(collector): reduce duplicate scans',
      'docs: update the README',
      'chore(release): prepare version 0.38.0',
      'fix(renderer): restore settings section interactions',
      '【新增】(desktop) 支持窗口置顶快捷键',
      '优化(hub): 降低高频 SSE 广播开销'
    ]
  });

  assert.doesNotMatch(body, /旧版本说明/);
  assert.match(body, /### 新增\n- \*\*设置:\*\* add a Windows-safe recovery hint\n- \*\*桌面端:\*\* 支持窗口置顶快捷键/);
  assert.match(body, /### 改进\n- \*\*采集器:\*\* reduce duplicate scans\n- \*\*Hub:\*\* 降低高频 SSE 广播开销/);
  assert.match(body, /### 修复\n- \*\*界面:\*\* restore settings section interactions/);
  assert.ok(body.indexOf('### 新增') < body.indexOf('### 改进'));
  assert.ok(body.indexOf('### 改进') < body.indexOf('### 修复'));
  assert.equal((body.match(/restore settings section interactions/g) || []).length, 1);
  assert.match(body, /Token-Monitor-0\.38\.0-arm64\.dmg/);
  assert.match(body, /Token-Monitor-Setup-0\.38\.0\.exe/);
  assert.match(body, /compare\/v0\.37\.0\.\.\.v0\.38\.0/);
});

test('release note generator has a Chinese version-specific fallback for maintenance releases', () => {
  const body = renderReleaseBody(template, { version: '0.38.1', commits: ['docs: only documentation'] });
  assert.match(body, /### 修复\n- \*\*发布流程:\*\* v0\.38\.1 稳定性优化与常规维护更新。/);
});

test('commit parser classifies conventional and Chinese commits properly', () => {
  assert.equal(parseCommitSubject('chore(release): prepare version 0.38.0'), null);
  assert.equal(parseCommitSubject('docs: update README'), null);
  assert.deepEqual(parseCommitSubject('fix(windows): restore settings'), {
    category: 'Fixed',
    scope: 'windows',
    summary: 'restore settings'
  });
  assert.deepEqual(parseCommitSubject('【新增】(tray): 支持托盘快速切换模式 (#123)'), {
    category: 'Added',
    scope: 'tray',
    summary: '支持托盘快速切换模式'
  });
  assert.deepEqual(parseCommitSubject('优化: 提升大历史记录加载速度'), {
    category: 'Improved',
    scope: '',
    summary: '提升大历史记录加载速度'
  });
});

test('release workflow renders notes from the version commit range', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /fetch-depth:\s*0/);
  assert.match(workflow, /scripts\/generate-release-notes\.js/);
  assert.match(workflow, /--output release-body\.md/);
  assert.doesNotMatch(workflow, /cat \.github\/RELEASE_TEMPLATE\.md/);
});
