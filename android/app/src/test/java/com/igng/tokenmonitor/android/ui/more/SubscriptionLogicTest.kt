package com.igng.tokenmonitor.android.ui.more

import com.igng.tokenmonitor.android.data.model.SubscriptionDto
import com.igng.tokenmonitor.android.data.model.SubscriptionBindingDto
import com.igng.tokenmonitor.android.data.model.SubscriptionTopUpDto
import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SubscriptionLogicTest {
  @Test
  fun monthlyRenewalKeepsTheOriginalDayOfMonth() {
    val subscription = SubscriptionDto(
      provider = "codex",
      interval = "month",
      startDate = "2026-01-31",
      autoRenew = true
    )

    assertEquals(
      LocalDate.of(2026, 3, 31),
      subscriptionNextRenewalDate(subscription, LocalDate.of(2026, 3, 1))
    )
  }

  @Test
  fun cancelledSubscriptionStopsAtTheFirstUnpaidBoundary() {
    val subscription = SubscriptionDto(
      provider = "claude",
      startDate = "2026-01-31",
      autoRenew = false
    )

    assertEquals(LocalDate.of(2026, 2, 28), subscriptionCoverageStopDate(subscription))
    assertTrue(subscriptionIsActive(subscription, LocalDate.of(2026, 2, 27)))
    assertFalse(subscriptionIsActive(subscription, LocalDate.of(2026, 2, 28)))
    assertNull(subscriptionNextRenewalDate(subscription, LocalDate.of(2026, 2, 1)))
  }

  @Test
  fun monthlyTotalsGroupCurrenciesAndIncludeOnlyCurrentMonthTopUps() {
    val subscriptions = listOf(
      SubscriptionDto(
        provider = "codex",
        amountMinor = 1200,
        interval = "year",
        startDate = "2026-01-01",
        currency = "USD"
      ),
      SubscriptionDto(
        provider = "deepseek",
        kind = "topup",
        currency = "CNY",
        topUps = listOf(
          SubscriptionTopUpDto(id = "old", date = "2026-07-30", amountMinor = 500),
          SubscriptionTopUpDto(id = "new", date = "2026-08-02", amountMinor = 1000)
        )
      )
    )

    val totals = subscriptionMonthlyTotals(subscriptions, LocalDate.of(2026, 8, 20))

    assertEquals(1.0, totals["USD"] ?: 0.0, 0.001)
    assertEquals(10.0, totals["CNY"] ?: 0.0, 0.001)
  }

  @Test
  fun topUpTotalIgnoresNegativeAmounts() {
    val subscription = SubscriptionDto(
      provider = "deepseek",
      kind = "topup",
      topUps = listOf(
        SubscriptionTopUpDto(id = "a", date = "2026-08-01", amountMinor = 100),
        SubscriptionTopUpDto(id = "b", date = "2026-08-02", amountMinor = -50)
      )
    )

    assertEquals(100L, subscriptionTopUpTotalMinor(subscription))
  }

  @Test
  fun subscriptionEditRebasesOntoConcurrentRecords() {
    val remote = SubscriptionDto(id = "remote", provider = "claude")
    val draft = SubscriptionDto(id = "local", provider = "codex", planName = "Pro")

    val result = upsertSubscription(listOf(remote), draft)

    assertEquals(listOf("remote", "local"), result.map { it.id })
    assertEquals("Pro", result.last().planName)
  }

  @Test
  fun topUpEditRetainsConcurrentTopUp() {
    val record = SubscriptionDto(
      id = "credits",
      provider = "deepseek",
      kind = "topup",
      binding = SubscriptionBindingDto(accountEmail = "old@example.com"),
      topUps = listOf(SubscriptionTopUpDto(id = "remote-entry", amountMinor = 500))
    )
    val template = record.copy(
      binding = SubscriptionBindingDto(accountEmail = "new@example.com"),
      topUps = emptyList()
    )
    val localEntry = SubscriptionTopUpDto(id = "local-entry", amountMinor = 900)

    val result = upsertTopUp(listOf(record), template, localEntry).single()

    assertEquals("new@example.com", result.binding.accountEmail)
    assertEquals(listOf("remote-entry", "local-entry"), result.topUps.map { it.id })
  }

  @Test
  fun removingMissingTopUpIsAnIdempotentRebase() {
    val record = SubscriptionDto(
      id = "credits",
      kind = "topup",
      topUps = listOf(SubscriptionTopUpDto(id = "already-removed"))
    )

    assertEquals(
      listOf(record),
      removeTopUp(listOf(record), record.id, "other-entry")
    )
  }
}
