# English

**Open-source build.** Windows and Android artifacts are published for this fork. Windows may show a SmartScreen warning until a trusted signing certificate is configured. Android releases are signed with the project's release key.

## What's changed

<!-- app-update-notes:en:start -->
### Added
- **Hub Web / Android analytics parity:** Port more desktop analytics surfaces to the Hub web dashboard and Android app — client/provider status, plan & workspace identity, OpenRouter branding, contribution heatmap, active days, session 200, incomplete projects, home return navigation, stacked trend charts, tool→model drilldown, custom hour ranges, limit tone cues, home limit account counts, WSL/device runtime breakdown, and full `/api/history` support.
- **Optional Hub HTTPS/TLS:** `TOKEN_MONITOR_TLS_CERT` / `TOKEN_MONITOR_TLS_KEY` / `TOKEN_MONITOR_TLS_CA` enable same-port HTTPS so true PWA install works for phones opening the hub by LAN IP.
- **PWA maskable icons:** Add maskable 192/512 icons for better home-screen install on mobile.

### Changed
- **Portable multi-surface experience:** Hub web and Android stay aligned with desktop analytics workflows while preserving fork-only MySQL Hub, custom hour ranges, tray/desktop glass, and IGNGserver release packaging.
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
- **Hub 网页 / Android 分析能力对齐：** 将更多桌面端分析能力移植到 Hub 网页与 Android —— 客户端/供应商状态、套餐与工作区身份、OpenRouter 品牌、贡献热力图、活跃天数、会话 200、未完成项目、返回首页导航、堆叠趋势图、工具→模型下钻、自定义小时范围、额度色阶提示、首页额度账号数、WSL/设备运行时拆分，以及完整 `/api/history` 支持。
- **可选 Hub HTTPS/TLS：** 通过 `TOKEN_MONITOR_TLS_CERT` / `TOKEN_MONITOR_TLS_KEY` / `TOKEN_MONITOR_TLS_CA` 启用同端口 HTTPS，便于手机用局域网 IP 打开时真正安装 PWA。
- **PWA maskable 图标：** 补充 192/512 maskable 图标，改善移动端主屏安装效果。

### 变更
- **多端便携体验：** Hub 网页与 Android 更贴近桌面端分析工作流，同时保留本 fork 的 MySQL Hub、自定义小时范围、桌面毛玻璃/托盘，以及 IGNGserver 发布打包链路。
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
