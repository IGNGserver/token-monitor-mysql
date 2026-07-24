# English

**Open-source build.** Windows and Android artifacts are published for this fork. Windows may show a SmartScreen warning until a trusted signing certificate is configured. Android releases are signed with the project's release key.

## What's changed

<!-- app-update-notes:en:start -->
### Added
- **Custom hour-range analytics:** On Android and the desktop widget, open **Analytics → Custom**, pick a calendar day range (same day allowed), and dial start/end hours. Client and model share charts load from the hub event ledger with hour precision; day-level history is used only as a fallback.
- **Client / model detail drill-down:** Tap a client or model row in analytics to open a detail screen for the selected period, including custom ranges.
- **Hub range API:** `GET /api/usage/range?from=&to=` aggregates usage for an exclusive-end window (events first, history daily fallback).

### Improved
- **Today hero donut:** Larger ring (140dp) and tighter hero metrics so the Overview “今日” card no longer leaves a large empty stretch beside a tiny pie.
- **Chart grow animations & haptics:** Progress bars, donuts, and segmented bars keep grow-in animations; the custom-range hour wheels and confirm actions use selection/confirm/error haptics according to Settings (Off / Standard / Enhanced).
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
- **自定义小时级分析：** 在 Android 与桌面小组件的「分析 → 自定义」中，可用日历选择起止日期（允许同一天），并用滚轮设置起止小时。客户端/模型占比会按 Hub 事件账本按小时聚合；仅在事件不足时回退到按日历史。
- **客户端 / 模型详情下钻：** 在分析页点击某一客户端或模型行，可进入该时间范围内的详情页（含自定义范围）。
- **Hub 范围接口：** `GET /api/usage/range?from=&to=` 按半开区间聚合用量（优先事件，历史按日回退）。

### 改进
- **今日英雄卡饼图：** 饼图放大到 140dp，并收紧左侧指标排版，避免「今日」卡片里小饼图旁大片空白。
- **图表生长动画与触感：** 进度条、饼图、分段条保持生长动画；自定义范围的小时滚轮与确认/错误操作会按设置（关闭 / 标准 / 增强）触发不同震动。
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
