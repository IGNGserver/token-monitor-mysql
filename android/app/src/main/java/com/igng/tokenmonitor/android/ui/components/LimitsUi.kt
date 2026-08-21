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
  "commandcode" to "Command Code",
  "kiro" to "Kiro",
  "zai" to "Z.ai",
  "zaiteam" to "Z.ai Team",
  "volcengine" to "Volcengine",
  "qoder" to "Qoder",
  "openrouter" to "OpenRouter",
  "kimi" to "Kimi",
  "ollama" to "Ollama",
  "thirdparty" to "第三方"
)

fun providerDisplayName(id: String): String =
  providerLabels[id.lowercase(Locale.US)] ?: id.replaceFirstChar {
    if (it.isLowerCase()) it.titlecase(Locale.getDefault()) else it.toString()
  }

private val sourceLabels = mapOf(
  "oauth" to "OAuth",
  "cli" to "CLI",
  "web" to "Web",
  "rpc" to "RPC",
  "local" to "Local",
  "api" to "API"
)

private val providerSourceLabels = mapOf(
  "claude" to mapOf("oauth" to "OAuth", "cli" to "CLI"),
  "codex" to mapOf("rpc" to "RPC"),
  "cursor" to mapOf("web" to "Web"),
  "antigravity" to mapOf("rpc" to "RPC"),
  "opencode" to mapOf("local" to "Local", "web" to "Web"),
  "openrouter" to mapOf("api" to "API"),
  "deepseek" to mapOf("api" to "API"),
  "minimax" to mapOf("api" to "API"),
  "mimo" to mapOf("web" to "Web"),
  "grok" to mapOf("rpc" to "CLI", "web" to "Web"),
  "copilot" to mapOf("api" to "API"),
  "kiro" to mapOf("cli" to "CLI"),
  "zai" to mapOf("api" to "API"),
  "zaiteam" to mapOf("api" to "API"),
  "volcengine" to mapOf("api" to "API"),
  "qoder" to mapOf("web" to "Web"),
  "commandcode" to mapOf("web" to "Web"),
  "thirdparty" to mapOf("api" to "API"),
  "kimi" to mapOf("api" to "API", "web" to "Web"),
  "ollama" to mapOf("web" to "Web")
)

private val codexRpcDetailLabels = mapOf(
  "app" to "App",
  "cli" to "CLI",
  "managed" to "Managed",
  "unknown" to "RPC"
)

/** Human-readable source identity aligned with the desktop presentation. */
fun limitProviderSourceLabel(provider: LimitProviderDto): String {
  val providerId = provider.provider.trim().lowercase(Locale.US)
  val source = provider.source?.trim()?.lowercase(Locale.US).orEmpty()
  val detail = provider.sourceDetail?.trim()?.lowercase(Locale.US).orEmpty()
  if (providerId == "codex" && source == "rpc") {
    codexRpcDetailLabels[detail]?.let { return it }
  }
  return providerSourceLabels[providerId]?.get(source)
    ?: sourceLabels[source]
    ?: ""
}

data class ThirdPartyBalanceDisplay(
  val amount: Double? = null,
  val currency: String = "USD",
  val detail: String? = null
)

fun thirdPartyQuotaWindow(provider: LimitProviderDto): LimitWindowDto? {
  if (!provider.provider.trim().equals("thirdparty", ignoreCase = true)) return null
  return provider.windows.firstOrNull { it.metric.equals("credits", ignoreCase = true) }
    ?: provider.windows.firstOrNull {
      it.metric.isNullOrBlank() && it.kind.equals("billing", ignoreCase = true)
    }
}

/** Resolve the absolute third-party balance used by the desktop's balance row. */
fun thirdPartyBalanceDisplay(provider: LimitProviderDto): ThirdPartyBalanceDisplay? {
  val quota = thirdPartyQuotaWindow(provider) ?: return null
  val balance = provider.balance
  val amount = balance?.amount ?: quota.remaining
  if (amount != null) {
    return ThirdPartyBalanceDisplay(
      amount = amount,
      currency = balance?.currency ?: quota.currency ?: "USD"
    )
  }
  val detail = quota.detail?.trim()?.takeIf { it.isNotEmpty() } ?: return null
  return ThirdPartyBalanceDisplay(
    detail = if (detail.equals("unlimited", ignoreCase = true)) "无限" else detail
  )
}

private fun limitProviderRemainingPercent(provider: LimitProviderDto): Double? =
  provider.windows.mapNotNull { window ->
    window.remainingPercent?.coerceIn(0.0, 100.0)
      ?: windowUsedPercent(window)?.let { (100.0 - it).coerceIn(0.0, 100.0) }
  }.minOrNull()

/** Home cards show the tightest quota first, with unknown balances at the end. */
fun sortLimitProvidersForHome(providers: List<LimitProviderDto>): List<LimitProviderDto> =
  providers.withIndex()
    .sortedWith(
      compareBy<IndexedValue<LimitProviderDto>>(
        { limitProviderRemainingPercent(it.value) == null },
        { limitProviderRemainingPercent(it.value) ?: Double.POSITIVE_INFINITY },
        { it.index }
      )
    )
    .map { it.value }

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
  title: String = "AI 工具限额",
  includeAllProviders: Boolean = false,
  maxAccounts: Int? = null
) {
  val raw = limits?.providers.orEmpty()
  val filtered = if (includeAllProviders) {
    raw
  } else {
    raw.filter { provider ->
      provider.windows.any { it.showMeter && windowUsedPercent(it) != null } ||
        provider.balanceUsd != null ||
        provider.balance?.amount != null ||
        thirdPartyBalanceDisplay(provider)?.let { it.amount != null || it.detail != null } == true ||
        provider.resetCredits != null ||
        !provider.status.isNullOrBlank()
    }
  }
  val providers = if (maxAccounts != null) {
    sortLimitProvidersForHome(filtered).take(maxAccounts.coerceIn(1, 12))
  } else {
    filtered
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
      val peers = providers.filter {
        it.provider.trim().equals(provider.provider.trim(), ignoreCase = true)
      }
      LimitProviderCard(provider, peers = peers)
    }
  }
}

@Composable
private fun LimitProviderCard(
  provider: LimitProviderDto,
  peers: List<LimitProviderDto> = emptyList()
) {
  Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
    Row(
      Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = Alignment.CenterVertically
    ) {
      Column(Modifier.weight(1f)) {
        val displayName = limitAccountDisplayName(provider, peers)
        Text(
          displayName,
          style = MaterialTheme.typography.titleSmall,
          fontWeight = FontWeight.SemiBold
        )
        val meta = buildList {
          add(providerDisplayName(provider.provider))
          limitPlanLabel(provider).takeIf { it.isNotBlank() }?.let { add(it) }
          limitProviderSourceLabel(provider).takeIf { it.isNotBlank() }?.let { add(it) }
          provider.region?.takeIf { it.isNotBlank() }?.let { add(it.uppercase(Locale.US)) }
          provider.accountEmail
            ?.takeIf { it.isNotBlank() && it != displayName }
            ?.let { add(it) }
          provider.status?.takeIf { it.isNotBlank() }?.let { add(it) }
        }.joinToString(" · ")
        if (meta.isNotBlank()) {
          Text(
            meta,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis
          )
        }
      }
    }

    val thirdPartyBalance = thirdPartyBalanceDisplay(provider)
    val balanceLines = buildList {
      provider.balanceUsd?.let { add("USD 余额 " + formatMoneyAmount(it, "USD")) }
      if (provider.balance?.amount == null) {
        thirdPartyBalance?.amount?.let { amount ->
          add("余额 " + formatMoneyAmount(amount, thirdPartyBalance.currency))
        }
        thirdPartyBalance?.detail?.let { detail -> add("额度 $detail") }
      }
      provider.balance?.let { balance ->
        balance.amount?.let { amount ->
          add("余额 " + formatMoneyAmount(amount, balance.currency))
        }
        balance.todaySpend?.let { spend ->
          add("今日消耗 " + formatMoneyAmount(spend, balance.currency))
        }
        balance.weekSpend?.let { spend ->
          add("本周消耗 " + formatMoneyAmount(spend, balance.currency))
        }
        balance.monthSpend?.let { spend ->
          add("本月消耗 " + formatMoneyAmount(spend, balance.currency))
        }
        balance.allTimeSpend?.let { spend ->
          add("累计消耗 " + formatMoneyAmount(spend, balance.currency))
        }
        balance.giftBalance?.let { amount ->
          add("赠送余额 " + formatMoneyAmount(amount, balance.currency))
        }
        balance.cashBalance?.let { amount ->
          add("现金余额 " + formatMoneyAmount(amount, balance.currency))
        }
        if (balance.planUsed != null || balance.planLimit != null) {
          val used = balance.planUsed?.let { formatMoneyAmount(it, balance.currency) } ?: "—"
          val limit = balance.planLimit?.let { formatMoneyAmount(it, balance.currency) } ?: "—"
          add("计划用量 $used / $limit")
        }
        balance.planPercent?.let { percent ->
          add("计划进度 " + String.format(Locale.US, "%.0f%%", percent.coerceIn(0.0, 100.0)))
        }
        balance.expiresAt?.let { expiresAt -> add("余额到期 ${formatRelativeTime(expiresAt)}") }
      }
      val credits = provider.resetCredits
      if (credits != null) {
        val available = credits.availableCount ?: credits.available ?: credits.remaining
        val total = credits.totalCount ?: credits.total ?: credits.limit
        if (available != null || total != null) {
          val body = buildString {
            if (available != null) append(available.toInt())
            if (total != null) {
              if (isNotEmpty()) append(" / ")
              append(total.toInt())
            }
          }
          add("重置额度 $body")
        }
        credits.nextExpiresAt?.let { add("下次额度到期 ${formatRelativeTime(it)}") }
        if (credits.expirations.size > 1) add("可用额度到期日 ${credits.expirations.size} 个")
      }
    }
    balanceLines.forEach { line ->
      Text(
        line,
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant
      )
    }

    val meterWindows = provider.windows.filter { it.showMeter && windowUsedPercent(it) != null }
    if (meterWindows.isNotEmpty()) {
      Row(
        Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp)
      ) {
        meterWindows.take(3).forEach { window ->
          LimitWindowMeter(
            window = window,
            modifier = Modifier.weight(1f)
          )
        }
      }
    }
    provider.windows.mapNotNull { window -> window.detail?.takeIf { it.isNotBlank() } }.distinct().forEach { detail ->
      Text(
        detail,
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        maxLines = 2,
        overflow = TextOverflow.Ellipsis
      )
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
      buildString {
        append(window.label?.takeIf { it.isNotBlank() } ?: windowKindLabel(window.kind))
        if (window.metric?.equals("credits", ignoreCase = true) == true) append(" · 积分")
      },
      style = MaterialTheme.typography.labelMedium,
      maxLines = 1,
      overflow = TextOverflow.Ellipsis
    )
    (window.resetsAt ?: window.resetDescription?.takeIf { it.isNotBlank() })?.let {
      Text(
        if (window.resetsAt != null) "重置 ${formatRelativeTime(it)}" else it,
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
  val animatedUsed = animateGrowFraction(safeUsed / 100f, durationMillis = 1000) * 100f
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
      if (animatedUsed > 0f) {
        drawArc(
          color = color,
          startAngle = -90f,
          sweepAngle = 360f * (animatedUsed / 100f),
          useCenter = false,
          topLeft = topLeft,
          size = arcSize,
          style = Stroke(width = strokePx, cap = StrokeCap.Round)
        )
      }
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
  val remaining = (100.0 - usedPercent).coerceIn(0.0, 100.0)
  return when (limitRemainingTone(remaining)) {
    LimitRemainingTone.Critical -> MaterialTheme.colorScheme.error
    LimitRemainingTone.Warn -> MaterialTheme.colorScheme.tertiary
    LimitRemainingTone.Ok -> MaterialTheme.colorScheme.primary
    LimitRemainingTone.Unknown -> MaterialTheme.colorScheme.primary
  }
}

enum class LimitRemainingTone { Ok, Warn, Critical, Unknown }

/** Desktop-aligned remaining thresholds: <20 critical, <50 warn. */
fun limitRemainingTone(remainingPercent: Double?): LimitRemainingTone {
  if (remainingPercent == null || remainingPercent.isNaN()) return LimitRemainingTone.Unknown
  val value = remainingPercent
  return when {
    value < 20.0 -> LimitRemainingTone.Critical
    value < 50.0 -> LimitRemainingTone.Warn
    else -> LimitRemainingTone.Ok
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
