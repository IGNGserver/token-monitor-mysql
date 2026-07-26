# English

**Open-source build.** Windows and Android artifacts are published for this fork. Windows may show a SmartScreen warning until a trusted signing certificate is configured. Android releases are signed with the project's release key.

## What's changed

<!-- app-update-notes:en:start -->
### Added
- **Claude Desktop Local Agent / Cowork tracking:** New default-tracked client `claude-desktop` (separate from Claude Code). Reads real Local Agent transcript `message.usage` under Desktop app data, with today/month/all-time totals, history, custom date ranges, project labels, costs, and session detail — same feature set as other tools. Regular claude.ai chat remains out of scope.
- **Android More-page haptics:** Every action button on the Android “More” page now provides vibration feedback.

### Fixed
- **Windows custom date range empty results:** Restores data after selecting a custom date range on desktop (Windows).
<!-- app-update-notes:en:end -->

## Download

Open the release's **Assets** section and download the file for your device:

- **Windows** — `Token-Monitor-Setup-<version>.exe` (recommended) or the portable `.exe`.
- **Android** — `Token-Monitor-Android-<version>.apk`.
- **Hub (Docker)** — image `ghcr.io/igngserver/token-monitor-hub:<version>` (also `:latest`) and optional `Token-Monitor-Hub-Compose-<version>.zip`.

<details>
<summary><strong>First launch and other notes</strong></summary>

### First launch

**macOS:** open the `.dmg`, drag Token Monitor to Applications.

**Windows:** SmartScreen → More info → Run anyway when you trust the downloaded release.

**Linux:** mark the AppImage executable, then run it:

```bash
chmod +x "Token Monitor"*.AppImage
./"Token Monitor"*.AppImage
```

### Other notes

This fork publishes Windows, Android, and the Hub Docker image (GHCR). Desktop platforms without a package can still run from source per the [README](https://github.com/IGNGserver/token-monitor-mysql#readme).

### tokscale dependency

Tokscale is bundled with this app. See **Settings → Tokscale** for the exact version
and the option to download a newer version directly from npm. Tokscale is MIT,
open-source: https://github.com/junhoyeo/tokscale

</details>

---

# 中文

**这是开源构建。** 本 fork 发布 Windows 和 Android 安装包。Windows 在配置受信任的代码签名证书前可能会出现 SmartScreen 提示；Android 发布包使用项目签名密钥签名。

## 更新内容

<!-- app-update-notes:zh:start -->
### 新增
- **Claude Desktop Local Agent / Cowork 监测：** 新增默认跟踪客户端 `claude-desktop`（与 Claude Code 分离）。从 Desktop 本地 Local Agent 会话 transcript 读取真实 `message.usage`，支持今日/本月/全部、历史曲线、自定义日期、项目标签、费用估算与 session 明细，功能类别与其他工具一致。普通 claude.ai 聊天仍不在监测范围。
- **Android「更多」页振动反馈：** 「更多」页面各操作按钮均提供振动反馈。

### 修复
- **Windows 自定义日期选择后无数据：** 修复桌面端（Windows）选择自定义日期后不显示数据的问题。
<!-- app-update-notes:zh:end -->

## 下载

打开 Release 页面中的 **Assets**，下载对应设备的文件：

- **Windows** — `Token-Monitor-Setup-<version>.exe`（推荐）或便携版 `.exe`。
- **Android** — `Token-Monitor-Android-<version>.apk`。
- **Hub（Docker）** — 镜像 `ghcr.io/igngserver/token-monitor-hub:<version>`（同时有 `:latest`），以及可选的 `Token-Monitor-Hub-Compose-<version>.zip`。

<details>
<summary><strong>首次启动与其他说明</strong></summary>

### 首次启动

**macOS：** 打开 `.dmg`，把 Token Monitor 拖到 Applications。

**Windows：** SmartScreen → 更多信息 → 仍要运行。

**Linux：** 先给 AppImage 执行权限，然后运行：

```bash
chmod +x "Token Monitor"*.AppImage
./"Token Monitor"*.AppImage
```

### 其他说明

本 fork 发布 Windows、Android 安装包以及 Hub Docker 镜像（GHCR）。其他桌面平台可参考 [README](https://github.com/IGNGserver/token-monitor-mysql#readme) 从源码运行。

### tokscale 依赖

Tokscale 已随应用内置。你可以在 **设置 → Tokscale** 查看确切版本，
也可以直接从 npm 下载更新版本。Tokscale 是 MIT 开源项目：
https://github.com/junhoyeo/tokscale

</details>
