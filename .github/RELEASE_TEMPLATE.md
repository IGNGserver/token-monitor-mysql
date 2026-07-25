# English

**Open-source build.** Windows and Android artifacts are published for this fork. Windows may show a SmartScreen warning until a trusted signing certificate is configured. Android releases are signed with the project's release key.

## What's changed

<!-- app-update-notes:en:start -->
### Fixed
- **Custom range token totals:** Desktop and Android custom calendar ranges now use the same day-level counting family as the Day/Month tabs (tokscale `--since`/`--until` locally; hub `history.daily` when synced). Totals are no longer rebuilt from incomplete session timestamps or preferred from mis-dated usage events.
- **Custom range calendar popover:** The desktop calendar dialog no longer opens on launch, can be closed with × / outside click / Escape, and the calendar button height matches the DAY / MONTH / TOTAL tabs.
- **Android range calendar alignment:** Day circles and numbers are centered on each cell; the range highlight band now shares the same geometric center as the selection circles.
- **Android hour wheel contrast:** Selected hour uses primary/bold emphasis; unselected hours are de-emphasized so the active row is obvious.
- **Android overview density:** Removed the duplicate client-share donut under the hero card; the share card keeps the ranked bars only.
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
### 修复
- **自定义时间范围 Token 计数：** 桌面端与 Android 自定义日历范围改用与「日 / 月」页签同一套按日计数逻辑（本地 tokscale `--since`/`--until`；同步模式下使用 hub 的 `history.daily`）。不再用残缺会话时间戳重建总数，也不再优先采用可能误标日期的 usage_events。
- **自定义时间范围日历弹层：** 桌面端日历不再启动时自动弹出，可用 × / 点击外侧 / Esc 关闭，日历按钮高度与「日 / 月 / 累计」页签一致。
- **Android 日历对齐：** 日期圆圈与数字在格子中居中，区间高光与选中圆共用同一几何中心，不再看起来偏右。
- **Android 小时滚轮对比度：** 选中小时使用主题色加粗；未选中小时降低对比度，选中行更清晰。
- **Android 概览密度：** 去掉「客户端占比」中与顶部英雄卡重复的甜甜圈图，仅保留占比条，减少空白。
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