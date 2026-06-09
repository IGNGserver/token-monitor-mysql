# API

The hub exposes a small JSON HTTP API.

## Authentication

All endpoints except `/api/health` require the configured shared secret.

Use either:

```http
Authorization: Bearer <secret>
```

or:

```http
X-Token-Monitor-Secret: <secret>
```

## `GET /api/health`

Health check. Does not require authentication.

Example response:

```json
{
  "ok": true,
  "role": "hub",
  "version": 1,
  "deviceCount": 2,
  "secretRequired": true,
  "now": "2026-05-18T00:00:00.000Z"
}
```

## `POST /api/ingest`

Posts one device usage summary.

Example payload:

```json
{
  "deviceId": "macbook",
  "hostname": "macbook.local",
  "platform": "darwin-arm64",
  "updatedAt": "2026-05-18T00:00:00.000Z",
  "agentVersion": "0.3.0",
  "agentRuntime": "headless-agent",
  "trackedClients": ["codex"],
    "today": {
    "totalTokens": 1234,
    "costUsd": 0.01,
    "cacheReadTokens": 1100,
    "cacheWriteTokens": 0,
    "outputTokens": 34,
    "clients": {
      "codex": 1234
    },
    "clientCosts": {
      "codex": 0.01
    },
    "clientCacheReads": {
      "codex": 1100
    },
    "clientCacheWrites": {
      "codex": 0
    },
    "clientOutputs": {
      "codex": 34
    },
    "models": {
      "gpt-5": 1234
    },
    "modelCosts": {
      "gpt-5": 0.01
    },
    "modelCacheReads": {
      "gpt-5": 1100
    },
    "modelCacheWrites": {
      "gpt-5": 0
    },
    "modelOutputs": {
      "gpt-5": 34
    },
    "clientModels": {
      "codex": {
        "gpt-5": 1234
      }
    },
    "clientModelCosts": {
      "codex": {
        "gpt-5": 0.01
      }
    },
    "sessions": {
      "codex:rollout-2026-05-30T11-44-50-abc": {
        "client": "codex",
        "sessionId": "rollout-2026-05-30T11-44-50-abc",
        "totalTokens": 1234,
        "costUsd": 0.01,
        "messageCount": 3,
        "inputTokens": 100,
        "outputTokens": 34,
        "cacheReadTokens": 1100,
        "cacheWriteTokens": 0,
        "reasoningTokens": 0,
        "startedAt": "2026-05-30T03:44:50.000Z",
        "lastUsedAt": "2026-05-30T04:07:32.679Z",
        "models": {
          "gpt-5": 1234
        },
        "modelCosts": {
          "gpt-5": 0.01
        },
        "providers": {
          "openai": 1234
        }
      }
    }
  },
  "month": {
    "totalTokens": 4567,
    "costUsd": 0.04,
    "clients": {},
    "clientCosts": {}
  },
  "allTime": {
    "totalTokens": 8901,
    "costUsd": 0.08,
    "clients": {},
    "clientCosts": {}
  },
  "limits": {
    "updatedAt": "2026-05-18T00:00:00.000Z",
    "refreshMs": 300000,
    "providers": [
      {
        "provider": "claude",
        "accountKey": "sha256:...",
        "status": "ok",
        "updatedAt": "2026-05-18T00:00:00.000Z",
        "windows": [
          {
            "kind": "session",
            "usedPercent": 42,
            "remainingPercent": 58,
            "resetsAt": "2026-05-18T05:00:00.000Z"
          },
          {
            "kind": "weekly",
            "usedPercent": 20,
            "remainingPercent": 80,
            "resetsAt": "2026-05-25T00:00:00.000Z"
          }
        ]
      }
    ]
  }
}
```

The hub normalizes records before storing them.

`trackedClients` is optional but recommended for agents and widgets. When it is present, the hub treats omitted clients as intentionally not collected in this payload and preserves their previous usage for that device. This keeps "tracking" as "collect future data" rather than "hide existing history".

`limits` is optional. Agents and widgets include it when AI Tool Limits detection is enabled. Raw OAuth credentials, access tokens, refresh tokens, emails, and provider response bodies must never be sent.

`limits.providers[].provider` is one of `claude`, `codex`, `cursor`, `antigravity`, `opencode`, or `deepseek`.
`limits.providers[].source` is one of `oauth`, `cli`, `web`, `rpc`, `local`, or `api`; `local` means the value was read from an on-disk store such as OpenCode Go usage from `opencode.db`, and `api` means a provider HTTP API authenticated by an API key (DeepSeek).
`limits.providers[].balanceUsd` is an optional prepaid credit balance in USD (OpenCode Zen); `null` when the provider has no balance concept or none could be read. A genuine `0` (no remaining credit) is distinct from `null`.
`limits.providers[].balance` is an optional native-currency prepaid balance block `{ amount, currency, todaySpend, monthSpend, monthSinceTracking }` used by pay-as-you-go providers (DeepSeek). `amount` is the spendable balance in the account's own currency (e.g. `CNY`/`USD`); `todaySpend`/`monthSpend` are derived from balance history (paid drawdown only); `monthSinceTracking` is `true` until a full month of history has accrued. `null` when not applicable. DeepSeek uses `source: "api"` with an empty `windows` array (it has no rate-limit windows).
`windows[].kind` is `session`, `weekly`, or `billing`.

## `GET /api/stats`

Returns aggregate stats for the widget.

Response includes:

- `periods.today`
- `periods.month`
- `periods.allTime`
- `periods.*.clientModels` and `periods.*.clientModelCosts` for preserving model breakdowns when a tracked tool is disabled
- `periods.*.sessions` keyed by `client:sessionId` for session-level usage when tokscale exposes session groups; widgets may use `lastUsedAt` for recent-first sorting when present
- `limits.providers` aggregated by provider account
- `devices`
- stale status for devices that have not reported recently

If multiple devices report the same provider account, the hub keeps the freshest valid limits status for that account. Public Worker stats omit account identifiers.

## `GET /api/devices`

Returns normalized records for all stored devices.

## `DELETE /api/devices/:id`

Deletes one device record from the hub store.

This is useful after renaming a device id.
