# English

**Open-source build.** Windows and Android artifacts are published for this fork. Windows may show a SmartScreen warning until a trusted signing certificate is configured. Android releases are signed with the project's release key.

## What's changed

<!-- app-update-notes:en:start -->
### Added
- **Chart grow animations:** Progress bars, donut charts, quota rings, and segmented token bars animate from empty to current values.
- **Theme colors:** Pick a seed color (Blue / Green / Purple / Teal / Orange / Rose) in Settings, or use **System** dynamic color from the wallpaper on Android 12+.
- **Haptics:** Off / Standard / Enhanced vibration feedback with distinct patterns for taps, toggles, success, errors, and refresh. Enhanced mode includes in-settings previews.

### Improved
- **Today hero donut:** Larger ring and no empty stretch beside the chart in the Overview hero card.
- **Android settings:** Appearance and haptics controls live under Settings with clearer Chinese labels.
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
- **图表伸展动画：** 进度条、饼/环图、配额环与分段 Token 条会从空值动画到当前值。
- **主题色：** 可在设置中选择蓝 / 绿 / 紫 / 青 / 橙 / 玫红，或选择「系统」在 Android 12+ 跟随壁纸动态取色。
- **触感反馈：** 关闭 / 标准 / 增强三档震动；点击、切换、成功、错误、刷新等使用不同震动模式；增强模式可在设置中试听。

### 改进
- **今日概览饼图：** 环图更大，并消除英雄卡片旁大片空白。
- **安卓设置页：** 外观与触感选项集中在设置页，中文说明更清晰。
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
