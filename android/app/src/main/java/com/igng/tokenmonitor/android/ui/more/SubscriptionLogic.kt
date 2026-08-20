package com.igng.tokenmonitor.android.ui.more

import com.igng.tokenmonitor.android.data.model.SubscriptionDto
import com.igng.tokenmonitor.android.data.model.SubscriptionBindingDto
import java.time.LocalDate
import java.time.YearMonth
import java.time.temporal.ChronoUnit

data class TopUpDraft(
  val provider: String,
  val planName: String,
  val amountMinor: Long,
  val currency: String,
  val date: String,
  val binding: SubscriptionBindingDto,
  val note: String
)

/** Display-only subscription calculations kept separate from the Hub wire model. */
fun isTopUp(subscription: SubscriptionDto): Boolean =
  subscription.kind.equals("topup", ignoreCase = true)

fun subscriptionIntervalMonths(subscription: SubscriptionDto): Int {
  val count = subscription.intervalCount.coerceIn(1, 24)
  return if (subscription.interval.equals("year", ignoreCase = true)) count * 12 else count
}

fun parseSubscriptionDate(raw: String?): LocalDate? =
  raw?.trim()?.takeIf { it.isNotEmpty() }?.let { value ->
    runCatching { LocalDate.parse(value) }.getOrNull()
  }

fun subscriptionCoverageStopDate(subscription: SubscriptionDto): LocalDate? {
  if (isTopUp(subscription)) return null
  parseSubscriptionDate(subscription.endDate)?.let { return it }
  if (subscription.autoRenew) return null
  return parseSubscriptionDate(subscription.startDate)?.plusMonths(subscriptionIntervalMonths(subscription).toLong())
}

fun subscriptionNextRenewalDate(
  subscription: SubscriptionDto,
  today: LocalDate = LocalDate.now()
): LocalDate? {
  if (isTopUp(subscription) || !subscription.autoRenew) return null

  parseSubscriptionDate(subscription.nextRenewalOverride)?.takeIf { !it.isBefore(today) }?.let { return it }
  val anchor = parseSubscriptionDate(subscription.startDate) ?: return null
  val step = subscriptionIntervalMonths(subscription)
  val monthsElapsed = ChronoUnit.MONTHS.between(YearMonth.from(anchor), YearMonth.from(today)).coerceAtLeast(0L)
  var periods = (monthsElapsed / step).toInt()
  var candidate = anchor.plusMonths(periods.toLong() * step)
  while (candidate.isBefore(today)) {
    periods += 1
    candidate = anchor.plusMonths(periods.toLong() * step)
  }
  while (periods > 0) {
    val previous = anchor.plusMonths((periods - 1L) * step)
    if (previous.isBefore(today)) break
    periods -= 1
    candidate = previous
  }
  return candidate
}

fun subscriptionTopUpTotalMinor(subscription: SubscriptionDto): Long =
  subscription.topUps.sumOf { it.amountMinor.coerceAtLeast(0L) }

fun subscriptionTopUpMonthMinor(
  subscription: SubscriptionDto,
  today: LocalDate = LocalDate.now()
): Long {
  val month = YearMonth.from(today).toString()
  return subscription.topUps
    .filter { it.date.startsWith(month) }
    .sumOf { it.amountMinor.coerceAtLeast(0L) }
}

fun subscriptionIsActive(
  subscription: SubscriptionDto,
  today: LocalDate = LocalDate.now()
): Boolean = subscriptionCoverageStopDate(subscription)?.isAfter(today) ?: true

/**
 * Returns a monthly equivalent grouped by currency. We deliberately do not
 * invent an exchange rate on mobile; the Hub subscription document only carries
 * the record currency, not the current currency table.
 */
fun subscriptionMonthlyTotals(
  subscriptions: List<SubscriptionDto>,
  today: LocalDate = LocalDate.now()
): Map<String, Double> {
  val totals = linkedMapOf<String, Double>()
  subscriptions.filter { subscriptionIsActive(it, today) }.forEach { subscription ->
    val currency = subscription.currency.trim().uppercase().ifBlank { "USD" }
    val minor = if (isTopUp(subscription)) {
      subscriptionTopUpMonthMinor(subscription, today).toDouble()
    } else {
      subscription.amountMinor.coerceAtLeast(0L).toDouble() / subscriptionIntervalMonths(subscription)
    }
    if (minor > 0.0) totals[currency] = (totals[currency] ?: 0.0) + minor / 100.0
  }
  return totals
}
