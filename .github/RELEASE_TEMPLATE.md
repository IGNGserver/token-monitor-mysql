# 更新内容

<!-- app-update-notes:zh:start -->
### 变更
- **桌面端：** Electron 小部件和仪表盘已完整回退到 `0.37.23-rev.3` 桌面树。中枢、采集端、Worker 和共享采集仍走 0.45。
- **Windows 10 玻璃：** 原生材质仍需要 Windows 11 22H2 或更新。更旧的 Windows 继续使用 CSS blur，而不是不透明白板。
- **Codex 登录：** 设备登录会显示设备码，支持复制、打开登录页和取消，避免浏览器登录过程中无反馈地卡住。
- **第三方 API 账号：** 设置区改为带图标的账号卡片，并展示端点、认证方式，支持启用、删除和环境变量账号。
- **跨端数据：** 补齐 DeepSeek Harness 用量采集，以及 Android 的订阅资料、历史数据和额度展示。
- **Codex 验证码：** 修正设备验证码解析，确保显示完整的 9 位验证码。
- **Codex 账号登录：** 登录完成后立即写入账号状态，额度刷新转入后台，避免因慢请求卡在“读取账号”。
<!-- app-update-notes:zh:end -->

## 下载

- **macOS Apple Silicon** — [Token-Monitor-0.45.0-rev.10-arm64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.10/Token-Monitor-0.45.0-rev.10-arm64.dmg)
- **macOS Intel** — [Token-Monitor-0.45.0-rev.10-x64.dmg](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.10/Token-Monitor-0.45.0-rev.10-x64.dmg)
- **Windows 安装版** — [Token-Monitor-Setup-0.45.0-rev.10.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.10/Token-Monitor-Setup-0.45.0-rev.10.exe)（推荐）
- **Windows 便携版** — [Token-Monitor-0.45.0-rev.10.exe](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.10/Token-Monitor-0.45.0-rev.10.exe)（免安装）
- **Linux x64** — [Token-Monitor-0.45.0-rev.10.AppImage](https://github.com/IGNGserver/token-monitor-suite/releases/download/v0.45.0-rev.10/Token-Monitor-0.45.0-rev.10.AppImage)

---

<details>
<summary><strong>Full Changelog:</strong> <a href="https://github.com/IGNGserver/token-monitor-suite/compare/v0.45.0-rev.9...v0.45.0-rev.10">v0.45.0-rev.9...v0.45.0-rev.10</a></summary>

<!-- github-generated-release-notes -->

</details>
