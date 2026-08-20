'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const CATEGORY_ORDER = ['Added', 'Changed', 'Improved', 'Fixed'];
const CATEGORY_ZH = Object.freeze({
  Added: '新增',
  Changed: '变更',
  Improved: '改进',
  Fixed: '修复'
});

const SCOPE_ZH = Object.freeze({
  agent: '采集端',
  android: 'Android',
  api: 'API 接口',
  auth: '身份验证',
  chart: '图表',
  charts: '图表',
  client: '客户端',
  clients: '客户端',
  collector: '采集器',
  compose: 'Docker Compose',
  config: '配置管理',
  cost: '费用计算',
  credential: '凭据存储',
  credentials: '凭据存储',
  dashboard: '仪表盘',
  desktop: '桌面端',
  discord: 'Discord RPC',
  docker: 'Docker',
  docs: '文档',
  electron: '桌面端',
  history: '用量历史',
  hub: 'Hub',
  i18n: '国际化',
  limits: '用量限制',
  linux: 'Linux',
  mac: 'macOS',
  macos: 'macOS',
  model: '模型',
  models: '模型',
  provider: '提供商',
  providers: '提供商',
  pwa: 'PWA',
  release: '发布流程',
  renderer: '界面',
  rpc: 'Discord RPC',
  session: '会话追踪',
  sessions: '会话追踪',
  settings: '设置',
  store: '凭据存储',
  sync: '同步',
  theme: '主题外观',
  token: 'Token 统计',
  tray: '托盘',
  ui: '界面',
  updater: '更新器',
  widget: '桌面小部件',
  win: 'Windows',
  windows: 'Windows',
  worker: 'Worker',
  wsl: 'WSL'
});

const IGNORED_TYPES = new Set(['build', 'ci', 'test']);
const START_MARKERS = Object.freeze({
  en: '<!-- app-update-notes:en:start -->',
  zh: '<!-- app-update-notes:zh:start -->'
});
const END_MARKERS = Object.freeze({
  en: '<!-- app-update-notes:en:end -->',
  zh: '<!-- app-update-notes:zh:end -->'
});

function cleanSummary(raw) {
  return String(raw || '')
    .trim()
    .replace(/(?:[（(]#\d+(?:[、,]\s*#\d+)*[）)])$/, '')
    .replace(/[。.]+$/, '')
    .trim();
}

function parseCommitSubject(subject) {
  const text = String(subject || '').trim();
  if (!text || /^merge\b/i.test(text)) return null;

  // 1. Skip release bump commits
  if (/^(?:chore(?:\([^)]*\))?:?\s*)?(?:release|prepare version)\b/i.test(text)) return null;
  if (/^v?\d+\.\d+\.\d+/i.test(text) && !/^(?:feat|fix|perf|refactor)/i.test(text)) return null;

  // 2. Bracket style: 【新增】/【修复】/【优化】/【改进】/【变更】/【调整】or [新增]...
  const bracketMatch = /^[【[](?:(?<type>新增|修复|优化|改进|变更|调整|feat|fix|perf|refactor|revert)[】\]])\s*(?:\((?<scope>[^)]+)\)|（(?<scopeZh>[^）]+)）)?\s*(?::|：)?\s*(?<summary>.+)$/i.exec(text);
  if (bracketMatch) {
    const rawType = bracketMatch.groups.type.toLowerCase();
    let category = 'Changed';
    if (rawType === '新增' || rawType === 'feat') category = 'Added';
    else if (rawType === '修复' || rawType === 'fix') category = 'Fixed';
    else if (rawType === '优化' || rawType === '改进' || rawType === 'perf' || rawType === 'refactor' || rawType === 'revert') category = 'Improved';
    const scope = (bracketMatch.groups.scope || bracketMatch.groups.scopeZh || '').trim();
    const summary = cleanSummary(bracketMatch.groups.summary);
    if (!summary) return null;
    return { category, scope, summary };
  }

  // 3. Chinese prefix: 新增/修复/优化/改进/变更/调整 (with or without scope)
  const zhPrefixMatch = /^(?<type>新增|修复|优化|改进|变更|调整)(?:\((?<scope>[^)]+)\)|（(?<scopeZh>[^）]+)）)?\s*(?::|：)\s*(?<summary>.+)$/i.exec(text);
  if (zhPrefixMatch) {
    const rawType = zhPrefixMatch.groups.type;
    let category = 'Changed';
    if (rawType === '新增') category = 'Added';
    else if (rawType === '修复') category = 'Fixed';
    else if (rawType === '优化' || rawType === '改进') category = 'Improved';
    const scope = (zhPrefixMatch.groups.scope || zhPrefixMatch.groups.scopeZh || '').trim();
    const summary = cleanSummary(zhPrefixMatch.groups.summary);
    if (!summary) return null;
    return { category, scope, summary };
  }

  // 4. Conventional commits: type(scope)!: summary or type: summary
  const match = /^(?<type>[a-z]+)(?:\((?<scope>[^)]+)\))?(?<breaking>!)?\s*(?::|：)\s*(?<summary>.+)$/i.exec(text);
  if (match) {
    const type = match.groups.type.toLowerCase();
    if (IGNORED_TYPES.has(type) || /^(?:release|prepare version)\b/i.test(match.groups.summary)) return null;
    if (type === 'docs' || type === 'style') return null;
    if (type === 'chore' && !/^(?:add|support|implement|fix|resolve|optimize|improve|upgrade|migrate|restore)\b/i.test(match.groups.summary)) return null;

    let category;
    if (match.groups.breaking) category = 'Changed';
    else if (type === 'feat') category = 'Added';
    else if (type === 'fix') category = 'Fixed';
    else if (type === 'perf' || type === 'refactor' || type === 'revert') category = 'Improved';
    else if (type === 'chore') category = 'Changed';
    else return null;

    const summary = cleanSummary(match.groups.summary);
    if (!summary) return null;
    return {
      category,
      scope: String(match.groups.scope || '').trim(),
      summary
    };
  }

  // 5. Natural start verbs in English or Chinese
  const trimmed = text.trim();
  if (/^(?:add|support|implement|新增|支持|添加)\b/i.test(trimmed)) {
    return { category: 'Added', scope: '', summary: cleanSummary(trimmed) };
  }
  if (/^(?:fix|resolve|prevent|修复|解决)\b/i.test(trimmed)) {
    return { category: 'Fixed', scope: '', summary: cleanSummary(trimmed) };
  }
  if (/^(?:improve|optimize|enhance|speed up|reduce|refactor|优化|改进|提升|加速)\b/i.test(trimmed)) {
    return { category: 'Improved', scope: '', summary: cleanSummary(trimmed) };
  }
  if (/^(?:update|change|migrate|upgrade|adjust|restore|更新|调整|重构|回退)\b/i.test(trimmed)) {
    return { category: 'Changed', scope: '', summary: cleanSummary(trimmed) };
  }

  return null;
}

function normalizeCommit(commit) {
  if (typeof commit === 'string') return parseCommitSubject(commit);
  if (!commit || typeof commit !== 'object') return null;
  if (commit.category && CATEGORY_ORDER.includes(commit.category) && commit.summary) {
    return {
      category: commit.category,
      scope: String(commit.scope || '').trim(),
      summary: cleanSummary(commit.summary)
    };
  }
  return parseCommitSubject(commit.subject || commit.message || '');
}

function scopeLabel(scope, locale = 'zh') {
  const value = String(scope || '').trim();
  if (!value) return '';
  if (locale === 'zh') return SCOPE_ZH[value.toLowerCase()] || value;
  return value;
}

function releaseNoteBullet(commit, locale = 'zh') {
  const scope = scopeLabel(commit.scope, locale);
  return scope ? `- **${scope}:** ${commit.summary}` : `- ${commit.summary}`;
}

function collectReleaseNoteGroups(commits, version) {
  const groups = new Map(CATEGORY_ORDER.map((category) => [category, []]));
  const seen = new Set();
  for (const raw of commits || []) {
    const commit = normalizeCommit(raw);
    if (!commit) continue;
    const key = `${commit.category}\u0000${commit.scope}\u0000${commit.summary}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    groups.get(commit.category).push(commit);
  }

  if (CATEGORY_ORDER.every((category) => groups.get(category).length === 0)) {
    const vStr = String(version || '当前版本').replace(/^v/i, '');
    groups.get('Fixed').push({
      category: 'Fixed',
      scope: 'release',
      summary: `v${vStr} 稳定性优化与常规维护更新。`
    });
  }
  return groups;
}

function formatReleaseNoteSection(groups, locale = 'zh') {
  const lines = [];
  for (const category of CATEGORY_ORDER) {
    const entries = groups.get(category) || [];
    if (entries.length === 0) continue;
    lines.push(`### ${locale === 'zh' ? CATEGORY_ZH[category] : category}`);
    lines.push(...entries.map((entry) => releaseNoteBullet(entry, locale)));
    lines.push('');
  }
  return lines.join('\n').trim();
}

function replaceMarkedSection(body, locale, content) {
  const startMarker = START_MARKERS[locale];
  const endMarker = END_MARKERS[locale];
  if (!startMarker || !endMarker) {
    throw new Error(`Unknown locale for markers: ${locale}`);
  }
  const start = body.indexOf(startMarker);
  if (start < 0) throw new Error(`Release template is missing the ${locale} start marker`);
  const contentStart = start + startMarker.length;
  const end = body.indexOf(endMarker, contentStart);
  if (end < 0) throw new Error(`Release template is missing the ${locale} end marker`);
  return `${body.slice(0, contentStart)}\n${content}\n${body.slice(end)}`;
}

function updateDownloadLinks(body, version) {
  const cleanVersion = String(version || '').replace(/^v/i, '').trim();
  if (!cleanVersion || cleanVersion === 'unknown') return body;

  let result = body.replace(
    /(\/releases\/download\/)v\d+\.\d+\.\d+(?:-rev\.\d+)?(\/)/g,
    `$1v${cleanVersion}$2`
  );
  result = result.replace(
    /(Token-Monitor(?:-Setup)?-)\d+\.\d+\.\d+(?:-rev\.\d+)?/g,
    `$1${cleanVersion}`
  );
  return result;
}

function updateFullChangelogLink(body, previousTag, version) {
  const cleanVersion = String(version || '').replace(/^v/i, '').trim();
  if (!previousTag || !cleanVersion || cleanVersion === 'unknown') return body;
  const currentTag = `v${cleanVersion}`;

  return body.replace(
    /<summary><strong>Full Changelog:<\/strong> <a href="https:\/\/github\.com\/IGNGserver\/token-monitor-suite\/compare\/[^"]+">[^<]+<\/a><\/summary>/g,
    `<summary><strong>Full Changelog:</strong> <a href="https://github.com/IGNGserver/token-monitor-suite/compare/${previousTag}...${currentTag}">${previousTag}...${currentTag}</a></summary>`
  );
}

function renderReleaseBody(template, { version, commits = [], previousTag = '' } = {}) {
  const groups = collectReleaseNoteGroups(commits, version);
  let body = template;

  if (body.includes(START_MARKERS.zh)) {
    body = replaceMarkedSection(body, 'zh', formatReleaseNoteSection(groups, 'zh'));
  }
  if (body.includes(START_MARKERS.en)) {
    body = replaceMarkedSection(body, 'en', formatReleaseNoteSection(groups, 'en'));
  }

  if (version) {
    body = updateDownloadLinks(body, version);
  }
  if (previousTag && version) {
    body = updateFullChangelogLink(body, previousTag, version);
  }

  return body;
}

function git(args, cwd = process.cwd()) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function resolvePreviousTag(headRef = 'HEAD', cwd = process.cwd()) {
  try {
    const exactTag = git(['describe', '--exact-match', '--tags', '--match', 'v*', headRef], cwd);
    if (exactTag) {
      const prev = git(['describe', '--tags', '--abbrev=0', '--match', 'v*', `${headRef}^`], cwd);
      if (prev) return prev;
    }
  } catch (_) {}
  try {
    const tag = git(['describe', '--tags', '--abbrev=0', '--match', 'v*', headRef], cwd);
    if (tag) return tag;
  } catch (_) {}
  try {
    const tags = git(['tag', '--sort=-creatordate', '--list', 'v*'], cwd)
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean);
    if (tags.length > 0) return tags[0];
  } catch (_) {}
  return '';
}

function readGitCommits({ baseRef = '', headRef = 'HEAD', cwd = process.cwd() } = {}) {
  const range = baseRef ? `${baseRef}..${headRef}` : headRef;
  let output;
  try {
    output = execFileSync('git', [
      'log', '--no-merges', '--pretty=format:%s%x1f%b%x1e', range, '--'
    ], { cwd, encoding: 'utf8' });
  } catch (_) {
    return [];
  }
  return output.split('\x1e')
    .map((record) => record.split('\x1f')[0].trim())
    .filter(Boolean);
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function generateReleaseBody({
  version,
  templatePath,
  outputPath,
  baseRef,
  headRef = 'HEAD',
  cwd = process.cwd()
}) {
  const template = fs.readFileSync(path.resolve(cwd, templatePath), 'utf8');
  const previousTag = baseRef || resolvePreviousTag(headRef, cwd);
  const commits = readGitCommits({ baseRef: previousTag, headRef, cwd });
  const body = renderReleaseBody(template, { version, commits, previousTag });
  fs.writeFileSync(path.resolve(cwd, outputPath), body, 'utf8');
  return { body, previousTag, commits };
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const version = String(args.version || '').replace(/^v/i, '').trim();
  const result = generateReleaseBody({
    version: version || 'unknown',
    templatePath: args.template || '.github/RELEASE_TEMPLATE.md',
    outputPath: args.output || 'release-body.md',
    baseRef: args.base || '',
    headRef: args.head || 'HEAD'
  });
  console.log(`Rendered release notes from ${result.previousTag || 'repository history'} (${result.commits.length} commits).`);
}

module.exports = {
  CATEGORY_ORDER,
  CATEGORY_ZH,
  SCOPE_ZH,
  collectReleaseNoteGroups,
  formatReleaseNoteSection,
  generateReleaseBody,
  parseCommitSubject,
  readGitCommits,
  renderReleaseBody,
  resolvePreviousTag,
  updateDownloadLinks,
  updateFullChangelogLink
};
