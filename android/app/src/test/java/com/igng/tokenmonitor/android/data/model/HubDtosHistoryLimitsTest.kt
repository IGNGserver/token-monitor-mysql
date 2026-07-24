package com.igng.tokenmonitor.android.data.model

import kotlinx.serialization.json.Json
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
            "activeTimeMs": 30000
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
}
