<p align="right">
   <strong>EN</strong> | <a href="./README.zh-CN.md">简</a> | <a href="./README.zh-TW.md">繁</a>
</p>
<div align="center">
    <img src=".github/assets/app.png" alt="Token Monitor logo" width="120">
    <h1>Token Monitor</h1>
</div>

<p align="center">
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-yellow.svg" alt="License: MIT" /></a>
    <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%E2%89%A518.17-brightgreen?logo=node.js&logoColor=white" alt="Node.js 18.17+" /></a>
    <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows-blue" alt="Platforms: macOS and Windows" />
    <img src="https://img.shields.io/badge/local--first-yes-blueviolet" alt="Local-first" />
</p>

<div align="center">
    <img src=".github/assets/demo.gif">
</div>

## What is Token Monitor?

A desktop widget that shows live token usage across your AI coding tools — Claude Code, Codex, Hermes, OpenCode, OpenClaw, Cursor, and more — with cost breakdowns per client and per model.

It runs entirely on your own machine by default. An optional hub aggregates usage across multiple devices, including iPhones via a Cloudflare Worker.

Only summary numbers ever leave your machine. Raw prompts, source files, and conversation transcripts stay local.

## Features

- Live token tracking for Claude Code, Codex, Hermes, OpenCode, OpenClaw, and Cursor — UI updates within seconds of each turn
- Switch breakdown views — group totals by tool, device, or model
- Cost breakdown alongside token counts
- Appearance controls — adjust glass opacity/blur and window look (including transparent glass)
- Local-first — no servers needed for single-device use
- Real-time multi-device sync over Server-Sent Events (self-hosted hub or Cloudflare Worker)
- iOS widget support (Widgy, Scriptable) through the Worker hub
- Privacy-first — only summary numbers ever leave your machine

| Daily View | Devices View | Models View |
|:---:|:---:|:---:|
| ![Daily View](.github/assets/daily-view.png) | ![Devices View](.github/assets/devices-view.png) | ![Models View](.github/assets/models-view.png) | 

## Supported Tools

Token Monitor reads usage from these AI coding tools out of the box:

| Logo | Tool | Data path |
|:---:|------|-----------|
| <img src=".github/assets/tools-icon/claude.png" width="28" alt="Claude Code" /> | Claude Code | `~/.claude/projects/`, `~/.claude/transcripts/` |
| <img src=".github/assets/tools-icon/codex.png" width="28" alt="Codex" /> | Codex | `~/.codex/sessions/` |
| <img src=".github/assets/tools-icon/opencode.png" width="28" alt="OpenCode" /> | OpenCode | `~/.local/share/opencode/` |
| <img src=".github/assets/tools-icon/hermes-agent.png" width="28" alt="Hermes" /> | Hermes | `$HERMES_HOME` or `~/.hermes/` |
| <img src=".github/assets/tools-icon/openclaw.png" width="28" alt="OpenClaw" /> | OpenClaw | `~/.openclaw/agents/` |
| <img src=".github/assets/tools-icon/cursor.png" width="28" alt="Cursor" /> | Cursor | `~/.config/tokscale/cursor-cache/` (populated by `tokscale cursor pull`) |

Detection and parsing are handled by [tokscale](https://github.com/junhoyeo/tokscale).

## Installation

### 1. Single device — Local mode

The default. No hub, no agent, no config.

```bash
npm install
npm start
```

Usage is read live from your local AI client directories — see the [Supported Tools](#supported-tools) table for the full list of paths. The widget updates the moment those files change, with a 5-minute fallback poll.

### 2. Multiple devices on your network — Self-hosted hub

Run the hub once on a machine that stays on, then open the widget on each device and point it at the hub.

```bash
# on the always-on machine
cp config.example.json config.local.json
# set hub.secret to something private, then:
npm run hub

# on every device that should contribute or display usage
npm start
# Settings → Multi-device Sync → fill in Hub URL + Secret, Save
```

When sync mode is active the widget contributes this device's usage automatically. Run `npm run agent` only if you want a headless agent on a machine without a widget.

See [docs/API.md](docs/API.md) for the hub HTTP API reference.

### 3. Across networks, including iPhone — Cloudflare Worker hub

A Worker-based deployment that speaks the same protocol as the Node hub.
Public HTTPS, no always-on machine, free tier covers small-team usage,
reachable from Widgy / Scriptable on iOS.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Javis603/token-monitor/tree/main/worker)

One-click deploy — Cloudflare will prompt for the `TOKEN_MONITOR_SECRET` during setup. Or deploy manually:

```bash
cd worker
npm install
npx wrangler login
npx wrangler secret put TOKEN_MONITOR_SECRET
npx wrangler deploy
```

Wrangler prints the deployed URL — paste it into each device's widget at Settings → Multi-device Sync. The widget contributes usage automatically; a standalone agent is only needed on machines without a widget.

See [worker/README.md](worker/README.md) for full deploy notes, the iOS widget
recipe, and endpoint reference.

## How it works

```text
Mode A — Local (default, no setup)
    widget (Electron) ──▶ tokscale ──▶ ~/.claude, ~/.codex, $HERMES_HOME

Mode B — Sync (opt-in, multi-device)
    device A agent ──▶
    device B agent ──▶  hub  ──▶  widget on any device
    device C agent ──▶
```

The widget switches modes automatically based on whether a Hub URL is set in settings. There is no separate "mode" toggle. In sync mode the hub pushes aggregated stats to every connected widget over Server-Sent Events, so updates on one device appear on the others within a few seconds.

## Settings

### Widget (GUI)

Click the `⚙` button in the widget header to open the Settings panel.

- **Multi-device Sync** — Hub URL and secret. Leave Hub URL empty to run in local mode (this device only).
- **Tracked Tools** — checkboxes for each supported AI tool. Toggles take effect immediately and restart the collector with the new client list.
- **Appearance** — system glass, live dot, glass opacity, and glass blur.
- **Advanced** — opens the underlying `settings.json` for less-common options like `allTimeSince`.

The pin button in the widget header toggles "always on top".

### Headless agent (`npm run agent`)

The agent has no UI. Configure it via `config.local.json` at the project root:

```json
{
  "agent": {
    "hubUrl": "https://your-hub.example.com",
    "secret": "your-secret",
    "deviceId": "my-server",
    "clients": "claude,codex,hermes,opencode,openclaw,cursor",
    "intervalMs": 300000,
    "allTimeSince": "2024-01-01"
  }
}
```

Every field can be overridden by an environment variable or CLI flag — useful for systemd / launchd / Docker. Precedence (highest first): CLI flag → env var → `config.local.json` → built-in default.

| Field        | CLI flag                | Environment variable               |
|--------------|-------------------------|------------------------------------|
| `hubUrl`     | `--hub=<url>`           | `TOKEN_MONITOR_HUB_URL`            |
| `secret`     | `--secret=<value>`      | `TOKEN_MONITOR_SECRET`             |
| `deviceId`   | `--device=<id>`         | `TOKEN_MONITOR_DEVICE_ID`          |
| `clients`    | `--clients=<csv>`       | `TOKEN_MONITOR_CLIENTS`            |
| `intervalMs` | `--interval=<ms>`       | `TOKEN_MONITOR_INTERVAL_MS`        |

Example one-off run with a custom client set:

```bash
npm run agent -- --clients=claude,codex,opencode --once
```

> The widget (GUI) stores its settings in Electron's userData directory (`settings.json`) and only falls back to `config.local.json` for fields it has not been told about through the UI. Changes made in the headless agent's `config.local.json` are therefore visible to a fresh widget install but won't override existing widget settings.

## Privacy

The hub and agent only transmit summary fields:

- device id, hostname, platform
- total tokens per period (today / month / all-time)
- cost totals (when `tokscale` returns cost data)
- per-client and per-model breakdowns

They do not transmit raw AI logs, prompts, source code, or conversation
content. `config.local.json`, `data/`, and `node_modules/` are gitignored.

## Requirements

- macOS or Windows
- Node.js 18.17+
- For sync mode only: network reachability from each agent/widget to the hub

## Acknowledgments

- [tokscale](https://github.com/junhoyeo/tokscale) for log parsing and token accounting.

## License

[MIT](LICENSE) © [@Javis](https://github.com/Javis603)
