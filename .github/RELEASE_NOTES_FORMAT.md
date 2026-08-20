# Release Notes Format

`.github/RELEASE_TEMPLATE.md` is the live, per-release GitHub release body used
by `.github/workflows/release.yml` through `body_path`.

This file documents the stable Markdown shape of that release body.

## Structure

- Release notes are authored and generated directly in **Simplified Chinese (中文)**.
- English and other language sections are not required.
- Do not include installation instructions or first-launch tutorials; keep the focus directly on:
  1. **更新内容** — Clear and categorized highlights of what changed in this version (`### 新增`, `### 变更`, `### 改进`, `### 修复`).
  2. **下载** — Direct click-to-download links for the primary platforms (macOS Apple Silicon, macOS Intel, Windows 安装版, Windows 便携版, Linux x64).
- Put one collapsed `Full Changelog` details block below the `---` divider. Its summary contains the version compare link (`vPREVIOUS...vCURRENT`), and GitHub generated release notes marker `<!-- github-generated-release-notes -->` inside.
- Keep the `<!-- app-update-notes:zh:start -->` and `<!-- app-update-notes:zh:end -->` markers around the update notes so the in-app updater extracts the changelog cleanly.

## Skeleton

```markdown
# 更新内容

<!-- app-update-notes:zh:start -->
### 新增
- ...

### 变更
- ...

### 改进
- ...

### 修复
- ...
<!-- app-update-notes:zh:end -->

## 下载

- **macOS Apple Silicon** — [Token-Monitor-VERSION-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/vVERSION/Token-Monitor-VERSION-arm64.dmg)
- **macOS Intel** — [Token-Monitor-VERSION-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/vVERSION/Token-Monitor-VERSION-x64.dmg)
- **Windows 安装版** — [Token-Monitor-Setup-VERSION.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/vVERSION/Token-Monitor-Setup-VERSION.exe)（推荐）
- **Windows 便携版** — [Token-Monitor-VERSION.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/vVERSION/Token-Monitor-VERSION.exe)（免安装）
- **Linux x64** — [Token-Monitor-VERSION.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/vVERSION/Token-Monitor-VERSION.AppImage)

---

<details>
<summary><strong>Full Changelog:</strong> <a href="https://github.com/IGNGserver/token-monitor-suite/compare/vPREVIOUS...vCURRENT">vPREVIOUS...vCURRENT</a></summary>

<!-- github-generated-release-notes -->

</details>
```
