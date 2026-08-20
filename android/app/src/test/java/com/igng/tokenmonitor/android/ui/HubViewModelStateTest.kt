package com.igng.tokenmonitor.android.ui

import com.igng.tokenmonitor.android.data.model.DeviceDto
import com.igng.tokenmonitor.android.data.model.HistoryDto
import com.igng.tokenmonitor.android.data.model.StatsDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HubViewModelStateTest {
  @Test
  fun statsSnapshotKeepsDevicesAndInvalidatesFullHistoryByRevision() {
    val oldHistory = HistoryDto(summary = com.igng.tokenmonitor.android.data.model.HistorySummaryDto(totalTokens = 10.0))
    val preview = HistoryDto(summary = com.igng.tokenmonitor.android.data.model.HistorySummaryDto(totalTokens = 20.0))
    val newDevice = DeviceDto(deviceId = "new")
    val previous = HubUiState(
      stats = StatsDto(historyRevision = "old", subscriptionsUpdatedAt = "sub-old"),
      history = oldHistory,
      devices = listOf(DeviceDto(deviceId = "old"))
    )
    val next = StatsDto(
      devices = listOf(newDevice),
      historyPreview = preview,
      historyRevision = "new",
      subscriptionsUpdatedAt = "sub-new"
    )

    val merged = mergeStatsSnapshot(previous, next)

    assertEquals(listOf(newDevice), merged.state.devices)
    assertEquals(preview, merged.state.history)
    assertTrue(merged.historyChanged)
    assertTrue(merged.subscriptionsChanged)
  }

  @Test
  fun legacyStatsWithoutRevisionDoNotDiscardLoadedFullHistory() {
    val oldHistory = HistoryDto(summary = com.igng.tokenmonitor.android.data.model.HistorySummaryDto(totalTokens = 10.0))
    val preview = HistoryDto(summary = com.igng.tokenmonitor.android.data.model.HistorySummaryDto(totalTokens = 20.0))
    val previous = HubUiState(
      stats = StatsDto(historyRevision = null),
      history = oldHistory
    )

    val merged = mergeStatsSnapshot(previous, StatsDto(historyPreview = preview))

    assertEquals(oldHistory, merged.state.history)
    assertFalse(merged.historyChanged)
  }
}
