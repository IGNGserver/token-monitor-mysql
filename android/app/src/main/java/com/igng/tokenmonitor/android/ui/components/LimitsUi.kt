package com.igng.tokenmonitor.android.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
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
import com.igng.tokenmonitor.android.data.model.LimitProviderDto
import com.igng.tokenmonitor.android.data.model.LimitWindowDto
import com.igng.tokenmonitor.android.data.model.LimitsDto
import java.util.Locale
import kotlin.math.min

private val providerLabels = mapOf(
  "claude" to "Claude",
  "codex" to "Codex",
  "cursor" to "Cursor",
  "antigravity" to "Antigravity",
  "opencode" to "OpenCode",
  "deepseek" to "DeepSeek",
  "minimax" to "MiniMax",
  "mimo" to "MiMo",
  "grok" to "Grok",
  "copilot" to "Copilot",
  "kiro" to "Kiro",
  "zai" to "Z.ai",
  "zaiteam" to "Z.ai Team",
  "volcengine" to "Volcengine",
  "qoder" to "Qoder",
  "kimi" to "Kimi",
  "ollama" to "Ollama"
)

fun providerDisplayName(id: String): String =
  providerLabels[id.lowercase(Locale.US)] ?: id.replaceFirstChar {
    if (it.isLowerCase()) it.titlecase(Locale.getDefault()) else it.toString()
  }

fun windowKindLabel(kind: String): String = when (kind.lowercase(Locale.US)) {
  "session" -> "会话"
  "weekly" -> "每周"
  "billing" -> "账期"
  else -> kind
}

@Composable
fun LimitsSection(
  limits: LimitsDto?,
  modifier: Modifier = Modifier,
  title: String = "AI 工具限额"
) {
  val providers = limits?.providers.orEmpty().filter { provider ->
    provider.windows.any { it.showMeter && windowUsedPercent(it) != null } ||
      provider.balanceUsd != null ||
      provider.balance?.amount != null
  }
  if (providers.isEmpty()) return

  AppCard(modifier = modifier) {
    SectionHeader(
      title = title,
      subtitle = limits?.updatedAt?.let { "更新 ${formatRelativeTime(it)}" } ?: "来自 Hub 聚合"
    )
    Spacer(Modifier.height(12.dp))
    providers.forEachIndexed { index, provider ->
      if (index > 0) Spacer(Modifier.height(14.dp))
      LimitProviderCard(provider)
    }
  }
}

@Composable
private fun LimitProviderCard(provider: LimitProviderDto) {
  Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
    Row(
      Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = Alignment.CenterVertically
    ) {
      Column(Modifier.weight(1f)) {
        Text(
          providerDisplayName(provider.provider),
          style = MaterialTheme.typography.titleSmall,
          fontWeight = FontWeight.SemiBold
        )
        val meta = buildList {
          provider.accountLabel?.takeIf { it.isNotBlank() }?.let { add(it) }
          provider.accountEmail?.takeIf { it.isNotBlank() }?.let { add(it) }
          provider.status?.takeIf { it.isNotBlank() }?.let { add(it) }
        }.joinToString(" · ")
        if (meta.isNotBlank()) {
          Text(
            meta,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
          )
        }
      }
      val balanceLabel = provider.balanceUsd?.let { formatUsd(it, compact = true) }
        ?: provider.balance?.let { bal ->
          val amount = bal.amount ?: return@let null
          val currency = bal.currency?.takeIf { it.isNotBlank() } ?: ""
          if (currency.isNotEmpty()) "$currency ${String.format(java.util.Locale.US, "%.2f", amount)}"
          else String.format(java.util.Locale.US, "%.2f", amount)
        }
      balanceLabel?.let { label ->
        Text(
          label,
          style = MaterialTheme.typography.labelLarge,
          color = MaterialTheme.colorScheme.primary
        )
      }
    }

    val windows = provider.windows.filter { it.showMeter && windowUsedPercent(it) != null }
    if (windows.isNotEmpty()) {
      Row(
        Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
      ) {
        windows.take(3).forEach { window ->
          LimitWindowMeter(
            window = window,
            modifier = Modifier.weight(1f)
          )
        }
      }
    }
  }
}

@Composable
private fun LimitWindowMeter(
  window: LimitWindowDto,
  modifier: Modifier = Modifier
) {
  val used = windowUsedPercent(window) ?: return
  val remaining = (100.0 - used).coerceIn(0.0, 100.0)
  val color = limitColor(used)
  Column(
    modifier = modifier,
    horizontalAlignment = Alignment.CenterHorizontally
  ) {
    QuotaRing(
      usedPercent = used.toFloat(),
      color = color,
      centerLabel = String.format(Locale.US, "%.0f%%", remaining),
      centerHint = "剩余"
    )
    Spacer(Modifier.height(6.dp))
    Text(
      window.label?.takeIf { it.isNotBlank() } ?: windowKindLabel(window.kind),
      style = MaterialTheme.typography.labelMedium,
      maxLines = 1,
      overflow = TextOverflow.Ellipsis
    )
    window.resetsAt?.let {
      Text(
        "重置 ${formatRelativeTime(it)}",
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis
      )
    }
  }
}

@Composable
fun QuotaRing(
  usedPercent: Float,
  color: Color,
  centerLabel: String,
  centerHint: String? = null,
  size: Dp = 72.dp,
  stroke: Dp = 8.dp
) {
  val track = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.7f)
  val safeUsed = usedPercent.coerceIn(0f, 100f)
  Box(contentAlignment = Alignment.Center, modifier = Modifier.size(size)) {
    Canvas(Modifier.size(size)) {
      val strokePx = stroke.toPx()
      val diameter = this.size.minDimension - strokePx
      val topLeft = Offset(strokePx / 2f, strokePx / 2f)
      val arcSize = Size(diameter, diameter)
      drawArc(
        color = track,
        startAngle = -90f,
        sweepAngle = 360f,
        useCenter = false,
        topLeft = topLeft,
        size = arcSize,
        style = Stroke(width = strokePx, cap = StrokeCap.Round)
      )
      drawArc(
        color = color,
        startAngle = -90f,
        sweepAngle = 360f * (safeUsed / 100f),
        useCenter = false,
        topLeft = topLeft,
        size = arcSize,
        style = Stroke(width = strokePx, cap = StrokeCap.Round)
      )
    }
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
      Text(
        centerLabel,
        style = MaterialTheme.typography.titleSmall,
        fontWeight = FontWeight.SemiBold
      )
      if (centerHint != null) {
        Text(
          centerHint,
          style = MaterialTheme.typography.labelSmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
      }
    }
  }
}

@Composable
private fun limitColor(usedPercent: Double): Color {
  return when {
    usedPercent >= 90 -> MaterialTheme.colorScheme.error
    usedPercent >= 70 -> MaterialTheme.colorScheme.tertiary
    else -> MaterialTheme.colorScheme.primary
  }
}

fun windowUsedPercent(window: LimitWindowDto): Double? {
  window.usedPercent?.let { return it.coerceIn(0.0, 100.0) }
  val used = window.used
  val limit = window.limit
  if (used != null && limit != null && limit > 0) {
    return min(100.0, (used / limit) * 100.0)
  }
  window.remainingPercent?.let { return (100.0 - it).coerceIn(0.0, 100.0) }
  return null
}
