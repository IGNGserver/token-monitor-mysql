# English

**Open-source build, not paid-signed.** macOS and Windows will ask you to confirm on first launch — instructions below.

## What's changed

### Fixed
- Fixed a collector self-trigger loop: the file watcher monitored cache directories written by the collector's own Cursor / Antigravity sync, so collection kept re-triggering even while idle. On macOS the resulting high-frequency tokscale processes could destabilize the system's Gatekeeper checks (syspolicyd) until Token Monitor was stopped. Usage scans now run serially, and the syncs are skipped when unused and limited to once per 5 minutes. ([#15](https://github.com/Javis603/token-monitor/issues/15))

### Improved
- Watch-triggered refreshes now run a single `--today` scan and derive the MONTH / TOTAL figures exactly from the last full scan, cutting per-refresh load to a third during active coding while keeping the 3-5 s update latency. ([#15](https://github.com/Javis603/token-monitor/issues/15))

## Which file should I download?

- **macOS (Apple Silicon, M1 and later)** — the `.dmg` file
- **Windows 10/11** — `Token Monitor Setup ….exe` (installer, recommended)
- **Windows portable** — `Token Monitor ….exe` (runs without installing)

Intel Macs and Linux are not pre-built — run from source per the [README](https://github.com/Javis603/token-monitor#readme). The macOS `.zip` is the same app repackaged; ignore it unless you specifically need it.

## First-launch unlock

**macOS:** right-click `Token Monitor.app` → Open (once). If you see "Token Monitor" can't be opened or is damaged:

```bash
xattr -dr com.apple.quarantine "/Applications/Token Monitor.app"
```

**Windows:** SmartScreen → More info → Run anyway.

## tokscale dependency

Tokscale is bundled with this app. See **Settings → Tokscale** for the exact version
and the option to download a newer version directly from npm. Tokscale is MIT,
open-source: https://github.com/junhoyeo/tokscale

---

# 中文

**这是开源构建，不是付费签名版本。** macOS 和 Windows 首次启动时会要求你手动确认，操作说明见下方。

## 更新内容

### 修复
- 修复采集器自激循环：watcher 监听了 Cursor / Antigravity sync 自己写入的缓存目录，导致即使机器空闲也会不停重复采集。在 macOS 上由此产生的高频 tokscale 进程可能拖垮系统的 Gatekeeper 评估（syspolicyd），需要停止 Token Monitor 才能恢复。用量扫描现在改为串行执行，sync 未使用时跳过，并限制为每 5 分钟最多一次。([#15](https://github.com/Javis603/token-monitor/issues/15))

### 改进
- watch 触发的刷新现在只跑一次 `--today` 扫描，MONTH / TOTAL 数字用上一次全量扫描精确推导，活跃使用期间单次刷新负载降到原来的三分之一，更新延迟保持 3-5 秒。([#15](https://github.com/Javis603/token-monitor/issues/15))

## 应该下载哪个文件？

- **macOS（苹果芯片，M1 及之后机型）** — 下载 `.dmg` 安装包
- **Windows 10/11** — 下载 `Token Monitor Setup ….exe`（安装版，推荐）
- **Windows 便携版** — 下载 `Token Monitor ….exe`（无需安装，直接运行）

Intel Mac 和 Linux 暂不提供预构建版本，请参考 [README](https://github.com/Javis603/token-monitor#readme) 从源码运行。macOS 的 `.zip` 只是同一个 app 的重新打包版本，除非你明确需要，否则可以忽略。

## 首次启动放行

**macOS：** 右键 `Token Monitor.app` → 打开（只需要一次）。如果看到「Token Monitor」未开启 或 已损坏：

```bash
xattr -dr com.apple.quarantine "/Applications/Token Monitor.app"
```

**Windows：** SmartScreen → 更多信息 → 仍要运行。

## tokscale 依赖

Tokscale 已随应用内置。你可以在 **设置 → Tokscale** 查看确切版本，
也可以直接从 npm 下载更新版本。Tokscale 是 MIT 开源项目：
https://github.com/junhoyeo/tokscale
