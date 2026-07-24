package com.igng.tokenmonitor.android.ui.components

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.dp
import com.igng.tokenmonitor.android.data.model.HistoryDayDto
import com.igng.tokenmonitor.android.data.model.HistoryMonthDto
import com.patrykandpatrick.vico.compose.axis.horizontal.rememberBottomAxis
import com.patrykandpatrick.vico.compose.axis.vertical.rememberStartAxis
import com.patrykandpatrick.vico.compose.chart.Chart
import com.patrykandpatrick.vico.compose.chart.column.columnChart
import com.patrykandpatrick.vico.compose.chart.line.lineChart
import com.patrykandpatrick.vico.compose.chart.scroll.rememberChartScrollSpec
import com.patrykandpatrick.vico.compose.m3.style.m3ChartStyle
import com.patrykandpatrick.vico.compose.style.ProvideChartStyle
import com.patrykandpatrick.vico.core.axis.AxisItemPlacer
import com.patrykandpatrick.vico.core.chart.line.LineChart
import com.patrykandpatrick.vico.core.component.shape.LineComponent
import com.patrykandpatrick.vico.core.component.shape.Shapes
import com.patrykandpatrick.vico.core.entry.ChartEntryModelProducer
import com.patrykandpatrick.vico.core.entry.entryOf
import kotlin.math.max

enum class TrendMetric { Tokens, Cost, ActiveTime, Dual }
enum class TrendRange { Days7, Days30, Months12 }

fun List<HistoryDayDto>.takeRange(range: TrendRange): List<HistoryDayDto> {
  val sorted = sortedBy { it.date }
  return when (range) {
    TrendRange.Days7 -> sorted.takeLast(7)
    TrendRange.Days30 -> sorted.takeLast(30)
    TrendRange.Months12 -> sorted.takeLast(30)
  }
}

fun List<HistoryMonthDto>.takeMonths(limit: Int = 12): List<HistoryMonthDto> =
  sortedBy { it.month }.takeLast(limit)

@Composable
private fun chartPrimary(): Color {
  val dark = isSystemInDarkTheme()
  // Brighter primary on dark surfaces so columns/lines stay legible.
  return if (dark) Color(0xFF8AB4FF) else MaterialTheme.colorScheme.primary
}

@Composable
private fun chartSecondary(): Color {
  val dark = isSystemInDarkTheme()
  return if (dark) Color(0xFF5CDBB0) else Color(0xFF0CA678)
}

@Composable
private fun chartTertiary(): Color {
  val dark = isSystemInDarkTheme()
  return if (dark) Color(0xFFFFC078) else Color(0xFFE67700)
}

@Composable
fun DailyTrendChart(
  days: List<HistoryDayDto>,
  metric: TrendMetric,
  modifier: Modifier = Modifier,
  useLine: Boolean = false
) {
  if (days.isEmpty()) return
  when (metric) {
    TrendMetric.Dual -> DualMetricDailyChart(days, modifier)
    TrendMetric.ActiveTime -> SingleMetricDailyChart(days, TrendMetric.ActiveTime, modifier, useLine = true)
    else -> SingleMetricDailyChart(days, metric, modifier, useLine)
  }
}

@Composable
private fun SingleMetricDailyChart(
  days: List<HistoryDayDto>,
  metric: TrendMetric,
  modifier: Modifier,
  useLine: Boolean
) {
  val values = days.map {
    when (metric) {
      TrendMetric.Cost -> it.cost.toFloat()
      TrendMetric.ActiveTime -> (it.activeTimeMs / 3_600_000.0).toFloat()
      else -> it.tokens.toFloat()
    }
  }
  val labels = days.map { shortDayLabel(it.date) }
  val color = when (metric) {
    TrendMetric.Cost -> chartSecondary()
    TrendMetric.ActiveTime -> chartTertiary()
    else -> chartPrimary()
  }
  val colorArgb = color.toArgb()
  val modelProducer = remember(days, metric) {
    ChartEntryModelProducer(listOf(values.mapIndexed { index, v -> entryOf(index.toFloat(), v) }))
  }
  val labelStep = max(1, days.size / 6)
  val peak = values.maxOrNull() ?: 0f
  val peakIndex = values.indexOfFirst { it == peak }.takeIf { it >= 0 } ?: 0
  val peakLabel = labels.getOrNull(peakIndex)

  ProvideChartStyle(m3ChartStyle(entityColors = listOf(color))) {
    val column = columnChart(
      columns = listOf(
        LineComponent(
          color = colorArgb,
          thicknessDp = if (days.size > 14) 6f else 10f,
          shape = Shapes.roundedCornerShape(allPercent = 40)
        )
      )
    )
    val line = lineChart(
      lines = listOf(
        LineChart.LineSpec(
          lineColor = colorArgb,
          lineThicknessDp = 2.8f
        )
      )
    )
    Chart(
      chart = if (useLine) line else column,
      chartModelProducer = modelProducer,
      startAxis = rememberStartAxis(
        valueFormatter = { value, _ -> formatAxis(metric, value) },
        itemPlacer = remember { AxisItemPlacer.Vertical.default(maxItemCount = 4) }
      ),
      bottomAxis = rememberBottomAxis(
        valueFormatter = { value, _ ->
          val idx = value.toInt().coerceIn(0, labels.lastIndex)
          labels[idx]
        },
        itemPlacer = remember(labelStep) {
          AxisItemPlacer.Horizontal.default(spacing = labelStep, addExtremeLabelPadding = true)
        }
      ),
      modifier = modifier
        .fillMaxWidth()
        .height(210.dp),
      chartScrollSpec = rememberChartScrollSpec(isScrollEnabled = days.size > 14)
    )
  }
  if (peak > 0f) {
    Spacer(Modifier.height(4.dp))
    Text(
      buildString {
        append("峰值 ")
        append(formatAxis(metric, peak))
        if (!peakLabel.isNullOrBlank()) {
          append(" · ")
          append(peakLabel)
        }
      },
      style = MaterialTheme.typography.labelSmall,
      color = MaterialTheme.colorScheme.onSurfaceVariant
    )
  }
}

/** Dual metric: stacked single-axis charts (clearer than dual-axis scale tricks). */
@Composable
fun DualMetricDailyChart(
  days: List<HistoryDayDto>,
  modifier: Modifier = Modifier
) {
  Column(modifier.fillMaxWidth()) {
    Text(
      "Token",
      style = MaterialTheme.typography.labelMedium,
      color = MaterialTheme.colorScheme.onSurfaceVariant
    )
    Spacer(Modifier.height(4.dp))
    SingleMetricDailyChart(days, TrendMetric.Tokens, Modifier, useLine = false)
    Spacer(Modifier.height(10.dp))
    Text(
      "费用",
      style = MaterialTheme.typography.labelMedium,
      color = MaterialTheme.colorScheme.onSurfaceVariant
    )
    Spacer(Modifier.height(4.dp))
    SingleMetricDailyChart(days, TrendMetric.Cost, Modifier, useLine = true)
  }
}

@Composable
fun ActiveTimeDailyChart(
  days: List<HistoryDayDto>,
  modifier: Modifier = Modifier,
  useLine: Boolean = true
) {
  SingleMetricDailyChart(days, TrendMetric.ActiveTime, modifier, useLine)
}

@Composable
fun MonthlyTrendChart(
  months: List<HistoryMonthDto>,
  metric: TrendMetric,
  modifier: Modifier = Modifier
) {
  if (months.isEmpty()) return
  if (metric == TrendMetric.Dual) {
    Column(modifier.fillMaxWidth()) {
      Text("Token", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
      Spacer(Modifier.height(4.dp))
      MonthlySingle(months, TrendMetric.Tokens, Modifier)
      Spacer(Modifier.height(10.dp))
      Text("费用", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
      Spacer(Modifier.height(4.dp))
      MonthlySingle(months, TrendMetric.Cost, Modifier)
    }
    return
  }
  MonthlySingle(months, metric, modifier)
}

@Composable
private fun MonthlySingle(
  months: List<HistoryMonthDto>,
  metric: TrendMetric,
  modifier: Modifier
) {
  val values = months.map {
    when (metric) {
      TrendMetric.Cost -> it.cost.toFloat()
      TrendMetric.ActiveTime -> (it.activeTimeMs / 3_600_000.0).toFloat()
      else -> it.tokens.toFloat()
    }
  }
  val labels = months.map { shortMonthLabel(it.month) }
  val color = when (metric) {
    TrendMetric.Cost -> chartSecondary()
    TrendMetric.ActiveTime -> chartTertiary()
    else -> chartPrimary()
  }
  val colorArgb = color.toArgb()
  val modelProducer = remember(months, metric) {
    ChartEntryModelProducer(listOf(values.mapIndexed { index, v -> entryOf(index.toFloat(), v) }))
  }
  val peak = values.maxOrNull() ?: 0f
  val peakIndex = values.indexOfFirst { it == peak }.takeIf { it >= 0 } ?: 0
  val peakLabel = labels.getOrNull(peakIndex)

  ProvideChartStyle(m3ChartStyle(entityColors = listOf(color))) {
    Chart(
      chart = columnChart(
        columns = listOf(
          LineComponent(
            color = colorArgb,
            thicknessDp = 14f,
            shape = Shapes.roundedCornerShape(allPercent = 30)
          )
        )
      ),
      chartModelProducer = modelProducer,
      startAxis = rememberStartAxis(
        valueFormatter = { value, _ -> formatAxis(metric, value) },
        itemPlacer = remember { AxisItemPlacer.Vertical.default(maxItemCount = 4) }
      ),
      bottomAxis = rememberBottomAxis(
        valueFormatter = { value, _ ->
          val idx = value.toInt().coerceIn(0, labels.lastIndex)
          labels[idx]
        }
      ),
      modifier = modifier
        .fillMaxWidth()
        .height(200.dp)
    )
  }
  if (peak > 0f) {
    Spacer(Modifier.height(4.dp))
    Text(
      buildString {
        append("峰值 ")
        append(formatAxis(metric, peak))
        if (!peakLabel.isNullOrBlank()) {
          append(" · ")
          append(peakLabel)
        }
      },
      style = MaterialTheme.typography.labelSmall,
      color = MaterialTheme.colorScheme.onSurfaceVariant
    )
  }
}

private fun formatAxis(metric: TrendMetric, value: Float): String {
  return when (metric) {
    TrendMetric.Cost -> formatUsd(value.toDouble(), compact = true)
    TrendMetric.ActiveTime -> formatActiveHours(value.toDouble())
    else -> formatTokensShort(value.toLong())
  }
}

fun formatActiveHours(hours: Double): String {
  return when {
    hours >= 10 -> String.format(java.util.Locale.US, "%.0fh", hours)
    hours >= 1 -> String.format(java.util.Locale.US, "%.1fh", hours)
    hours > 0 -> String.format(java.util.Locale.US, "%.0fm", hours * 60)
    else -> "0"
  }
}

fun formatActiveTimeMs(ms: Double): String {
  if (ms <= 0) return "0"
  return formatActiveHours(ms / 3_600_000.0)
}

private fun shortDayLabel(date: String): String {
  val parts = date.split("-")
  return if (parts.size >= 3) "${parts[1].toInt()}/${parts[2].toInt()}" else date.takeLast(5)
}

private fun shortMonthLabel(month: String): String {
  val parts = month.split("-")
  return if (parts.size >= 2) "${parts[0].takeLast(2)}/${parts[1]}" else month
}
