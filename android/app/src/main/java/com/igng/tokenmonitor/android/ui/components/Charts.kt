package com.igng.tokenmonitor.android.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.igng.tokenmonitor.android.ui.theme.ChartPalette

@Composable
fun DonutChart(
  entries: List<ShareEntry>,
  modifier: Modifier = Modifier,
  chartSize: Dp = 148.dp,
  strokeWidth: Dp = 22.dp,
  centerPrimary: String? = null,
  centerSecondary: String? = null,
  showLegend: Boolean = true,
  brandClients: Boolean = true
) {
  val total = entries.sumOf { it.tokens }.coerceAtLeast(1L)
  val colors = ChartPalette
  val track = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.55f)
  val resetKey = entries.joinToString("|") { "${it.key}:${it.tokens}" }
  val grow = animateGrowProgress(resetKey = resetKey, durationMillis = 1000)

  fun sliceColor(index: Int, key: String): Color {
    return if (brandClients) ClientBranding.color(key) else colors[index % colors.size]
  }

  val rowModifier = if (showLegend) {
    modifier.fillMaxWidth()
  } else {
    // Compact trailing usage (e.g. hero card): wrap chart only, avoid empty stretch.
    modifier
  }

  Row(
    modifier = rowModifier,
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = if (showLegend) Arrangement.spacedBy(16.dp) else Arrangement.Center
  ) {
    Box(contentAlignment = Alignment.Center, modifier = Modifier.size(chartSize)) {
      Canvas(Modifier.size(chartSize)) {
        val stroke = strokeWidth.toPx()
        val diameter = this.size.minDimension - stroke
        val topLeft = Offset(stroke / 2f, stroke / 2f)
        val arcSize = Size(diameter, diameter)
        drawArc(
          color = track,
          startAngle = -90f,
          sweepAngle = 360f,
          useCenter = false,
          topLeft = topLeft,
          size = arcSize,
          style = Stroke(width = stroke, cap = StrokeCap.Butt)
        )
        if (entries.isEmpty() || grow <= 0f) return@Canvas
        var start = -90f
        entries.forEachIndexed { index, entry ->
          val fullSweep = (entry.tokens.toFloat() / total.toFloat()) * 360f
          val sweep = fullSweep * grow
          if (sweep > 0f) {
            drawArc(
              color = sliceColor(index, entry.key),
              startAngle = start,
              sweepAngle = sweep.coerceAtLeast(0.8f * grow.coerceAtLeast(0.01f)),
              useCenter = false,
              topLeft = topLeft,
              size = arcSize,
              style = Stroke(width = stroke, cap = StrokeCap.Butt)
            )
          }
          start += fullSweep * grow
        }
      }
      Column(horizontalAlignment = Alignment.CenterHorizontally) {
        if (centerPrimary != null) {
          Text(
            centerPrimary,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1
          )
        }
        if (centerSecondary != null) {
          Text(
            centerSecondary,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1
          )
        }
      }
    }

    if (showLegend) {
      Column(
        modifier = Modifier.weight(1f),
        verticalArrangement = Arrangement.spacedBy(6.dp)
      ) {
        entries.forEachIndexed { index, entry ->
          Row(verticalAlignment = Alignment.CenterVertically) {
            if (brandClients) {
              ClientMonogram(entry.key, size = 18.dp)
            } else {
              Canvas(Modifier.size(10.dp)) {
                drawCircle(sliceColor(index, entry.key))
              }
            }
            Spacer(Modifier.width(8.dp))
            Text(
              if (brandClients) ClientBranding.label(entry.key) else entry.key,
              style = MaterialTheme.typography.bodySmall,
              maxLines = 1,
              overflow = TextOverflow.Ellipsis,
              modifier = Modifier.weight(1f)
            )
            Text(
              formatPercent(entry.tokens, total),
              style = MaterialTheme.typography.labelSmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
          }
        }
      }
    }
  }
}

@Composable
fun ShareBarList(
  entries: List<ShareEntry>,
  modifier: Modifier = Modifier,
  showCost: Boolean = true,
  brandClients: Boolean = true,
  onEntryClick: ((ShareEntry) -> Unit)? = null
) {
  val total = entries.sumOf { it.tokens }.coerceAtLeast(1L)
  val colors = ChartPalette
  Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
    entries.forEachIndexed { index, entry ->
      val color = if (brandClients) ClientBranding.color(entry.key) else colors[index % colors.size]
      val clickable = onEntryClick != null && entry.key != "其他"
      ShareBarRow(
        name = if (brandClients) ClientBranding.label(entry.key) else entry.key,
        tokens = entry.tokens,
        costUsd = entry.costUsd,
        fraction = entry.tokens.toFloat() / total.toFloat(),
        color = color,
        showCost = showCost,
        leading = if (brandClients) {
          { ClientMonogram(entry.key, size = 22.dp) }
        } else null,
        onClick = if (clickable) ({ onEntryClick?.invoke(entry) }) else null
      )
    }
  }
}

@Composable
fun ShareBarRow(
  name: String,
  tokens: Long,
  costUsd: Double,
  fraction: Float,
  color: Color,
  showCost: Boolean = true,
  leading: (@Composable () -> Unit)? = null,
  onClick: (() -> Unit)? = null
) {
  val rowModifier = if (onClick != null) {
    Modifier
      .fillMaxWidth()
      .clickable(onClick = onClick)
  } else {
    Modifier.fillMaxWidth()
  }
  Column(modifier = rowModifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
    Row(
      Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = Alignment.CenterVertically
    ) {
      Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.weight(1f)
      ) {
        if (leading != null) {
          leading()
          Spacer(Modifier.width(8.dp))
        } else {
          Canvas(Modifier.size(8.dp)) { drawCircle(color) }
          Spacer(Modifier.width(8.dp))
        }
        Text(
          name,
          style = MaterialTheme.typography.bodyMedium,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis,
          modifier = Modifier.weight(1f, fill = false)
        )
      }
      Spacer(Modifier.width(8.dp))
      Text(
        formatTokensShort(tokens),
        style = MaterialTheme.typography.labelLarge,
        color = MaterialTheme.colorScheme.onSurface
      )
      if (showCost) {
        Spacer(Modifier.width(8.dp))
        Text(
          formatUsd(costUsd, compact = true),
          style = MaterialTheme.typography.labelMedium,
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
      }
    }
    ShareProgressBar(fraction = fraction, color = color)
  }
}

@Composable
fun ShareProgressBar(
  fraction: Float,
  color: Color,
  modifier: Modifier = Modifier,
  height: Dp = 8.dp
) {
  val track = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.7f)
  val animated = animateGrowFraction(fraction, durationMillis = 900)
  Canvas(
    modifier
      .fillMaxWidth()
      .height(height)
  ) {
    val h = size.height
    drawRoundRect(
      color = track,
      cornerRadius = androidx.compose.ui.geometry.CornerRadius(h / 2f, h / 2f)
    )
    if (animated > 0f) {
      drawRoundRect(
        color = color,
        size = Size((size.width * animated).coerceAtLeast(h), h),
        cornerRadius = androidx.compose.ui.geometry.CornerRadius(h / 2f, h / 2f)
      )
    }
  }
}

@Composable
fun SegmentedTokenBar(
  segments: List<Pair<String, Long>>,
  modifier: Modifier = Modifier,
  height: Dp = 12.dp
) {
  val total = segments.sumOf { it.second }.coerceAtLeast(1L)
  val colors = ChartPalette
  val resetKey = segments.joinToString("|") { "${it.first}:${it.second}" }
  val grow = animateGrowProgress(resetKey = resetKey, durationMillis = 900)
  Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
    Canvas(Modifier.fillMaxWidth().height(height)) {
      val r = size.height / 2f
      var x = 0f
      segments.forEachIndexed { index, (_, value) ->
        val fraction = value.toFloat() / total.toFloat()
        val w: Float = size.width * fraction * grow
        if (w > 0f) {
          drawRoundRect(
            color = colors[index % colors.size],
            topLeft = Offset(x, 0f),
            size = Size(w, size.height),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(r, r)
          )
          x += w
        }
      }
    }
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
      segments.forEachIndexed { index, (name, value) ->
        if (value <= 0L) return@forEachIndexed
        Row(
          Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          Row(verticalAlignment = Alignment.CenterVertically) {
            Canvas(Modifier.size(8.dp)) { drawCircle(colors[index % colors.size]) }
            Spacer(Modifier.width(8.dp))
            Text(name, style = MaterialTheme.typography.bodySmall)
          }
          Text(formatTokensShort(value), style = MaterialTheme.typography.bodySmall)
        }
      }
    }
  }
}
