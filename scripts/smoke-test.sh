#!/bin/sh
set -eu

HUB_URL="${HUB_URL:-http://127.0.0.1:${TOKEN_MONITOR_PORT:-17321}}"
: "${TOKEN_MONITOR_SECRET:?Set TOKEN_MONITOR_SECRET before running this smoke test}"
AUTH="Authorization: Bearer ${TOKEN_MONITOR_SECRET}"
MODEL="${SMOKE_MODEL:-gpt-5}"
DEVICE_ID="smoke-$(date +%s)"

curl -fsS -H "$AUTH" -H 'content-type: application/json' -X POST "$HUB_URL/api/ingest" \
  --data "{\"deviceId\":\"$DEVICE_ID\",\"hostname\":\"docker-smoke\",\"platform\":\"linux\",\"updatedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"allTime\":{\"totalTokens\":1000,\"clients\":{\"codex\":1000},\"models\":{\"$MODEL\":1000},\"clientModels\":{\"codex\":{\"$MODEL\":1000}}},\"today\":{\"totalTokens\":1000},\"month\":{\"totalTokens\":1000}}" >/dev/null

curl -fsS -H "$AUTH" "$HUB_URL/api/stats" >/dev/null
curl -fsS -H "$AUTH" -H 'content-type: application/json' -X PUT "$HUB_URL/api/pricing/$MODEL" \
  --data '{"inputPricePerMillion":1,"outputPricePerMillion":2,"cacheReadPricePerMillion":0.1,"cacheWritePricePerMillion":0.2}' >/dev/null
curl -fsS -H "$AUTH" -X POST "$HUB_URL/api/pricing/$MODEL/fetch-upstream" >/dev/null

printf 'Smoke test passed against %s\n' "$HUB_URL"
