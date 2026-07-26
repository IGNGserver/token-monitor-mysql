package com.igng.tokenmonitor.android.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.igng.tokenmonitor.android.data.model.HistoryDayDto
import java.time.LocalDate
import java.time.ZoneOffset
import kotlin.math.ceil
import kotlin.math.max

enum class HeatmapMetric { Tokens, Cost }

fun heatmapValue(day: HistoryDayDto, metric: HeatmapMetric): Double =
  when (metric) {
    HeatmapMetric.Cost -> max(0.0, day.cost)
    HeatmapMetric.Tokens -> max(0.0, day.tokens)
  }

fun historyDailyForHeatmap(daily: List<HistoryDayDto>, days: Int = 90): List<HistoryDayDto> {
  if (daily.isEmpty() || days <= 0) return emptyList()
  val byDate = daily.associateBy { it.date }
  val end = daily.mapNotNull {
    runCatching { LocalDate.parse(it.date) }.getOrNull()
  }.maxOrNull() ?: LocalDate.now(ZoneOffset.UTC)
  val start = end.minusDays((days - 1).toLong())
  return generateSequence(start) { current ->
    val next = current.plusDays(1)
    if (next.isAfter(end)) null else next
  }.map { date ->
    val key = date.toString()
    byDate[key] ?: HistoryDayDto(date = key)
  }.toList()
}

private fun heatLevel(value: Double, maxValue: Double): Int {
  if (value <= 0.0 || maxValue <= 0.0) return 0
  val ratio = value / maxValue
  return when {
    ratio < 0.25 -> 1
    ratio < 0.5 -> 2
    ratio < 0.75 -> 3
    else -> 4
  }
}

@Composable
fun ContributionHeatmap(
  daily: List<HistoryDayDto>,
  metric: HeatmapMetric,
  modifier: Modifier = Modifier,
  dayCount: Int = 90,
  onMetricChange: ((HeatmapMetric) -> Unit)? = null
) {
  val days = remember(daily, dayCount) { historyDailyForHeatmap(daily, dayCount) }
  val values = remember(days, metric) { days.map { heatmapValue(it, metric) } }
  val maxValue = remember(values) { max(1.0, values.maxOrNull() ?: 1.0) }
  val emptyColor = MaterialTheme.colorScheme.surfaceContainerHighest
  val base = if (metric == HeatmapMetric.Cost) {
    Color(0xFFD97706)
  } else {
    MaterialTheme.colorScheme.primary
  }
  val levelColors = listOf(
    emptyColor,
    base.copy(alpha = 0.18f),
    base.copy(alpha = 0.38f),
    base.copy(alpha = 0.62f),
    base.copy(alpha = 0.92f)
  )
  val density = LocalDensity.current
  val cell = with(density) { 12.dp.toPx() }
  val gap = with(density) { 3.dp.toPx() }
  val left = with(density) { 18.dp.toPx() }
  val top = with(density) { 4.dp.toPx() }
  val startDow = remember(days) {
    days.firstOrNull()?.date?.let {
      runCatching { LocalDate.parse(it).dayOfWeek.value % 7 }.getOrDefault(0)
    } ?: 0
  }
  val weeks = if (days.isEmpty()) 0 else ceil((days.size + startDow) / 7.0).toInt()
  val canvasWidth = with(density) {
    (left + weeks * (cell + gap) + 8.dp.toPx()).toDp()
  }
  val canvasHeight = with(density) {
    (top + 7 * (cell + gap) + 8.dp.toPx()).toDp()
  }
  val scroll = rememberScrollState()

  Column(modifier = modifier.fillMaxWidth()) {
    if (onMetricChange != null) {
      Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically
      ) {
        listOf(HeatmapMetric.Tokens to "Token", HeatmapMetric.Cost to "费用").forEach { (item, label) ->
          FilterChip(
            selected = metric == item,
            onClick = { onMetricChange(item) },
            label = { Text(label) }
          )
        }
      }
      Spacer(Modifier.height(10.dp))
    }

    if (days.isEmpty()) {
      Text(
        "暂无历史热力图数据",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant
      )
      return
    }

    Row(Modifier.horizontalScroll(scroll)) {
      Canvas(
        modifier = Modifier
          .width(canvasWidth)
          .height(canvasHeight)
      ) {
        days.forEachIndexed { index, day ->
          val pos = index + startDow
          val week = pos / 7
          val dow = pos % 7
          val value = heatmapValue(day, metric)
          val level = heatLevel(value, maxValue)
          val x = left + week * (cell + gap)
          val y = top + dow * (cell + gap)
          drawRoundRect(
            color = levelColors[level],
            topLeft = Offset(x, y),
            size = Size(cell, cell),
            cornerRadius = CornerRadius(3.dp.toPx(), 3.dp.toPx())
          )
        }
      }
    }

    val active = days.count { heatmapValue(it, metric) > 0.0 }
    Spacer(Modifier.height(8.dp))
    Text(
      "近 ${days.size} 天 · $active 天有用量 · ${if (metric == HeatmapMetric.Cost) "按费用" else "按 Token"}",
      style = MaterialTheme.typography.labelSmall,
      color = MaterialTheme.colorScheme.onSurfaceVariant,
      maxLines = 1,
      overflow = TextOverflow.Ellipsis,
      modifier = Modifier.padding(end = 4.dp)
    )
  }
}
