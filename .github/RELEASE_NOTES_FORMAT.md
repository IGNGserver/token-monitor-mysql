# Release Notes Format

`.github/RELEASE_TEMPLATE.md` is the bilingual shell used by
`.github/workflows/release.yml`. The workflow runs
`scripts/generate-release-notes.js` with the commit range since the previous
`v*` tag, replaces the marked release-note sections, and then adds the Hub
download instructions. Do not edit release-specific bullets into the shell;
the generated body must describe the tag being published.

## Editable Sections

The generator replaces these blocks for every tag unless download, first-launch,
or tokscale guidance is also being changed:

- English: `## What's changed`
- Simplified Chinese: `## 更新内容`

Keep the bilingual structure and the marker comments. Categories with no
user-facing commits are omitted; a maintenance-only range gets a
version-specific fallback bullet so the release body never silently repeats an
older release's notes.

## Category Order

Use this order when categories apply:

1. `Added` / `新增`
2. `Changed` / `变更`
3. `Improved` / `改进`
4. `Fixed` / `修复`

Keep the four-category skeleton as the canonical format. In the live
`.github/RELEASE_TEMPLATE.md` for a specific tag, remove categories with no
release-note bullets. Use `Changed` / `变更` only for meaningful behavior changes
that are not simply new, improved, or fixed.

## Writing Rules

- Describe shipped user-facing behavior, not internal commits.
- Keep same-batch follow-up fixes inside the final feature wording.
- Do not include README-only, formatting-only, template-only, or internal docs
  maintenance as release-note bullets.
- Put experimental features under `Added` / `新增`, and say when they are off by
  default or still being tested.
- Use current UI terms from `src/electron/renderer/i18n.js`.
- Chinese release notes are Simplified Chinese.

## Skeleton

```markdown
## What's changed

### Added
- ...

### Changed
- ...

### Improved
- ...

### Fixed
- ...

## 更新内容

### 新增
- ...

### 变更
- ...

### 改进
- ...

### 修复
- ...
```
