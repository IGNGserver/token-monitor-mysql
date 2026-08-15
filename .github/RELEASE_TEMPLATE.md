# English

**Open-source build.** Windows, macOS, Linux, and Android artifacts are published for this fork. The Windows and macOS desktop builds are unsigned and may show a platform security warning on first launch. Android releases are signed with the project's release key.

## What's changed

<!-- app-update-notes:en:start -->
### Fixed
- **Claude Desktop usage missing after upgrade:** Existing installs that already had a saved tools list now one-time auto-enable the new default client `claude-desktop` (Local Agent / Cowork). Later manual disable is preserved.
- **Hub URL without scheme:** Entering a bare domain or IP on desktop/agent/Android now defaults to `http://` (existing `http://` / `https://` values are left unchanged).
- **Custom date range details:** Desktop and Android keep project, session, device, and Claude Desktop breakdowns when the Hub supplies aggregate range totals.
- **Desktop session view:** Fixed the session breakdown failing to render for today, month, and custom ranges.
- **Windows window controls:** The frameless desktop window now keeps minimize, close, and pin controls visible in the title bar.
- **Windows period controls:** Date and period buttons stay visible while hovering the window controls.
- **Unified brand icon:** Replaced the legacy Sigma-style desktop, website, PWA, and tray icons with the Token Pulse mark.
<!-- app-update-notes:en:end -->

## Download

Open the release's **Assets** section and download the file for your device:

- **Windows** — `Token-Monitor-Setup-<version>.exe` (recommended) or the portable `.exe`.
- **macOS** — `Token-Monitor-<version>-arm64.dmg` for Apple Silicon or `Token-Monitor-<version>-x64.dmg` for Intel. These are unsigned builds; Control-click the app and choose **Open** on first launch.
- **Linux** — Debian/Ubuntu: `Token-Monitor-<version>.deb`; other distributions: `Token-Monitor-<version>.AppImage`.
- **Android** — `Token-Monitor-Android-<version>.apk`.
- **Hub (Docker)** — image `ghcr.io/igngserver/token-monitor-hub:<version>` (also `:latest`) and optional `Token-Monitor-Hub-Compose-<version>.zip`.

<details>
<summary><strong>First launch and other notes</strong></summary>

### First launch

**macOS:** open the `.dmg`, drag Token Monitor to Applications, then Control-click the app and choose **Open** the first time.

**Windows:** SmartScreen → More info → Run anyway when you trust the downloaded release.

**Debian/Ubuntu:** install the package from the directory containing the downloaded asset:

```bash
sudo apt install ./Token-Monitor-*.deb
```

**Other Linux distributions:** mark the AppImage executable, then run it:

```bash
chmod +x Token-Monitor-*.AppImage
./Token-Monitor-*.AppImage
```

### Other notes

This fork publishes Windows, macOS, Linux, Android, and the Hub Docker image (GHCR). Desktop platforms without a package can still run from source per the [README](https://github.com/IGNGserver/token-monitor-suite#readme).

### tokscale dependency

Tokscale is bundled with this app. See **Settings → Tokscale** for the exact version
and the option to download a newer version directly from npm. Tokscale is MIT,
open-source: https://github.com/junhoyeo/tokscale

</details>

---

# 中文

**这是开源构建。** 本 fork 发布 Windows、macOS、Linux 和 Android 安装包。Windows 与 macOS 桌面构建未签名，首次启动时可能出现系统安全提示；Android 发布包使用项目签名密钥签名。

## 更新内容

<!-- app-update-notes:zh:start -->
### 修复
- **升级后 Claude Desktop 用量不显示：** 已有安装若持久化了旧的工具列表，会一次性自动启用新增的默认客户端 `claude-desktop`（Local Agent / Cowork）；之后用户手动关闭会保持关闭。
- **Hub 地址未写协议：** 桌面端 / Agent / Android 填写裸域名或 IP 时默认补全为 `http://`（已有 `http://` / `https://` 不变）。
- **自定义日期范围详情：** Hub 返回聚合总量时，桌面端和 Android 仍保留项目、会话、设备及 Claude Desktop 的分项数据。
- **桌面端会话视图：** 修复今日、本月及自定义日期范围的会话分解无法渲染的问题。
- **Windows 窗口控制：** 无边框桌面窗口现在会在标题栏常驻显示最小化、关闭和置顶按钮。
- **Windows 日期控件：** 鼠标悬停窗口控制按钮时，日期和 DAY/MONTH/TOTAL 按钮仍保持显示。
- **统一品牌图标：** 将桌面端、网站、PWA 和托盘中的旧版 Sigma 风格图标替换为 Token Pulse 标识。
<!-- app-update-notes:zh:end -->

## 下载

打开 Release 页面中的 **Assets**，下载对应设备的文件：

- **Windows** — `Token-Monitor-Setup-<version>.exe`（推荐）或便携版 `.exe`。
- **macOS** — Apple Silicon 使用 `Token-Monitor-<version>-arm64.dmg`，Intel 使用 `Token-Monitor-<version>-x64.dmg`。这是未签名构建，首次启动请按住 Control 点击应用并选择“打开”。
- **Linux** — Debian/Ubuntu 使用 `Token-Monitor-<version>.deb`；其他发行版使用 `Token-Monitor-<version>.AppImage`。
- **Android** — `Token-Monitor-Android-<version>.apk`。
- **Hub（Docker）** — 镜像 `ghcr.io/igngserver/token-monitor-hub:<version>`（同时有 `:latest`），以及可选的 `Token-Monitor-Hub-Compose-<version>.zip`。

<details>
<summary><strong>首次启动与其他说明</strong></summary>

### 首次启动

**macOS：** 打开 `.dmg`，把 Token Monitor 拖到 Applications；首次启动时按住 Control 点击应用并选择“打开”。

**Windows：** SmartScreen → 更多信息 → 仍要运行。

**Debian/Ubuntu：** 在下载文件所在目录安装 `.deb`：

```bash
sudo apt install ./Token-Monitor-*.deb
```

**其他 Linux 发行版：** 先给 AppImage 执行权限，然后运行：

```bash
chmod +x Token-Monitor-*.AppImage
./Token-Monitor-*.AppImage
```

### 其他说明

本 fork 发布 Windows、macOS、Linux、Android 安装包以及 Hub Docker 镜像（GHCR）。其他桌面平台可参考 [README](https://github.com/IGNGserver/token-monitor-suite#readme) 从源码运行。

### tokscale 依赖

Tokscale 已随应用内置。你可以在 **设置 → Tokscale** 查看确切版本，
也可以直接从 npm 下载更新版本。Tokscale 是 MIT 开源项目：
https://github.com/junhoyeo/tokscale

</details>
