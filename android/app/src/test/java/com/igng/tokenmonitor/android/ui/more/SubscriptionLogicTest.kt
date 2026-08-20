package com.igng.tokenmonitor.android.ui.more

import com.igng.tokenmonitor.android.data.model.SubscriptionDto
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
}
