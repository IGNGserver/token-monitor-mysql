package com.igng.tokenmonitor.android.ui.analytics

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.PieChartOutline
import androidx.compose.material.icons.outlined.Timeline
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.PrimaryTabRow
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Tab
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.igng.tokenmonitor.android.data.model.PeriodDto
import com.igng.tokenmonitor.android.data.model.StatsDto
import com.igng.tokenmonitor.android.ui.components.AppCard
import com.igng.tokenmonitor.android.ui.components.DailyTrendChart
import com.igng.tokenmonitor.android.ui.components.DonutChart
import com.igng.tokenmonitor.android.ui.components.EmptyState
import com.igng.tokenmonitor.android.ui.components.LimitsSection
import com.igng.tokenmonitor.android.ui.components.MonthlyTrendChart
import com.igng.tokenmonitor.android.ui.components.ShareBarList
import com.igng.tokenmonitor.android.ui.components.TrendMetric
import com.igng.tokenmonitor.android.ui.components.TrendRange
import com.igng.tokenmonitor.android.ui.components.formatTokensShort
import com.igng.tokenmonitor.android.ui.components.formatUsd
import com.igng.tokenmonitor.android.ui.components.takeMonths
import com.igng.tokenmonitor.android.ui.components.takeRange
import com.igng.tokenmonitor.android.ui.components.topShareEntries
import com.igng.tokenmonitor.android.ui.haptics.HapticEvent
import com.igng.tokenmonitor.android.ui.haptics.rememberAppHaptics

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AnalyticsScreen(stats: StatsDto?) {
  var tabIndex by rememberSaveable { mutableIntStateOf(0) }
  val tabLabels = listOf("客户端", "模型", "趋势")
  val haptics = rememberAppHaptics()

  Column(Modifier.fillMaxSize()) {
    Column(
      Modifier
        .fillMaxWidth()
        .padding(horizontal = 16.dp, vertical = 8.dp),
      verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
      Text("分析", style = MaterialTheme.typography.headlineSmall)
      PrimaryTabRow(selectedTabIndex = tabIndex) {
        tabLabels.forEachIndexed { index, label ->
          Tab(
            selected = tabIndex == index,
            onClick = { haptics.perform(HapticEvent.Selection); tabIndex = index },
            text = { Text(label) }
          )
        }
      }
    }

    when (tabIndex) {
      0 -> ShareAnalyticsTab(stats, clients = true)
      1 -> ShareAnalyticsTab(stats, clients = false)
      else -> TrendAnalyticsTab(stats)
    }
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ShareAnalyticsTab(stats: StatsDto?, clients: Boolean) {
  var periodIndex by rememberSaveable(clients) { mutableIntStateOf(0) }
  val periodLabels = listOf("今日", "本月", "全部")
  val haptics = rememberAppHaptics()
  val period: PeriodDto? = when (periodIndex) {
    0 -> stats?.periods?.today
    1 -> stats?.periods?.month
    else -> stats?.periods?.allTime
  }
  val shares = if (clients) {
    topShareEntries(period?.clients.orEmpty(), period?.clientCosts.orEmpty(), limit = 8)
  } else {
    topShareEntries(period?.models.orEmpty(), period?.modelCosts.orEmpty(), limit = 8)
  }
  val emptyText = if (clients) "这个周期没有客户端用量。" else "这个周期没有模型用量。"

  Column(Modifier.fillMaxSize()) {
    SingleChoiceSegmentedButtonRow(
      Modifier
        .fillMaxWidth()
        .padding(horizontal = 16.dp)
    ) {
      periodLabels.forEachIndexed { index, label ->
        SegmentedButton(
          selected = periodIndex == index,
          onClick = { haptics.perform(HapticEvent.Selection); periodIndex = index },
          shape = SegmentedButtonDefaults.itemShape(index, periodLabels.size),
          label = { Text(label) }
        )
      }
    }
    Spacer(Modifier.height(8.dp))
    if (shares.isEmpty()) {
      EmptyState(title = "暂无图表", text = emptyText, icon = Icons.Outlined.PieChartOutline)
    } else {
      LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
      ) {
        item {
          AppCard {
            Text(
              if (clients) "客户端份额" else "模型份额",
              style = MaterialTheme.typography.titleMedium
            )
            Text(
              "${formatTokensShort(period?.totalTokens ?: 0L)} · ${formatUsd(period?.costUsd ?: 0.0)}",
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(Modifier.height(12.dp))
            DonutChart(
              entries = shares,
              centerPrimary = formatTokensShort(period?.totalTokens ?: 0L),
              centerSecondary = formatUsd(period?.costUsd ?: 0.0, compact = true)
            )
          }
        }
        item {
          AppCard {
            Text("明细", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(12.dp))
            ShareBarList(shares, brandClients = clients)
          }
        }
      }
    }
  }
}

@Composable
private fun TrendAnalyticsTab(stats: StatsDto?) {
  var rangeIndex by rememberSaveable { mutableIntStateOf(1) }
  var metricIndex by rememberSaveable { mutableIntStateOf(0) }
  val rangeLabels = listOf("7 日", "30 日", "12 月")
  val metricLabels = listOf("Token", "费用", "对比", "活跃")
  val history = stats?.historyPreview
  val metric = when (metricIndex) {
    1 -> TrendMetric.Cost
    2 -> TrendMetric.Dual
    3 -> TrendMetric.ActiveTime
    else -> TrendMetric.Tokens
  }
  val summary = history?.summary
  val daily = history?.daily.orEmpty()
  val monthly = history?.monthly.orEmpty().takeMonths(12)

  if (history == null || (daily.isEmpty() && monthly.isEmpty())) {
    EmptyState(
      text = "Hub 暂无历史预览。设备上报历史后，这里会显示 7/30 日与 12 月趋势。",
      icon = Icons.Outlined.Timeline
    )
    return
  }

  LazyColumn(
    modifier = Modifier.fillMaxSize(),
    contentPadding = PaddingValues(16.dp),
    verticalArrangement = Arrangement.spacedBy(14.dp)
  ) {
    item {
      Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        rangeLabels.forEachIndexed { index, label ->
          FilterChip(
            selected = rangeIndex == index,
            onClick = { rangeIndex = index },
            label = { Text(label) }
          )
        }
      }
    }
    item {
      Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        metricLabels.forEachIndexed { index, label ->
          FilterChip(
            selected = metricIndex == index,
            onClick = { metricIndex = index },
            label = { Text(label) }
          )
        }
      }
    }

    if (summary != null) {
      item {
        AppCard {
          Text("历史摘要", style = MaterialTheme.typography.titleMedium)
          Spacer(Modifier.height(10.dp))
          SummaryGrid(
            listOf(
              "活跃天" to summary.activeDays.toLong().toString(),
              "连胜" to "${summary.currentStreak.toLong()} 天",
              "最长连胜" to "${summary.longestStreak.toLong()} 天",
              "峰值日" to formatTokensShort(summary.peakDayTokens.toLong()),
              "累计" to formatTokensShort(summary.totalTokens.toLong()),
              "费用" to formatUsd(summary.totalCost, compact = true)
            )
          )
          summary.favoriteModel?.takeIf { it.isNotBlank() }?.let {
            Spacer(Modifier.height(8.dp))
            Text(
              "常用模型 $it",
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
          }
        }
      }
    }

    item {
      AppCard {
        val title = when (rangeIndex) {
          0 -> "近 7 日"
          1 -> "近 30 日"
          else -> "近 12 月"
        }
        Text(
          "$title · ${when (metric) { TrendMetric.Cost -> "费用"; TrendMetric.Dual -> "Token+费用"; TrendMetric.ActiveTime -> "活跃时长"; else -> "Token" }}",
          style = MaterialTheme.typography.titleMedium
        )
        Spacer(Modifier.height(12.dp))
        if (rangeIndex == 2) {
          if (monthly.isEmpty()) {
            Text("暂无月度数据", color = MaterialTheme.colorScheme.onSurfaceVariant)
          } else {
            MonthlyTrendChart(months = monthly, metric = metric)
          }
        } else {
          val range = if (rangeIndex == 0) TrendRange.Days7 else TrendRange.Days30
          val days = daily.takeRange(range)
          if (days.isEmpty()) {
            Text("暂无日度数据", color = MaterialTheme.colorScheme.onSurfaceVariant)
          } else {
            DailyTrendChart(
              days = days,
              metric = metric,
              useLine = rangeIndex == 1
            )
          }
        }
      }
    }

    item { LimitsSection(stats.limits, title = "限额状态") }
  }
}

@Composable
private fun SummaryGrid(items: List<Pair<String, String>>) {
  Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
    items.chunked(2).forEach { row ->
      Row(
        Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
      ) {
        row.forEach { (label, value) ->
          Surface(
            modifier = Modifier.weight(1f),
            shape = MaterialTheme.shapes.medium,
            color = MaterialTheme.colorScheme.surfaceContainerHigh
          ) {
            Column(Modifier.padding(horizontal = 12.dp, vertical = 10.dp)) {
              Text(
                label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
              )
              Text(value, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            }
          }
        }
        if (row.size == 1) Spacer(Modifier.weight(1f))
      }
    }
  }
}



