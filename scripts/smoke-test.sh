#!/bin/sh
set -eu

HUB_URL="${HUB_URL:-http://127.0.0.1:${TOKEN_MONITOR_PORT:-17321}}"
: "${TOKEN_MONITOR_SECRET:?Set TOKEN_MONITOR_SECRET before running this smoke test}"
AUTH="Authorization: Bearer ${TOKEN_MONITOR_SECRET}"
MODEL="${SMOKE_MODEL:-gpt-5}"
DEVICE_ID="smoke-$(date +%s)"

post_snapshot() {
  tokens="$1"
  now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  curl -fsS -H "$AUTH" -H 'content-type: application/json' -X POST "$HUB_URL/api/ingest" \
    --data "{\"deviceId\":\"$DEVICE_ID\",\"hostname\":\"docker-smoke\",\"platform\":\"linux\",\"updatedAt\":\"$now\",\"allTime\":{\"totalTokens\":$tokens,\"clients\":{\"codex\":$tokens},\"models\":{\"$MODEL\":$tokens},\"clientModels\":{\"codex\":{\"$MODEL\":$tokens}},\"sessions\":{\"codex:smoke-session\":{\"client\":\"codex\",\"sessionId\":\"smoke-session\",\"totalTokens\":$tokens,\"inputTokens\":$tokens,\"models\":{\"$MODEL\":$tokens},\"lastUsedAt\":\"$now\",\"startedAt\":\"$now\"}}},\"today\":{\"totalTokens\":$tokens},\"month\":{\"totalTokens\":$tokens}}" >/dev/null
}

post_snapshot 1000

stats="$(curl -fsS -H "$AUTH" "$HUB_URL/api/stats")"
printf '%s' "$stats" | node -e '
  let body = "";
  process.stdin.on("data", (chunk) => { body += chunk; });
  process.stdin.on("end", () => {
    const stats = JSON.parse(body);
    const deviceId = process.argv[1];
    if (stats?.periods?.allTime?.totalTokens < 1000 || !stats.devices?.some((device) => device.deviceId === deviceId)) process.exit(1);
  });
' "$DEVICE_ID"

manual="$(curl -fsS -H "$AUTH" -H 'content-type: application/json' -X PUT "$HUB_URL/api/pricing/$MODEL" \
  --data '{"inputPricePerMillion":1,"outputPricePerMillion":2,"cacheReadPricePerMillion":0.1,"cacheWritePricePerMillion":0.2}')"
printf '%s' "$manual" | node -e '
  let body = "";
  process.stdin.on("data", (chunk) => { body += chunk; });
  process.stdin.on("end", () => {
    const result = JSON.parse(body);
    if (result?.pricing?.source !== "manual" || result.pricing.inputPricePerMillion !== 1) process.exit(1);
  });
'

# This second snapshot exercises price lookup at ingest time after manual pricing exists.
post_snapshot 2000

upstream="$(curl -fsS -H "$AUTH" -X POST "$HUB_URL/api/pricing/$MODEL/fetch-upstream")"
printf '%s' "$upstream" | node -e '
  let body = "";
  process.stdin.on("data", (chunk) => { body += chunk; });
  process.stdin.on("end", () => {
    const result = JSON.parse(body);
    if (result?.pricing?.source !== "tokscale_upstream") process.exit(1);
  });
'

printf 'Smoke test passed against %s\n' "$HUB_URL"
