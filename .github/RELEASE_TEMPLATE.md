# English

**Open-source build.** Windows and Android artifacts are published for this fork. Windows may show a SmartScreen warning until a trusted signing certificate is configured. Android releases are signed with the project's release key.

## What's changed

<!-- app-update-notes:en:start -->
### Added
- **Sync upload frequency:** Choose Live or every 10, 20, or 30 minutes under Multi-device Sync. Interval modes send the latest snapshot on the selected schedule. (#148)

### Improved
- **All-new Settings:** A complete visual and interaction redesign brings Settings in line with the modernized main interface, with one continuous card, clearer title-left/control-right rows, iOS-style switches, compact inline options, refined sliders, and cleaner shortcut and status controls. (#172)
- **Default window:** The main window now opens narrower and taller to better fit the interface.

### Fixed
- **Settings navigation:** Clicked section headers now stay in place while accordion sections collapse. (#168)
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
- **同步上传频率：** 可在多设备同步中选择实时，或每 10、20、30 分钟上传；定时模式会按所选频率发送最新快照。（#148）

### 改进
- **全新设置：** 设置面板迎来完整的视觉与交互设计升级，与现代化主界面保持一致；采用一体式卡片、清晰的左侧标题／右侧控件布局、iOS 风格开关、紧凑的行内选项、精致滑杆，以及更简洁的快捷键与状态控件。（#172）
- **默认窗口：** 主窗口现在以更窄、更高的比例打开，更贴合界面内容。

### 修复
- **设置导航：** 折叠分区时，已点击的标题现在会保持在原位。（#168）
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
