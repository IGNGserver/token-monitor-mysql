package com.igng.tokenmonitor.android.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.igng.tokenmonitor.android.data.model.DeviceDto
import com.igng.tokenmonitor.android.ui.theme.ChartPalette

data class DeviceShare(
  val id: String,
  val name: String,
  val tokens: Long,
  val costUsd: Double,
  val stale: Boolean
)

fun devicesToShares(devices: List<DeviceDto>, limit: Int = 8): List<DeviceShare> {
  return devices
    .sortedWith(compareByDescending<DeviceDto> { it.periods.today.totalTokens }.thenBy { it.stale })
    .take(limit)
    .map {
      DeviceShare(
        id = it.deviceId.orEmpty(),
        name = it.hostname?.takeIf { n -> n.isNotBlank() } ?: it.deviceId.orEmpty().ifBlank { "设备" },
        tokens = it.periods.today.totalTokens,
        costUsd = it.periods.today.costUsd,
        stale = it.stale
      )
    }
}

@Composable
fun DeviceComparisonChart(
  devices: List<DeviceDto>,
  modifier: Modifier = Modifier,
  limit: Int = 8,
  showCost: Boolean = true
) {
  val shares = devicesToShares(devices, limit)
  if (shares.isEmpty()) return
  val maxTokens = shares.maxOf { it.tokens }.coerceAtLeast(1L)
  val primary = MaterialTheme.colorScheme.primary
  val staleColor = MaterialTheme.colorScheme.outline
  val track = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.65f)

  Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
    shares.forEachIndexed { index, share ->
      val fraction = (share.tokens.toFloat() / maxTokens.toFloat()).coerceIn(0.02f, 1f)
      val barColor = if (share.stale) staleColor else ChartPalette[index % ChartPalette.size].let {
        // Prefer brand primary for top device for clearer hierarchy
        if (index == 0 && !share.stale) primary else it
      }
      Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(
          Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.weight(1f)
          ) {
            StatusDot(active = !share.stale)
            Spacer(Modifier.width(8.dp))
            Text(
              share.name,
              style = MaterialTheme.typography.bodyMedium,
              fontWeight = if (index == 0) FontWeight.SemiBold else FontWeight.Normal,
              maxLines = 1,
              overflow = TextOverflow.Ellipsis,
              modifier = Modifier.weight(1f, fill = false)
            )
          }
          Spacer(Modifier.width(8.dp))
          Text(
            formatTokensShort(share.tokens),
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.Medium
          )
          if (showCost) {
            Spacer(Modifier.width(8.dp))
            Text(
              formatUsd(share.costUsd, compact = true),
              style = MaterialTheme.typography.labelMedium,
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
          }
        }
        Canvas(
          Modifier
            .fillMaxWidth()
            .height(12.dp)
        ) {
          val h = size.height
          val radius = CornerRadius(h / 2f, h / 2f)
          drawRoundRect(color = track, cornerRadius = radius)
          drawRoundRect(
            color = barColor,
            size = Size(size.width * fraction, h),
            cornerRadius = radius
          )
        }
      }
    }
  }
}

@Composable
fun MiniDeviceBars(
  devices: List<DeviceDto>,
  modifier: Modifier = Modifier,
  limit: Int = 5
) {
  DeviceComparisonChart(devices = devices, modifier = modifier, limit = limit, showCost = false)
}
