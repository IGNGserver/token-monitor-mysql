# English

## What's changed

<!-- app-update-notes:en:start -->
### Fixed
- **Desktop startup:** The widget no longer fails to start because `codex:accounts` was registered twice.
- **Windows 10 glass:** On Windows builds older than 11 22H2, the window falls back to CSS blur instead of becoming an opaque white slab. Native backdrop options stay hidden until the OS can host them.
- **Icon attribution:** Renderer Lucide and Tabler icon copies are listed in `THIRD_PARTY_NOTICES.md`.
<!-- app-update-notes:en:end -->

## Download

- **macOS Apple Silicon** — [Token-Monitor-0.45.0-rev.4-arm64.dmg](https://github.com/Javis603/token-monitor/releases/download/v0.45.0-rev.4/Token-Monitor-0.45.0-rev.4-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.45.0-rev.4-x64.dmg](https://github.com/Javis603/token-monitor/releases/download/v0.45.0-rev.4/Token-Monitor-0.45.0-rev.4-x64.dmg)
- **Windows Installer** — [Token-Monitor-Setup-0.45.0-rev.4.exe](https://github.com/Javis603/token-monitor/releases/download/v0.45.0-rev.4/Token-Monitor-Setup-0.45.0-rev.4.exe) (recommended)
- **Windows Portable** — [Token-Monitor-0.45.0-rev.4.exe](https://github.com/Javis603/token-monitor/releases/download/v0.45.0-rev.4/Token-Monitor-0.45.0-rev.4.exe) (no install required)
- **Linux x64** — [Token-Monitor-0.45.0-rev.4.AppImage](https://github.com/Javis603/token-monitor/releases/download/v0.45.0-rev.4/Token-Monitor-0.45.0-rev.4.AppImage)

<details>
<summary><strong>First launch and other notes</strong></summary>

### First launch

**macOS:** the app is Developer ID-signed and notarized by Apple. Open the `.dmg`, then drag Token Monitor to Applications.

**Windows:** both executables are signed ([how to verify](https://github.com/Javis603/token-monitor/blob/main/docs/code-signing.md#verify-a-download)).

**Linux:** mark the AppImage executable, then run it:

```bash
chmod +x "Token Monitor"*.AppImage
./"Token Monitor"*.AppImage
```

### Other notes

Other platforms are not pre-built — run from source per the [README](https://github.com/Javis603/token-monitor#readme). The macOS `.zip` is the same app repackaged; ignore it unless you specifically need it.

### tokscale dependency

Tokscale is bundled with this app. See **Settings → Tokscale** for the exact version
and the option to download a newer version directly from npm. Tokscale is MIT,
open-source: https://github.com/junhoyeo/tokscale

</details>

---

# 中文

## 更新内容

<!-- app-update-notes:zh:start -->
### 修复
- **桌面启动：** 小部件不再因为 `codex:accounts` 被重复注册而无法启动。
- **Windows 10 玻璃：** Windows 构建小于 11 22H2 时，窗口回退到 CSS blur 而不是变成不透明的白板。原生材质选项在操作系统支持时才显示。
- **图标归属：** Renderer 的 Lucide 和 Tabler 图标副本已列在 `THIRD_PARTY_NOTICES.md`。
<!-- app-update-notes:zh:end -->

## 下载

- **macOS Apple Silicon** — [Token-Monitor-0.45.0-rev.4-arm64.dmg](https://github.com/Javis603/token-monitor/releases/download/v0.45.0-rev.4/Token-Monitor-0.45.0-rev.4-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.45.0-rev.4-x64.dmg](https://github.com/Javis603/token-monitor/releases/download/v0.45.0-rev.4/Token-Monitor-0.45.0-rev.4-x64.dmg)
- **Windows 安装版** — [Token-Monitor-Setup-0.45.0-rev.4.exe](https://github.com/Javis603/token-monitor/releases/download/v0.45.0-rev.4/Token-Monitor-Setup-0.45.0-rev.4.exe)（推荐）
- **Windows 便携版** — [Token-Monitor-0.45.0-rev.4.exe](https://github.com/Javis603/token-monitor/releases/download/v0.45.0-rev.4/Token-Monitor-0.45.0-rev.4.exe)（免安装）
- **Linux x64** — [Token-Monitor-0.45.0-rev.4.AppImage](https://github.com/Javis603/token-monitor/releases/download/v0.45.0-rev.4/Token-Monitor-0.45.0-rev.4.AppImage)

<details>
<summary><strong>首次启动与其他说明</strong></summary>

### 首次启动

**macOS：** 应用已使用 Developer ID 签名并通过 Apple 公证。打开 `.dmg`，然后把 Token Monitor 拖到 Applications。

**Windows：** 两个可执行文件均已签名（[查看验证方法](https://github.com/Javis603/token-monitor/blob/main/docs/code-signing.md#verify-a-download)）。

**Linux：** 先给 AppImage 执行权限，然后运行：

```bash
chmod +x "Token Monitor"*.AppImage
./"Token Monitor"*.AppImage
```

### 其他说明

其他平台暂不提供预构建版本，请参考 [README](https://github.com/Javis603/token-monitor#readme) 从源码运行。macOS 的 `.zip` 只是同一个 app 的重新打包版本，除非你明确需要，否则可以忽略。

### tokscale 依赖

Tokscale 已随应用内置。你可以在 **设置 → Tokscale** 查看确切版本，
也可以直接从 npm 下载更新版本。Tokscale 是 MIT 开源项目：
https://github.com/junhoyeo/tokscale

</details>

---

<details>
<summary><strong>Full Changelog:</strong> <a href="https://github.com/Javis603/token-monitor/compare/v0.44.0...v0.45.0-rev.4">v0.44.0...v0.45.0-rev.4</a></summary>

<!-- github-generated-release-notes -->

</details>

<details>
<summary>繁體中文 · 한국어 · 日本語</summary>

<details>
<summary><strong>繁體中文</strong></summary>

## 繁體中文

## 更新內容

<!-- app-update-notes:zh-TW:start -->
### 修復
- **桌面啟動：** 小工具不再因為 `codex:accounts` 被重複註冊而無法啟動。
- **Windows 10 玻璃：** Windows 組建小於 11 22H2 時，視窗回退到 CSS blur 而不是變成不透明的白板。原生材質選項在作業系統支援時才顯示。
- **圖示歸屬：** Renderer 的 Lucide 和 Tabler 圖示副本已列在 `THIRD_PARTY_NOTICES.md`。
<!-- app-update-notes:zh-TW:end -->

## 下載

- **macOS Apple Silicon** — [Token-Monitor-0.45.0-rev.4-arm64.dmg](https://github.com/Javis603/token-monitor/releases/download/v0.45.0-rev.4/Token-Monitor-0.45.0-rev.4-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.45.0-rev.4-x64.dmg](https://github.com/Javis603/token-monitor/releases/download/v0.45.0-rev.4/Token-Monitor-0.45.0-rev.4-x64.dmg)
- **Windows 安裝版** — [Token-Monitor-Setup-0.45.0-rev.4.exe](https://github.com/Javis603/token-monitor/releases/download/v0.45.0-rev.4/Token-Monitor-Setup-0.45.0-rev.4.exe)（推薦）
- **Windows 便攜版** — [Token-Monitor-0.45.0-rev.4.exe](https://github.com/Javis603/token-monitor/releases/download/v0.45.0-rev.4/Token-Monitor-0.45.0-rev.4.exe)（免安裝）
- **Linux x64** — [Token-Monitor-0.45.0-rev.4.AppImage](https://github.com/Javis603/token-monitor/releases/download/v0.45.0-rev.4/Token-Monitor-0.45.0-rev.4.AppImage)

</details>

<details>
<summary><strong>한국어</strong></summary>

## 한국어

## 업데이트 내용

<!-- app-update-notes:ko:start -->
### 수정
- **데스크톱 시작:** `codex:accounts`가 두 번 등록되어 위젯이 시작에 실패하던 문제를 수정했습니다.
- **Windows 10 유리 효과:** Windows 11 22H2보다 낮은 빌드에서는 불투명한 흰 창 대신 CSS blur로 돌아갑니다. 네이티브 배경 옵션은 OS가 지원할 때만 표시됩니다.
- **아이콘 출처:** Renderer의 Lucide 및 Tabler 아이콘 사본이 `THIRD_PARTY_NOTICES.md`에 정리되어 있습니다.
<!-- app-update-notes:ko:end -->

## 다운로드

- **macOS Apple Silicon** — [Token-Monitor-0.45.0-rev.4-arm64.dmg](https://github.com/Javis603/token-monitor/releases/download/v0.45.0-rev.4/Token-Monitor-0.45.0-rev.4-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.45.0-rev.4-x64.dmg](https://github.com/Javis603/token-monitor/releases/download/v0.45.0-rev.4/Token-Monitor-0.45.0-rev.4-x64.dmg)
- **Windows 설치 버전** — [Token-Monitor-Setup-0.45.0-rev.4.exe](https://github.com/Javis603/token-monitor/releases/download/v0.45.0-rev.4/Token-Monitor-Setup-0.45.0-rev.4.exe) (권장)
- **Windows 포터블 버전** — [Token-Monitor-0.45.0-rev.4.exe](https://github.com/Javis603/token-monitor/releases/download/v0.45.0-rev.4/Token-Monitor-0.45.0-rev.4.exe) (설치 필요 없음)
- **Linux x64** — [Token-Monitor-0.45.0-rev.4.AppImage](https://github.com/Javis603/token-monitor/releases/download/v0.45.0-rev.4/Token-Monitor-0.45.0-rev.4.AppImage)

</details>

<details>
<summary><strong>日本語</strong></summary>

## 日本語

## 更新内容

<!-- app-update-notes:ja:start -->
### 修正
- **デスクトップ起動:** `codex:accounts` が二重登録されてウィジェットが起動できなくなる問題を修正しました。
- **Windows 10 のガラス:** Windows 11 22H2 より前のビルドでは、不透明な白い窓ではなく CSS blur にフォールバックします。ネイティブ背景の選択肢は OS が対応しているときだけ表示されます。
- **アイコンの出典:** Renderer の Lucide / Tabler アイコン複製を `THIRD_PARTY_NOTICES.md` に記載しました。
<!-- app-update-notes:ja:end -->

## ダウンロード

- **macOS Apple Silicon** — [Token-Monitor-0.45.0-rev.4-arm64.dmg](https://github.com/Javis603/token-monitor/releases/download/v0.45.0-rev.4/Token-Monitor-0.45.0-rev.4-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.45.0-rev.4-x64.dmg](https://github.com/Javis603/token-monitor/releases/download/v0.45.0-rev.4/Token-Monitor-0.45.0-rev.4-x64.dmg)
- **Windows インストーラー** — [Token-Monitor-Setup-0.45.0-rev.4.exe](https://github.com/Javis603/token-monitor/releases/download/v0.45.0-rev.4/Token-Monitor-Setup-0.45.0-rev.4.exe)（推奨）
- **Windows ポータブル版** — [Token-Monitor-0.45.0-rev.4.exe](https://github.com/Javis603/token-monitor/releases/download/v0.45.0-rev.4/Token-Monitor-0.45.0-rev.4.exe)（インストール不要）
- **Linux x64** — [Token-Monitor-0.45.0-rev.4.AppImage](https://github.com/Javis603/token-monitor/releases/download/v0.45.0-rev.4/Token-Monitor-0.45.0-rev.4.AppImage)

</details>

</details>
