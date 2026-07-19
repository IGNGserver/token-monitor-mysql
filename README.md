# Token Monitor MySQL Hub

Token Monitor MySQL Hub is a self-hosted usage monitor for AI coding tools. It collects token and cost summaries from the desktop widget or headless agents, keeps them in a MySQL-backed Hub, and makes the current data available on desktop and Android.

## Relationship to Upstream

This repository is a fork of [Javis603/token-monitor](https://github.com/Javis603/token-monitor). It retains the upstream Electron widget and local collector foundation, and is distributed under the original [MIT License](LICENSE).

This fork changes the server-side deployment model and adds a mobile client:

- MySQL replaces the Node Hub's JSON-file storage.
- Each change between two device snapshots is retained as an append-only usage event.
- Model prices can be managed in the Hub, and each event receives an immutable price snapshot when it is recorded.
- Docker Compose deploys the Hub and MySQL together.
- `android/` contains a native Android client for viewing the Hub and managing prices.

The optional Cloudflare Worker under `worker/` remains compatible with the original protocol, but it does **not** use MySQL and does not provide this fork's event-ledger or Hub pricing features.

## What It Monitors

The desktop collector uses [tokscale](https://github.com/junhoyeo/tokscale) to summarize local usage for supported AI coding tools, including Claude Code, Codex, OpenCode, Hermes, Cursor, Antigravity, and others supported by the upstream project. It tracks token totals, available cost data, client/model breakdowns, sessions where available, project rollups, and optional provider quota windows.

The Hub records changes between cumulative device snapshots. It does not parse prompts, source code, raw conversations, or individual provider API requests.

## Choose a Setup

| Goal | Recommended setup |
| --- | --- |
| Monitor one computer only | Run the Electron widget in local mode. No Hub, Docker, or database is required. |
| Monitor several computers | Deploy the MySQL Hub on an always-on Linux server, then connect each widget or headless agent. |
| View Hub data on a phone | Deploy the MySQL Hub, then build/install the Android client and enter the Hub URL and shared secret. |

## Deploy the MySQL Hub

Deploy this part on a server that can run Docker and is reachable by every device you want to collect from. The Hub listens on port `17321` by default.

### Requirements

- Docker Engine with Docker Compose v2
- A server reachable from your desktops and Android device
- A firewall rule that permits trusted clients to reach the Hub port, or a reverse proxy/VPN that provides that access

### Start the stack

Clone this repository on the server, then create its local configuration:

```bash
cp .env.example .env
```

Edit `.env` and set strong, unique values for at least these variables:

```dotenv
TOKEN_MONITOR_SECRET=replace-with-a-long-random-shared-secret
MYSQL_PASSWORD=replace-with-a-strong-app-password
MYSQL_ROOT_PASSWORD=replace-with-a-strong-root-password
```

Optionally change `TOKEN_MONITOR_PORT` if port `17321` is already in use. Do not commit `.env` or share the secret in screenshots, issues, or messages.

Start the Hub and MySQL:

```bash
docker compose up -d --build
docker compose ps
```

Check that the Hub is healthy:

```bash
curl http://127.0.0.1:17321/api/health
```

The health endpoint is intentionally unauthenticated. All other Hub endpoints require the shared secret through `Authorization: Bearer <secret>` or `X-Token-Monitor-Secret: <secret>`.

To upgrade after pulling new code, rebuild the Hub image. Database migrations run before the Hub starts.

```bash
git pull
docker compose up -d --build
docker compose logs -f hub
```

MySQL data lives in the named Docker volume `token-monitor-mysql`; recreating the Hub container does not erase it. Do not run `docker compose down -v` unless you intentionally want to remove all Hub data.

## Connect a Desktop Collector

### Electron widget

Install or build the desktop widget as described in [Build from source](#build-from-source), then open **Settings -> Multi-device Sync**.

1. Select **Connect to a hub**.
2. Enter the full Hub URL, for example `http://your-server:17321`.
3. Enter the same `TOKEN_MONITOR_SECRET` configured on the server.
4. Save settings.

The widget continues collecting its local usage and posts that device's summaries to the Hub. It receives aggregate updates through Server-Sent Events.

### Headless agent

Use the agent on machines where you do not need the Electron interface. Install Node.js 22.13 or later and the project dependencies, copy `.env.example` to `.env`, then configure these values:

```env
TOKEN_MONITOR_HUB_URL=http://your-server:17321
TOKEN_MONITOR_SECRET=the-same-secret-used-by-the-hub
TOKEN_MONITOR_DEVICE_ID=optional-stable-device-name
TOKEN_MONITOR_SYNC_UPLOAD_INTERVAL_MS=0
TOKEN_MONITOR_CLIENTS=
TOKEN_MONITOR_PROJECTS_ENABLED=
TOKEN_MONITOR_HISTORY_ENABLED=
TOKEN_MONITOR_SESSION_USAGE_ARCHIVE_ENABLED=
TOKEN_MONITOR_LIMITS_ENABLED=
TOKEN_MONITOR_LIMIT_PROVIDERS=
```

Leave optional values empty to use the defaults. `TOKEN_MONITOR_CLIENTS` accepts a comma-separated list; set it to an empty value to disable token collection. `TOKEN_MONITOR_HISTORY_ENABLED=0` disables local trend collection, and `TOKEN_MONITOR_LIMITS_ENABLED=0` skips AI-provider limit probing. See `.env.example` for every supported configuration key and its detailed description.

Run a one-time collection:

```bash
npm ci
npm run agent:once
```

Run continuously instead:

```bash
npm run agent
```

Use your operating system's service manager or scheduler to keep the continuous agent running. For a read-only check that does not post data, run:

```bash
node src/agent/agent.js --once --dry-run
```

## Use the Android Client

The Android app is a Hub client: it does not collect local AI-tool usage and does not write usage events itself. It shows the aggregate overview, models, currently available sessions, devices, pricing, and Hub connection settings.

Build a debug APK with a local Android SDK and JDK 17 or later:

```bash
cd android
./gradlew test
./gradlew assembleDebug
```

The APK is written to:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

After installing it, open **Settings** in the app and enter the Hub URL and `TOKEN_MONITOR_SECRET`. The connection values are stored in Android encrypted shared preferences.

Session screens show the current sessions exposed by `/api/stats`. The Hub does not currently expose a time-range event-history endpoint for one individual session, so the Android app cannot show a fine-grained historical session timeline.

## Manage Model Pricing

The Hub keeps a current price table for models and exposes it to connected clients. You can set prices manually or ask the Hub to obtain an upstream price with `tokscale pricing`, falling back to the configurable `models.dev` catalog when needed.

Useful authenticated endpoints:

```text
GET  /api/pricing
PUT  /api/pricing/:model
POST /api/pricing/:model/fetch-upstream
POST /api/pricing/fetch-upstream-all
```

Manual prices use USD per million tokens:

```bash
curl -X PUT "http://your-server:17321/api/pricing/gpt-5" \
  -H "Authorization: Bearer $TOKEN_MONITOR_SECRET" \
  -H "Content-Type: application/json" \
  --data '{"inputPricePerMillion":2.5,"outputPricePerMillion":10,"cacheReadPricePerMillion":0.25,"cacheWritePricePerMillion":3.75}'
```

When an ingest event is stored, the Hub copies the active price values, source, and timestamp into that event and calculates its cost. Updating a model's current price never recalculates historical events. If no Hub price exists, the Hub preserves tokscale's cost delta as a `payload_fallback` instead of inventing a zero cost.

## Storage and Retention

`usage_events` is an append-only ledger. An event means the usage difference observed between two cumulative reports from a device; `recorded_at` is the report-recording time, not an exact provider request time.

Deleting a device through `DELETE /api/devices/:id` removes its current device record and mutable session rollup, but retains historical usage events. Their device reference becomes `null`, preserving the audit trail.

## Local Development and Verification

The Node project requires Node.js 22.13 or later.

```bash
npm ci
npm run verify
```

Run the Hub without Docker when MySQL is already available and configured through `.env`:

```bash
npm run migrate
npm run hub
```

For the Docker-backed MySQL integration test:

```bash
docker compose -f docker-compose.test.yml up -d
npm run test:mysql
```

For an end-to-end deployment check, start the production stack, export the shared secret in your shell, then run:

```bash
export TOKEN_MONITOR_SECRET=your-secret
./scripts/smoke-test.sh
```

## Build from Source

The Electron widget requires Node.js 22.13 or later.

```bash
npm ci
npm start
```

Common commands:

```bash
npm start          # Electron widget
npm run hub        # Node Hub
npm run agent      # continuous headless collector
npm run agent:once # one collection and upload
npm run verify     # lint and Node test suite
```

## Privacy

The collector sends normalized usage summaries: device metadata, token/cost totals, client/model breakdowns, optional project rollups, and optional AI-tool limit status. It does not send raw AI logs, prompts, source code, conversations, OAuth credentials, refresh tokens, or provider response bodies.

Keep the Hub private to trusted users. Prefer HTTPS through a reverse proxy or a private network such as a VPN when clients connect over the internet.

## Acknowledgments

- [Javis603/token-monitor](https://github.com/Javis603/token-monitor) for the original Token Monitor project.
- [tokscale](https://github.com/junhoyeo/tokscale) for log parsing and token accounting.
- [CodexBar](https://github.com/steipete/CodexBar) for AI Tool Limits research.

## License

[MIT](LICENSE) © [@Javis](https://github.com/Javis603)
