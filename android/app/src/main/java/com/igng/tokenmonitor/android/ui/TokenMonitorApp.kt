@file:OptIn(
  androidx.compose.material.ExperimentalMaterialApi::class,
  androidx.compose.material3.ExperimentalMaterial3Api::class
)

package com.igng.tokenmonitor.android.ui

import com.igng.tokenmonitor.android.BuildConfig

import android.net.Uri
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.pullrefresh.PullRefreshIndicator
import androidx.compose.material.pullrefresh.pullRefresh
import androidx.compose.material.pullrefresh.rememberPullRefreshState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AttachMoney
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Devices
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.PieChart
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.igng.tokenmonitor.android.data.model.BatchPricingResultDto
import com.igng.tokenmonitor.android.data.model.DeviceDto
import com.igng.tokenmonitor.android.data.model.PeriodDto
import com.igng.tokenmonitor.android.data.model.PricingDto
import com.igng.tokenmonitor.android.data.model.PricingRequestDto
import com.igng.tokenmonitor.android.data.model.SessionDto
import com.igng.tokenmonitor.android.data.model.StatsDto
import java.text.NumberFormat
import java.util.Locale
import kotlinx.coroutines.launch

private data class Destination(val route: String, val label: String, val icon: androidx.compose.ui.graphics.vector.ImageVector)

private val destinations = listOf(
  Destination("overview", "总览", Icons.Default.Home),
  Destination("models", "模型", Icons.Default.PieChart),
  Destination("sessions", "对话", Icons.Default.Chat),
  Destination("devices", "设备", Icons.Default.Devices),
  Destination("pricing", "定价", Icons.Default.AttachMoney),
  Destination("settings", "设置", Icons.Default.Settings)
)

@Composable
fun TokenMonitorApp(
  hubViewModel: HubViewModel = hiltViewModel(),
  connectionViewModel: ConnectionViewModel = hiltViewModel()
) {
  val navController = rememberNavController()
  val hubState by hubViewModel.state.collectAsStateWithLifecycle()
  val connectionState by connectionViewModel.state.collectAsStateWithLifecycle()
  val snackbarHost = remember { SnackbarHostState() }
  LaunchedEffect(hubState.error) { hubState.error?.let { snackbarHost.showSnackbar(it); hubViewModel.dismissError() } }
  LaunchedEffect(connectionState.message) { connectionState.message?.let { snackbarHost.showSnackbar(it) } }

  Scaffold(
    snackbarHost = { SnackbarHost(snackbarHost) },
    bottomBar = { AppNavigation(navController) }
  ) { padding ->
    val startDestination = if (connectionState.hubUrl.isBlank() || connectionState.secret.isBlank()) "settings" else "overview"
    NavHost(navController, startDestination = startDestination, modifier = Modifier.padding(padding)) {
      composable("overview") { OverviewScreen(hubState, hubViewModel::refreshAll) }
      composable("models") { ModelsScreen(hubState.stats, hubViewModel::refreshStats) }
      composable("sessions") { SessionsScreen(hubState.stats, navController) }
      composable("devices") { DevicesScreen(hubState.devices, hubViewModel::refreshDevices, navController) }
      composable("pricing") { PricingScreen(hubState, hubViewModel) }
      composable("settings") { SettingsScreen(connectionState, connectionViewModel, hubViewModel::restartRealtime) }
      composable("session/{key}") { backStack ->
        SessionDetailScreen(hubState.stats, Uri.decode(backStack.arguments?.getString("key").orEmpty()))
      }
      composable("device/{id}") { backStack ->
        DeviceDetailScreen(hubState.devices.firstOrNull { it.deviceId == Uri.decode(backStack.arguments?.getString("id").orEmpty()) })
      }
    }
  }
}

@Composable
private fun AppNavigation(navController: NavHostController) {
  val entry by navController.currentBackStackEntryAsState()
  val current = entry?.destination?.route
  NavigationBar {
    destinations.forEach { destination ->
      NavigationBarItem(
        selected = current == destination.route,
        onClick = { navController.navigate(destination.route) { popUpTo("overview"); launchSingleTop = true } },
        icon = { Icon(destination.icon, contentDescription = destination.label) },
        label = { Text(destination.label) }
      )
    }
  }
}

@Composable
private fun OverviewScreen(state: HubUiState, onRefresh: () -> Unit) {
  val refreshState = rememberPullRefreshState(refreshing = state.isLoading, onRefresh = onRefresh)
  Box(Modifier.fillMaxSize().pullRefresh(refreshState)) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
      CenterAlignedTopAppBar(title = { Text("总览") }, actions = { IconButton(onClick = onRefresh) { Icon(Icons.Default.Refresh, "刷新") } })
      RealtimeChip(state.realtime)
      val periods = state.stats?.periods
      MetricCard("今日", periods?.today)
      MetricCard("本月", periods?.month)
      MetricCard("全部时间", periods?.allTime)
      if (state.stats == null && !state.isLoading) EmptyState("尚未加载到用量。请先在设置中配置 Hub 连接。")
    }
    PullRefreshIndicator(state.isLoading, refreshState, Modifier.align(Alignment.TopCenter))
  }
}

@Composable
private fun RealtimeChip(status: RealtimeStatus) {
  val (label, color) = when (status) {
    RealtimeStatus.Live -> "实时" to MaterialTheme.colorScheme.primary
    RealtimeStatus.Reconnecting -> "重连中" to MaterialTheme.colorScheme.tertiary
    RealtimeStatus.Disconnected -> "已断开" to MaterialTheme.colorScheme.error
  }
  AssistChip(onClick = {}, label = { Text(label) }, leadingIcon = { Box(Modifier.size(8.dp).background(color, CircleShape)) })
}

@Composable
private fun MetricCard(title: String, period: PeriodDto?) {
  Card(Modifier.fillMaxWidth()) {
    Row(Modifier.padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween) {
      Column { Text(title, style = MaterialTheme.typography.titleMedium); Text(formatTokens(period?.totalTokens ?: 0), style = MaterialTheme.typography.headlineSmall) }
      Text(formatUsd(period?.costUsd ?: 0.0), style = MaterialTheme.typography.titleMedium)
    }
  }
}

@Composable
private fun ModelsScreen(stats: StatsDto?, onRefresh: () -> Unit) {
  var selected by rememberSaveable { mutableIntStateOf(0) }
  val labels = listOf("今日", "本月", "全部")
  val period = when (selected) { 0 -> stats?.periods?.today; 1 -> stats?.periods?.month; else -> stats?.periods?.allTime }
  Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
    CenterAlignedTopAppBar(title = { Text("模型") }, actions = { IconButton(onClick = onRefresh) { Icon(Icons.Default.Refresh, "刷新") } })
    SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
      labels.forEachIndexed { index, label ->
        SegmentedButton(selected = selected == index, onClick = { selected = index }, shape = SegmentedButtonDefaults.itemShape(index, labels.size), label = { Text(label) })
      }
    }
    if (period == null || period.models.isEmpty()) EmptyState("这个周期没有模型用量。") else {
      ModelShareChart(period)
      LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items(period.models.entries.sortedByDescending { it.value }, key = { it.key }) { (model, tokens) ->
          ListItem(headlineContent = { Text(model) }, supportingContent = { Text(formatTokens(tokens)) }, trailingContent = { Text(formatUsd(period.modelCosts[model] ?: 0.0)) })
          HorizontalDivider()
        }
      }
    }
  }
}

@Composable
private fun ModelShareChart(period: PeriodDto) {
  val colors = listOf(MaterialTheme.colorScheme.primary, MaterialTheme.colorScheme.secondary, MaterialTheme.colorScheme.tertiary, MaterialTheme.colorScheme.error)
  val entries = period.models.entries.sortedByDescending { it.value }.take(6)
  val total = entries.sumOf { it.value }.toFloat().coerceAtLeast(1f)
  Card(Modifier.fillMaxWidth()) {
    Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
      Canvas(Modifier.size(144.dp)) {
        var start = -90f
        entries.forEachIndexed { index, entry ->
          val sweep = entry.value / total * 360f
          drawArc(colors[index % colors.size], start, sweep, useCenter = true, size = Size(size.minDimension, size.minDimension))
          start += sweep
        }
      }
      Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        entries.forEachIndexed { index, entry -> Row(verticalAlignment = Alignment.CenterVertically) { Box(Modifier.size(10.dp).background(colors[index % colors.size], CircleShape)); Spacer(Modifier.width(6.dp)); Text(entry.key, maxLines = 1) } }
      }
    }
  }
}

@Composable
private fun SessionsScreen(stats: StatsDto?, navController: NavHostController) {
  val sessions = availableSessions(stats)
  Column(Modifier.fillMaxSize().padding(16.dp)) {
    CenterAlignedTopAppBar(title = { Text("对话") })
    if (sessions.isEmpty()) EmptyState("Hub 当前没有可用的会话快照。") else LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
      items(sessions, key = { it.first }) { (key, session) ->
        Card(onClick = { navController.navigate("session/${Uri.encode(key)}") }, modifier = Modifier.fillMaxWidth()) {
          Column(Modifier.padding(16.dp)) {
            Text(session.client.orEmpty(), style = MaterialTheme.typography.labelLarge)
            Text(session.sessionId.orEmpty(), style = MaterialTheme.typography.titleMedium, maxLines = 1)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text(formatTokens(session.totalTokens)); Text(formatUsd(session.costUsd)) }
            Text("消息 ${session.messageCount} · 最后使用 ${session.lastUsedAt ?: "未知"}", style = MaterialTheme.typography.bodySmall)
          }
        }
      }
    }
  }
}

@Composable
private fun SessionDetailScreen(stats: StatsDto?, key: String) {
  val session = availableSessions(stats).firstOrNull { it.first == key }?.second
  Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
    CenterAlignedTopAppBar(title = { Text("对话详情") })
    if (session == null) EmptyState("会话不在当前 Hub 快照中。") else {
      Text(session.sessionId.orEmpty(), style = MaterialTheme.typography.titleLarge)
      MetricCard("累计用量", PeriodDto(totalTokens = session.totalTokens, costUsd = session.costUsd))
      TokenBreakdown(session)
      Text("模型", style = MaterialTheme.typography.titleMedium)
      session.models.forEach { (model, tokens) -> ListItem(headlineContent = { Text(model) }, trailingContent = { Text(formatTokens(tokens)) }) }
      Text("当前 Hub 未提供按会话和时间范围查询事件流水的接口；此页展示已有 stats 快照，不会虚构历史趋势。", style = MaterialTheme.typography.bodySmall)
    }
  }
}

@Composable
private fun TokenBreakdown(session: SessionDto) {
  Card(Modifier.fillMaxWidth()) {
    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
      listOf("输入" to session.inputTokens, "输出" to session.outputTokens, "缓存读取" to session.cacheReadTokens, "缓存写入" to session.cacheWriteTokens, "推理" to session.reasoningTokens).forEach { (name, value) ->
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text(name); Text(formatTokens(value)) }
      }
      Text("消息 ${session.messageCount} · 开始 ${session.startedAt ?: "未知"} · 最后使用 ${session.lastUsedAt ?: "未知"}", style = MaterialTheme.typography.bodySmall)
    }
  }
}

@Composable
private fun DevicesScreen(devices: List<DeviceDto>, onRefresh: () -> Unit, navController: NavHostController) {
  Column(Modifier.fillMaxSize().padding(16.dp)) {
    CenterAlignedTopAppBar(title = { Text("设备") }, actions = { IconButton(onClick = onRefresh) { Icon(Icons.Default.Refresh, "刷新") } })
    if (devices.isEmpty()) EmptyState("还没有设备上报到 Hub。") else LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
      items(devices, key = { it.deviceId.orEmpty() }) { device ->
        Card(onClick = { navController.navigate("device/${Uri.encode(device.deviceId.orEmpty())}") }, modifier = Modifier.fillMaxWidth().alpha(if (device.stale) 0.55f else 1f), colors = CardDefaults.cardColors(containerColor = if (device.stale) MaterialTheme.colorScheme.surfaceVariant else MaterialTheme.colorScheme.surface)) {
          Column(Modifier.padding(16.dp)) {
            Text(device.hostname ?: device.deviceId.orEmpty(), style = MaterialTheme.typography.titleMedium)
            Text(device.platform.orEmpty(), style = MaterialTheme.typography.bodyMedium)
            Text(if (device.stale) "离线 · 上次上报 ${device.receivedAt ?: "未知"}" else "上次上报 ${device.receivedAt ?: "未知"}", style = MaterialTheme.typography.bodySmall)
          }
        }
      }
    }
  }
}

@Composable
private fun DeviceDetailScreen(device: DeviceDto?) {
  Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
    CenterAlignedTopAppBar(title = { Text("设备详情") })
    if (device == null) EmptyState("设备已从当前 Hub 快照中移除。") else {
      Text(device.hostname ?: device.deviceId.orEmpty(), style = MaterialTheme.typography.titleLarge)
      Text(device.platform.orEmpty(), style = MaterialTheme.typography.bodyMedium)
      MetricCard("今日", device.periods.today)
      MetricCard("本月", device.periods.month)
      MetricCard("全部时间", device.periods.allTime)
    }
  }
}

@Composable
private fun PricingScreen(state: HubUiState, viewModel: HubViewModel) {
  var editing by remember { mutableStateOf<PricingDto?>(null) }
  var showNew by remember { mutableStateOf(false) }
  Box(Modifier.fillMaxSize()) {
    Column(Modifier.fillMaxSize().padding(16.dp)) {
      CenterAlignedTopAppBar(title = { Text("定价") }, actions = { IconButton(onClick = viewModel::refreshPricing) { Icon(Icons.Default.Refresh, "刷新") } })
      Text("修改价格只影响未来产生的用量记录；已写入历史事件的费用快照不会重算。", style = MaterialTheme.typography.bodySmall)
      Spacer(Modifier.height(8.dp))
      Button(onClick = viewModel::fetchAllUpstream, modifier = Modifier.fillMaxWidth()) { Text("批量从上游拉取全部") }
      Spacer(Modifier.height(8.dp))
      if (state.pricing.isEmpty()) EmptyState("Hub 尚未配置任何模型定价。可手动新增，或在设备有模型记录后批量拉取。") else LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items(state.pricing, key = { it.model }) { pricing ->
          Card(onClick = { editing = pricing }, modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp)) {
              Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column { Text(pricing.model, style = MaterialTheme.typography.titleMedium); Text("${pricing.source} · ${pricing.updatedAt ?: "未知时间"}", style = MaterialTheme.typography.bodySmall) }
                IconButton(onClick = { viewModel.fetchUpstream(pricing.model) }) { Icon(Icons.Default.Refresh, "从上游拉取") }
              }
              Text("输入 ${pricing.inputPricePerMillion} · 输出 ${pricing.outputPricePerMillion}", style = MaterialTheme.typography.bodyMedium)
              Text("缓存读 ${pricing.cacheReadPricePerMillion} · 缓存写 ${pricing.cacheWritePricePerMillion} / 百万 token", style = MaterialTheme.typography.bodySmall)
            }
          }
        }
      }
    }
    FloatingActionButton(onClick = { showNew = true }, modifier = Modifier.align(Alignment.BottomEnd).padding(24.dp)) { Icon(Icons.Default.Add, "新增定价") }
  }
  if (editing != null || showNew) PricingEditorDialog(editing, onDismiss = { editing = null; showNew = false }) { model, request -> viewModel.savePricing(model, request); editing = null; showNew = false }
  state.batchResult?.let { BatchResultDialog(it.results, viewModel::clearBatchResult) }
}

@Composable
private fun PricingEditorDialog(existing: PricingDto?, onDismiss: () -> Unit, onSave: (String, PricingRequestDto) -> Unit) {
  var model by remember(existing) { mutableStateOf(existing?.model.orEmpty()) }
  var input by remember(existing) { mutableStateOf(existing?.inputPricePerMillion?.toString().orEmpty()) }
  var output by remember(existing) { mutableStateOf(existing?.outputPricePerMillion?.toString().orEmpty()) }
  var cacheRead by remember(existing) { mutableStateOf(existing?.cacheReadPricePerMillion?.toString().orEmpty()) }
  var cacheWrite by remember(existing) { mutableStateOf(existing?.cacheWritePricePerMillion?.toString().orEmpty()) }
  val values = listOf(input, output, cacheRead, cacheWrite).map { it.toDoubleOrNull() }
  val valid = model.isNotBlank() && values.all { it != null && it >= 0.0 }
  AlertDialog(
    onDismissRequest = onDismiss,
    title = { Text(if (existing == null) "新增模型定价" else "编辑模型定价") },
    text = {
      Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedTextField(model, { model = it }, label = { Text("模型") }, enabled = existing == null, singleLine = true)
        PriceField("输入 / 百万", input) { input = it }
        PriceField("输出 / 百万", output) { output = it }
        PriceField("缓存读取 / 百万", cacheRead) { cacheRead = it }
        PriceField("缓存写入 / 百万", cacheWrite) { cacheWrite = it }
        if (!valid) Text("模型不能为空，四项价格必须是非负数字。", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
      }
    },
    confirmButton = { TextButton(enabled = valid, onClick = { onSave(model.trim(), PricingRequestDto(values[0]!!, values[1]!!, values[2]!!, values[3]!!)) }) { Text("保存") } },
    dismissButton = { TextButton(onClick = onDismiss) { Text("取消") } }
  )
}

@Composable
private fun PriceField(label: String, value: String, onChange: (String) -> Unit) = OutlinedTextField(value, onChange, label = { Text(label) }, singleLine = true)

@Composable
private fun BatchResultDialog(results: List<BatchPricingResultDto>, dismiss: () -> Unit) = AlertDialog(
  onDismissRequest = dismiss,
  title = { Text("批量拉取结果") },
  text = { Column(Modifier.verticalScroll(rememberScrollState())) { results.forEach { result -> Text("${result.model}: ${if (result.ok) "成功" else result.message ?: result.error ?: "失败"}") } } },
  confirmButton = { TextButton(onClick = dismiss) { Text("关闭") } }
)

@Composable
private fun SettingsScreen(state: ConnectionUiState, viewModel: ConnectionViewModel, restartRealtime: () -> Unit) {
  val uriHandler = LocalUriHandler.current
  Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
    CenterAlignedTopAppBar(title = { Text("设置") })
    Text("Hub 连接", style = MaterialTheme.typography.titleMedium)
    OutlinedTextField(state.hubUrl, viewModel::updateUrl, label = { Text("Hub URL") }, placeholder = { Text("http://192.168.5.28:17321") }, singleLine = true, modifier = Modifier.fillMaxWidth())
    OutlinedTextField(state.secret, viewModel::updateSecret, label = { Text("共享密钥") }, visualTransformation = if (state.secret.isEmpty()) VisualTransformation.None else PasswordVisualTransformation(), singleLine = true, modifier = Modifier.fillMaxWidth())
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      Button(onClick = viewModel::testConnection, enabled = !state.testing) { Text(if (state.testing) "测试中" else "测试连接") }
      OutlinedButton(onClick = { viewModel.save(); restartRealtime() }) { Text("加密保存") }
      TextButton(onClick = viewModel::clear) { Text("清除") }
    }
    HorizontalDivider()
    Text("关于", style = MaterialTheme.typography.titleMedium)
    Text("本项目 fork 自 Javis603/token-monitor，遵循 MIT License。")
    Text("当前 Android 版本：${BuildConfig.VERSION_NAME}")
    state.health?.version?.let { Text("当前连接 Hub 版本：$it") }
    TextButton(onClick = { uriHandler.openUri("https://github.com/IGNGserver/token-monitor-mysql/releases/latest") }) { Text("检查并下载最新 Android 版本") }
  }
}

@Composable
private fun EmptyState(text: String) = Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) { Text(text, style = MaterialTheme.typography.bodyMedium) }

private fun availableSessions(stats: StatsDto?): List<Pair<String, SessionDto>> {
  val periods = listOf(stats?.periods?.today, stats?.periods?.month, stats?.periods?.allTime)
  return periods.firstOrNull { !it?.sessions.isNullOrEmpty() }?.sessions.orEmpty().toList().sortedByDescending { it.second.lastUsedAt.orEmpty() }
}

private fun formatTokens(value: Long): String = NumberFormat.getIntegerInstance(Locale.getDefault()).format(value) + " token"
private fun formatUsd(value: Double): String = "US$" + "%.4f".format(Locale.US, value)
