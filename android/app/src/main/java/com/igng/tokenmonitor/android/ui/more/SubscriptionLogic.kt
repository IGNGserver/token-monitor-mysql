package com.igng.tokenmonitor.android.ui.more

import com.igng.tokenmonitor.android.data.model.SubscriptionDto
import com.igng.tokenmonitor.android.data.model.SubscriptionBindingDto
import com.igng.tokenmonitor.android.data.model.SubscriptionTopUpDto
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

/**
 * Apply a single subscription edit to the document returned by the Hub.
 *
 * The editor starts from a possibly stale snapshot. Keeping the mutation as a
 * function of the latest list lets the ViewModel retry a 409 without replacing
 * unrelated records written by another client in the meantime.
 */
fun upsertSubscription(
  subscriptions: List<SubscriptionDto>,
  draft: SubscriptionDto
): List<SubscriptionDto> = subscriptions
  .filterNot { it.id == draft.id }
  .plus(draft)

fun removeSubscription(
  subscriptions: List<SubscriptionDto>,
  id: String
): List<SubscriptionDto> = subscriptions.filterNot { it.id == id }

/** Apply a top-up edit while retaining any top-ups added concurrently. */
fun upsertTopUp(
  subscriptions: List<SubscriptionDto>,
  recordTemplate: SubscriptionDto,
  entry: SubscriptionTopUpDto
): List<SubscriptionDto> {
  val existing = subscriptions.firstOrNull { it.id == recordTemplate.id }
  val base = existing ?: recordTemplate
  val updated = base.copy(
    provider = recordTemplate.provider,
    binding = recordTemplate.binding,
    planName = recordTemplate.planName,
    currency = recordTemplate.currency,
    topUps = base.topUps.filterNot { it.id == entry.id } + entry,
    autoRenew = false,
    note = recordTemplate.note,
    updatedAt = ""
  )
  return if (existing == null) {
    subscriptions + updated
  } else {
    subscriptions.map { if (it.id == recordTemplate.id) updated else it }
  }
}

/** A delete is already satisfied when another client removed the record first. */
fun removeTopUp(
  subscriptions: List<SubscriptionDto>,
  recordId: String,
  entryId: String
): List<SubscriptionDto> {
  val record = subscriptions.firstOrNull { it.id == recordId } ?: return subscriptions
  val remaining = record.topUps.filterNot { it.id == entryId }
  return if (remaining.isEmpty()) {
    subscriptions.filterNot { it.id == recordId }
  } else {
    subscriptions.map {
      if (it.id == recordId) it.copy(topUps = remaining, updatedAt = "") else it
    }
  }
}

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
