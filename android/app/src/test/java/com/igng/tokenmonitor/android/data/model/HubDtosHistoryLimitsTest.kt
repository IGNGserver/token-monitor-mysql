package com.igng.tokenmonitor.android.data.model

import kotlinx.serialization.json.Json
import com.igng.tokenmonitor.android.ui.more.availableSessions
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class HubDtosHistoryLimitsTest {
  private val json = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
  }

  @Test
  fun customRangeParsesClaudeDesktopProjectsAndSessions() {
    val body = """
      {
        "source": "history_daily+local-details",
        "totalTokens": 180,
        "clients": { "claude-desktop": 180 },
        "clientModels": { "claude-desktop": { "claude-sonnet": 180 } },
        "projects": {
          "demo": { "label": "demo", "tokens": 180, "clients": { "claude-desktop": 180 } }
        },
        "sessions": {
          "claude-desktop:abc": {
            "client": "claude-desktop",
            "sessionId": "abc",
            "projectLabel": "demo",
            "totalTokens": 180
          }
        }
      }
    """.trimIndent()

    val range = json.decodeFromString(UsageRangeDto.serializer(), body)

    assertEquals(180L, range.clients["claude-desktop"])
    assertEquals("demo", range.projects["demo"]?.label)
    assertEquals("claude-desktop", range.sessions["claude-desktop:abc"]?.client)
  }

  @Test
  fun statsParsesHistoryPreviewAndLimits() {
    val body = """
      {
        "staleAfterMs": 600000,
        "periods": {
          "today": { "totalTokens": 1200, "costUsd": 0.12, "clients": {"codex": 800}, "clientCosts": {"codex": 0.08}, "models": {}, "modelCosts": {}, "sessions": {} },
          "month": { "totalTokens": 5000, "costUsd": 1.2 },
          "allTime": { "totalTokens": 9000, "costUsd": 3.4 }
        },
        "devices": [],
        "historyPreview": {
          "daily": [
            { "date": "2026-07-20", "tokens": 100, "cost": 0.01, "activeTimeMs": 1000 },
            { "date": "2026-07-21", "tokens": 200, "cost": 0.02, "activeTimeMs": 2000 }
          ],
          "monthly": [
            { "month": "2026-06", "tokens": 1000, "cost": 1.0, "activeTimeMs": 10000 },
            { "month": "2026-07", "tokens": 2000, "cost": 2.0, "activeTimeMs": 20000 }
          ],
          "summary": {
            "totalTokens": 3000,
            "totalCost": 3.0,
            "activeDays": 12,
            "currentStreak": 3,
            "longestStreak": 7,
            "peakDayTokens": 500,
            "favoriteModel": "gpt-5",
            "messages": 40,
            "activeTimeMs": 30000,
            "timeMetrics": {
              "totalActiveTimeMs": 30000,
              "longestContinuousMs": 12000,
              "maxConcurrentSessions": 2,
              "sessionCount": 8
            }
          }
        },
        "limits": {
          "updatedAt": "2026-07-21T12:00:00.000Z",
          "refreshMs": 300000,
          "providers": [
            {
              "provider": "claude",
              "status": "ok",
              "balanceUsd": 12.5,
              "windows": [
                { "kind": "session", "usedPercent": 42, "remainingPercent": 58, "resetsAt": "2026-07-21T18:00:00.000Z", "showMeter": true },
                { "kind": "weekly", "usedPercent": 20, "remainingPercent": 80, "showMeter": true }
              ]
            },
            {
              "provider": "deepseek",
              "status": "ok",
              "balance": { "amount": 8.0, "currency": "CNY" },
              "windows": []
            }
          ]
        }
      }
    """.trimIndent()

    val stats = json.decodeFromString(StatsDto.serializer(), body)
    assertNotNull(stats.historyPreview)
    assertEquals(2, stats.historyPreview!!.daily.size)
    assertEquals("2026-07-21", stats.historyPreview!!.daily.last().date)
    assertEquals(200.0, stats.historyPreview!!.daily.last().tokens, 0.001)
    assertEquals(2, stats.historyPreview!!.monthly.size)
    assertEquals(3.0, stats.historyPreview!!.summary.currentStreak, 0.001)
    assertEquals("gpt-5", stats.historyPreview!!.summary.favoriteModel)
    assertEquals(12000.0, stats.historyPreview!!.summary.timeMetrics!!.longestContinuousMs, 0.001)
    assertEquals(2.0, stats.historyPreview!!.summary.timeMetrics!!.maxConcurrentSessions, 0.001)

    assertNotNull(stats.limits)
    assertEquals(2, stats.limits!!.providers.size)
    val claude = stats.limits!!.providers.first { it.provider == "claude" }
    assertEquals(12.5, claude.balanceUsd!!, 0.001)
    assertEquals(2, claude.windows.size)
    assertEquals(42.0, claude.windows.first().usedPercent!!, 0.001)
    val deepseek = stats.limits!!.providers.first { it.provider == "deepseek" }
    assertEquals(8.0, deepseek.balance!!.amount!!, 0.001)
    assertEquals("CNY", deepseek.balance!!.currency)
  }

  @Test
  fun deviceParsesOptionalLimits() {
    val body = """
      {
        "deviceId": "abc",
        "hostname": "laptop",
        "stale": false,
        "periods": { "today": { "totalTokens": 10 } },
        "limits": {
          "providers": [
            {
              "provider": "codex",
              "windows": [{ "kind": "session", "usedPercent": 10, "showMeter": true }]
            }
          ]
        }
      }
    """.trimIndent()
    val device = json.decodeFromString(DeviceDto.serializer(), body)
    assertEquals("laptop", device.hostname)
    assertEquals(1, device.limits!!.providers.size)
    assertEquals("codex", device.limits!!.providers.single().provider)
    assertTrue(device.limits!!.providers.single().windows.single().showMeter)
  }

  @Test
  fun deviceParsesOsFields() {
    val body = """
      {
        "deviceId": "abc",
        "hostname": "laptop",
        "platform": "win32",
        "osName": "Windows",
        "osVersion": "11",
        "agentRuntime": "widget",
        "stale": false,
        "periods": { "today": { "totalTokens": 10 } }
      }
    """.trimIndent()
    val device = json.decodeFromString(DeviceDto.serializer(), body)
    assertEquals("Windows", device.osName)
    assertEquals("11", device.osVersion)
    assertEquals("widget", device.agentRuntime)
  }

  @Test
  fun deviceParsesRuntimeStatusAndProjects() {
    val body = """
      {
        "deviceId": "dev-1",
        "hostname": "box",
        "platform": "win32",
        "osName": "Windows",
        "osVersion": "11",
        "agentRuntime": "headless-agent",
        "clientStatus": { "codex": "active", "cursor": "missing" },
        "wslStatus": { "state": "active", "detected": ["codex"], "withData": ["codex"] },
        "periods": {
          "today": {
            "totalTokens": 12,
            "costUsd": 0.2,
            "projects": {
              "p1": { "label": "token-monitor", "tokens": 12, "costUsd": 0.2, "clients": { "codex": 12 } }
            },
            "sessions": {
              "codex:abc": {
                "client": "codex",
                "sessionId": "abc",
                "projectLabel": "token-monitor",
                "totalTokens": 12,
                "costUsd": 0.2
              }
            },
            "clientModels": { "codex": { "gpt-5": 12 } },
            "clientModelCosts": { "codex": { "gpt-5": 0.2 } }
          }
        },
        "limits": {
          "providers": [{
            "provider": "openrouter",
            "balanceUsd": 3.5,
            "balance": { "amount": 20.0, "currency": "USD", "monthSpend": 5.0 },
            "resetCredits": { "availableCount": 1, "totalCount": 3 },
            "windows": [{ "kind": "weekly", "remainingPercent": 55.0, "metric": "credits", "showMeter": true }]
          }]
        }
      }
    """.trimIndent()
    val device = json.decodeFromString(DeviceDto.serializer(), body)
    assertEquals("headless-agent", device.agentRuntime)
    assertEquals("active", device.clientStatus["codex"])
    assertEquals("active", device.wslStatus?.state)
    assertEquals("token-monitor", device.periods.today.projects["p1"]?.label)
    assertEquals("token-monitor", device.periods.today.sessions["codex:abc"]?.projectLabel)
    assertEquals(12L, device.periods.today.clientModels["codex"]?.get("gpt-5"))
    assertEquals(0.2, device.periods.today.clientModelCosts["codex"]?.get("gpt-5") ?: -1.0, 0.001)
    assertEquals(3.5, device.limits?.providers?.first()?.balanceUsd)
    assertEquals(5.0, device.limits?.providers?.first()?.balance?.monthSpend)
    assertEquals(1.0, device.limits?.providers?.first()?.resetCredits?.availableCount)
    assertEquals("credits", device.limits?.providers?.first()?.windows?.first()?.metric)
  }

  @Test
  fun statsParsesVersion045DiagnosticsComponentsAndRevisions() {
    val body = """
      {
        "updatedAt": "2026-08-20T08:00:00.000Z",
        "historyRevision": "abc123",
        "deviceHistoryRevision": "def456",
        "subscriptionsUpdatedAt": "2026-08-19T08:00:00.000Z",
        "sessionDetailsOmitted": { "month": 2 },
        "periodProjectsOmitted": { "today": 1 },
        "periods": {
          "today": {
            "totalTokens": 100,
            "capabilities": { "tokenComponents": true },
            "cacheReadTokens": 10,
            "cacheWriteTokens": 5,
            "outputTokens": 20,
            "unclassifiedTokens": 0,
            "timedTokens": 25,
            "timedOutputTokens": 20,
            "timedDurationMs": 4000,
            "clientCacheReads": { "codex": 10 },
            "modelOutputs": { "gpt-5": 20 }
          }
        },
        "devices": [{
          "deviceId": "dev-1",
          "agentVersion": "0.45.0-rev.5",
          "trackedClients": ["codex", "commandcode"],
          "projectsEnabled": true,
          "historyAvailable": true,
          "syncUploadIntervalMs": 600000,
          "periodWindows": {
            "today": { "endsAt": "2026-08-21T00:00:00.000Z", "key": "2026-08-20" },
            "timeZone": "Asia/Shanghai"
          },
          "clientHealth": {
            "version": 1,
            "observedAt": "2026-08-20T08:00:00.000Z",
            "clients": {
              "commandcode": {
                "source": { "state": "detected", "detectedCount": 1, "checkedCount": 1, "checks": [{ "id": "commandcode-projects", "exists": true }] },
                "collection": { "state": "ok", "lastSuccessAt": "2026-08-20T08:00:00.000Z" },
                "data": { "liveTokens": 10, "lastActivityDay": "2026-08-20" },
                "overall": "healthy"
              }
            }
          }
        }]
      }
    """.trimIndent()

    val stats = json.decodeFromString(StatsDto.serializer(), body)
    assertEquals("abc123", stats.historyRevision)
    assertEquals(2L, stats.sessionDetailsOmitted["month"])
    assertEquals(10L, stats.periods.today.cacheReadTokens)
    assertEquals(4000L, stats.periods.today.timedDurationMs)
    assertEquals(20L, stats.periods.today.modelOutputs["gpt-5"])
    val device = stats.devices.single()
    assertEquals("0.45.0-rev.5", device.agentVersion)
    assertEquals("commandcode", device.trackedClients.last())
    assertEquals("Asia/Shanghai", device.periodWindows?.timeZone)
    assertEquals("healthy", device.clientHealth?.clients?.get("commandcode")?.overall)
  }

  @Test
  fun subscriptionsParseNormalizedDocument() {
    val body = """
      {
        "ok": true,
        "version": 1,
        "updatedAt": "2026-08-20T08:00:00.000Z",
        "subscriptions": [{
          "id": "sub_1",
          "provider": "codex",
          "kind": "subscription",
          "binding": { "profileName": "Personal", "accountKey": "sha256:abc", "accountEmail": "u@example.com" },
          "planName": "Plus",
          "amountMinor": 2000,
          "currency": "USD",
          "interval": "month",
          "intervalCount": 1,
          "startDate": "2026-08-01",
          "autoRenew": true,
          "updatedAt": "2026-08-20T08:00:00.000Z"
        }]
      }
    """.trimIndent()

    val document = json.decodeFromString(SubscriptionsDto.serializer(), body)
    assertEquals("2026-08-20T08:00:00.000Z", document.updatedAt)
    assertEquals("Plus", document.subscriptions.single().planName)
    assertEquals("u@example.com", document.subscriptions.single().binding.accountEmail)
    assertEquals(2000L, document.subscriptions.single().amountMinor)
  }

  @Test
  fun healthParsesHubBuildIdentity() {
    val health = json.decodeFromString(
      HealthDto.serializer(),
      """
        {
          "ok": true,
          "role": "hub",
          "runtime": "node-hub",
          "version": 1,
          "hubBuild": {
            "schemaVersion": 1,
            "runtime": "node-hub",
            "coreRevision": 4,
            "coreBuildId": "sha256:abc",
            "runtimeRevision": 2,
            "runtimeBuildId": "sha256:def"
          }
        }
      """.trimIndent()
    )
    assertEquals("node-hub", health.runtime)
    assertEquals(4, health.hubBuild?.coreRevision)
    assertEquals(2, health.hubBuild?.runtimeRevision)
  }

  @Test
  fun availableSessionsKeepsKeysAcrossPeriodsAndPrefersWidestSnapshot() {
    val today = SessionDto(sessionId = "today-only", lastUsedAt = "2026-08-20T10:00:00Z", totalTokens = 10)
    val month = SessionDto(sessionId = "shared", lastUsedAt = "2026-08-19T10:00:00Z", totalTokens = 100)
    val todayShared = month.copy(totalTokens = 20)
    val stats = StatsDto(
      periods = PeriodsDto(
        today = PeriodDto(sessions = mapOf("codex:today-only" to today, "codex:shared" to todayShared)),
        month = PeriodDto(sessions = mapOf("codex:shared" to month, "codex:month-only" to SessionDto(sessionId = "month-only")))
      )
    )

    val sessions = availableSessions(stats).toMap()
    assertEquals(3, sessions.size)
    assertEquals(100L, sessions["codex:shared"]?.totalTokens)
    assertTrue(sessions.containsKey("codex:month-only"))
  }
}
