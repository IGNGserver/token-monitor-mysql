# English

**Open-source build.** Windows and Android artifacts are published for this fork. Windows may show a SmartScreen warning until a trusted signing certificate is configured. Android releases are signed with the project's release key.

## What's changed

<!-- app-update-notes:en:start -->
### Added
- **Hub web dashboard + PWA:** The MySQL Hub now serves a same-port SaaS-style web UI (`http://host:17321`) with PWA install support for iOS / HarmonyOS and other devices without a native client.
- **Hub Docker image on GHCR:** Releases publish `ghcr.io/igngserver/token-monitor-hub` (`latest`, `<version>`, `v<version>`) plus `Token-Monitor-Hub-Compose-<version>.zip`. Deploy with `docker compose pull && docker compose up -d` (no local image build required).
- **OpenRouter multi-account limits:** Track OpenRouter usage/limits alongside other providers.
- **Windows glass modes:** Acrylic, Mica, Mica Alt, and Accent backdrop options for the desktop widget.
- **Tray composer / layout:** Richer tray text composition and layout controls.
- **Device runtime & breakdown:** Clearer per-device runtime status and usage breakdown presentation.
- **Automatic app updates UI:** In-app update presentation for desktop releases.
- **SignPath Windows packaging pipeline:** Release workflow prepares/signs Windows artifacts via SignPath-compatible steps when configured.
- **Credential store isolation:** Provider credentials are isolated more safely across accounts/providers.

### Changed
- **Upstream v0.35 parity:** Ports core desktop/shared improvements from token-monitor v0.35 while keeping fork-only MySQL Hub, Android, custom hour ranges, and IGNGserver release metadata.
- **Compose default path:** Root `docker-compose.yml` pulls the published Hub image by default; local source builds use `docker-compose.build.yml`.
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
- **Hub 网页仪表板 + PWA：** MySQL Hub 在同一端口提供 SaaS 风格网页（`http://主机:17321`），支持 PWA，方便 iOS / 鸿蒙等无官方客户端的设备查看数据。
- **Hub Docker 镜像（GHCR）：** 随 Release 发布 `ghcr.io/igngserver/token-monitor-hub`（`latest` / `<version>` / `v<version>`）以及 `Token-Monitor-Hub-Compose-<version>.zip`。部署使用 `docker compose pull && docker compose up -d`，无需本机构建镜像。
- **OpenRouter 多账号额度：** 可与其他供应商一样查看 OpenRouter 用量/额度。
- **Windows 毛玻璃模式：** 桌面小组件支持 Acrylic、Mica、Mica Alt、Accent。
- **托盘文案编排 / 布局：** 更丰富的托盘文本组合与布局控制。
- **设备运行时与拆分展示：** 更清晰的设备状态与用量拆分。
- **自动更新界面：** 桌面端应用内更新展示。
- **SignPath Windows 打包流水线：** 在配置密钥后，Release 可走 SignPath 兼容的签名步骤。
- **凭据隔离：** 供应商账号凭据隔离更安全。

### 变更
- **对齐上游 v0.35：** 合入 token-monitor v0.35 的桌面/共享能力，同时保留本 fork 的 MySQL Hub、Android、自定义小时范围与 IGNGserver 发布元数据。
- **Compose 默认拉镜像：** 根目录 `docker-compose.yml` 默认拉取已发布 Hub 镜像；本地源码构建使用 `docker-compose.build.yml`。
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
