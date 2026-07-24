# English

**Open-source build.** Windows and Android artifacts are published for this fork. Windows may show a SmartScreen warning until a trusted signing certificate is configured. Android releases are signed with the project's release key.

## What's changed

<!-- app-update-notes:en:start -->
### Added
- **Android dashboard redesign:** Overview and Analytics now include token, cost, dual-metric, and active-time trend charts, plus device comparison views.
- **Client branding:** Desktop-aligned client colors and monogram badges across client rows and charts.
- **Skeleton loaders:** Loading placeholders while hub stats stream in.

### Improved
- **Session cost ranking:** Clearer ranking of recent high-cost sessions on Overview.
- **Empty states:** More helpful empty / disconnected guidance throughout the Android app.
- **Dark-theme charts:** Higher chart contrast and peak date labels for readability.
<!-- app-update-notes:en:end -->

## Download

Open the release's **Assets** section and download the file for your device:

- **Windows** — `Token-Monitor-Setup-<version>.exe` (recommended) or the portable `.exe`.
- **Android** — `Token-Monitor-Android-<version>.apk`.

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

This fork currently publishes Windows and Android artifacts. For other platforms, run from source according to the [README](https://github.com/IGNGserver/token-monitor-mysql#readme).

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
- **安卓端仪表盘重做：** 概览与分析页提供 Token / 费用 / 双指标 / 活跃时间趋势图，以及设备对比视图。
- **客户端品牌色：** 与桌面端对齐的客户端配色与字母徽章，覆盖列表与图表。
- **骨架屏加载：** 在 Hub 数据流式到达前展示加载占位。

### 改进
- **会话费用排行：** 概览页更清晰地展示近期高费用会话。
- **空状态：** 未连接 / 无数据时的引导更明确。
- **暗色图表：** 提升图表对比度，并标注峰值日期，便于阅读。
<!-- app-update-notes:zh:end -->

## 下载

打开 Release 页面中的 **Assets**，下载对应设备的文件：

- **Windows** — `Token-Monitor-Setup-<version>.exe`（推荐）或便携版 `.exe`。
- **Android** — `Token-Monitor-Android-<version>.apk`。

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

本 fork 当前发布 Windows 和 Android 安装包。其他平台请参考 [README](https://github.com/IGNGserver/token-monitor-mysql#readme) 从源码运行。

### tokscale 依赖

Tokscale 已随应用内置。你可以在 **设置 → Tokscale** 查看确切版本，
也可以直接从 npm 下载更新版本。Tokscale 是 MIT 开源项目：
https://github.com/junhoyeo/tokscale

</details>
