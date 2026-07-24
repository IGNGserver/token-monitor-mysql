package com.igng.tokenmonitor.android.ui.components

import java.text.NumberFormat
import java.time.Duration
import java.time.Instant
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.abs

private val integerFormat: NumberFormat = NumberFormat.getIntegerInstance(Locale.getDefault())
private val shortDateTime: DateTimeFormatter =
  DateTimeFormatter.ofPattern("MM-dd HH:mm", Locale.getDefault())

fun formatTokens(value: Long, compact: Boolean = false): String {
  if (!compact) return integerFormat.format(value) + " token"
  val abs = abs(value.toDouble())
  val formatted = when {
    abs >= 1_000_000_000 -> String.format(Locale.US, "%.1fB", value / 1_000_000_000.0)
    abs >= 1_000_000 -> String.format(Locale.US, "%.1fM", value / 1_000_000.0)
    abs >= 10_000 -> String.format(Locale.US, "%.1fK", value / 1_000.0)
    else -> integerFormat.format(value)
  }
  return "$formatted token"
}

fun formatTokensShort(value: Long): String {
  val abs = abs(value.toDouble())
  return when {
    abs >= 1_000_000_000 -> String.format(Locale.US, "%.1fB", value / 1_000_000_000.0)
    abs >= 1_000_000 -> String.format(Locale.US, "%.1fM", value / 1_000_000.0)
    abs >= 1_000 -> String.format(Locale.US, "%.1fK", value / 1_000.0)
    else -> integerFormat.format(value)
  }
}

fun formatUsd(value: Double, compact: Boolean = false): String {
  if (compact && abs(value) >= 1000) {
    return "US$" + String.format(Locale.US, "%.1fK", value / 1000.0)
  }
  val decimals = when {
    abs(value) >= 100 -> 2
    abs(value) >= 1 -> 3
    else -> 4
  }
  return "US$" + String.format(Locale.US, "%.${decimals}f", value)
}

fun formatPercent(part: Long, total: Long): String {
  if (total <= 0L) return "0%"
  val pct = part.toDouble() / total.toDouble() * 100.0
  return if (pct >= 10) String.format(Locale.US, "%.0f%%", pct)
  else String.format(Locale.US, "%.1f%%", pct)
}

/** Best-effort parse of hub ISO timestamps (with or without zone). */
fun parseInstant(raw: String?): Instant? {
  if (raw.isNullOrBlank()) return null
  val text = raw.trim()
  return try {
    Instant.parse(text)
  } catch (_: Exception) {
    try {
      OffsetDateTime.parse(text).toInstant()
    } catch (_: Exception) {
      try {
        LocalDateTime.parse(text).atZone(ZoneId.systemDefault()).toInstant()
      } catch (_: Exception) {
        null
      }
    }
  }
}

/** Relative label like "3 分钟前" / "2 小时后"; falls back to compact local time. */
fun formatRelativeTime(raw: String?, now: Instant = Instant.now()): String {
  val instant = parseInstant(raw) ?: return raw?.takeIf { it.isNotBlank() } ?: "未知"
  val seconds = Duration.between(instant, now).seconds
  val absSec = abs(seconds)
  val future = seconds < 0
  val label = when {
    absSec < 45 -> "刚刚"
    absSec < 90 -> "1 分钟"
    absSec < 3600 -> "${absSec / 60} 分钟"
    absSec < 5400 -> "1 小时"
    absSec < 86400 -> "${absSec / 3600} 小时"
    absSec < 172800 -> "1 天"
    absSec < 86400 * 30 -> "${absSec / 86400} 天"
    else -> {
      return LocalDateTime.ofInstant(instant, ZoneId.systemDefault()).format(shortDateTime)
    }
  }
  if (label == "刚刚") return label
  return if (future) "${label}后" else "${label}前"
}

fun formatIsoCompact(raw: String?): String {
  val instant = parseInstant(raw) ?: return raw?.takeIf { it.isNotBlank() } ?: "未知"
  return LocalDateTime.ofInstant(instant, ZoneId.systemDefault()).format(shortDateTime)
}

data class ShareEntry(
  val key: String,
  val tokens: Long,
  val costUsd: Double = 0.0
)

fun topShareEntries(
  tokens: Map<String, Long>,
  costs: Map<String, Double> = emptyMap(),
  limit: Int = 6
): List<ShareEntry> {
  if (tokens.isEmpty()) return emptyList()
  val sorted = tokens.entries.sortedByDescending { it.value }
  if (sorted.size <= limit) {
    return sorted.map { ShareEntry(it.key, it.value, costs[it.key] ?: 0.0) }
  }
  val head = sorted.take(limit - 1)
  val rest = sorted.drop(limit - 1)
  val otherTokens = rest.sumOf { it.value }
  val otherCost = rest.sumOf { costs[it.key] ?: 0.0 }
  return head.map { ShareEntry(it.key, it.value, costs[it.key] ?: 0.0) } +
    ShareEntry("其他", otherTokens, otherCost)
}
