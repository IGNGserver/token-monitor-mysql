package com.igng.tokenmonitor.android.ui.more

import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.FilterChip
import androidx.compose.ui.draw.clip
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.igng.tokenmonitor.android.data.local.HapticsMode
import com.igng.tokenmonitor.android.data.local.ThemeSeedId
import com.igng.tokenmonitor.android.ui.PreferencesViewModel
import com.igng.tokenmonitor.android.ui.haptics.HapticEvent
import com.igng.tokenmonitor.android.ui.haptics.rememberAppHaptics
import com.igng.tokenmonitor.android.ui.theme.themeSeedSwatch
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.outlined.AttachMoney
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.igng.tokenmonitor.android.BuildConfig
import com.igng.tokenmonitor.android.data.model.BatchPricingResultDto
import com.igng.tokenmonitor.android.data.model.PeriodDto
import com.igng.tokenmonitor.android.data.model.PricingDto
import com.igng.tokenmonitor.android.data.model.PricingRequestDto
import com.igng.tokenmonitor.android.data.model.SessionDto
import com.igng.tokenmonitor.android.data.model.StatsDto
import com.igng.tokenmonitor.android.ui.ConnectionUiState
import com.igng.tokenmonitor.android.ui.ConnectionViewModel
import com.igng.tokenmonitor.android.ui.HubUiState
import com.igng.tokenmonitor.android.ui.HubViewModel
import com.igng.tokenmonitor.android.ui.components.AppCard
import com.igng.tokenmonitor.android.ui.components.ShareEntry
import com.igng.tokenmonitor.android.ui.components.ShareBarList
import com.igng.tokenmonitor.android.ui.components.SectionHeader
import com.igng.tokenmonitor.android.ui.components.ClientMonogram
import com.igng.tokenmonitor.android.ui.components.ClientBranding
import com.igng.tokenmonitor.android.ui.components.EmptyState
import com.igng.tokenmonitor.android.ui.components.MetricHeroCard
import com.igng.tokenmonitor.android.ui.components.SegmentedTokenBar
import com.igng.tokenmonitor.android.ui.components.formatTokens
import com.igng.tokenmonitor.android.ui.components.formatTokensShort
import com.igng.tokenmonitor.android.ui.components.formatUsd

@Composable
fun MoreHubScreen(navController: NavHostController) {
  Column(Modifier.fillMaxSize()) {
    Column(Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
      Text("更多", style = MaterialTheme.typography.headlineSmall)
      Text(
        "对话、定价与连接设置",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant
      )
    }
    LazyColumn(
      contentPadding = PaddingValues(16.dp),
      verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
      item {
        MoreNavCard(
          title = "对话",
          subtitle = "查看会话快照与 token 拆解",
          icon = Icons.Outlined.ChatBubbleOutline,
          onClick = { navController.navigate("sessions") }
        )
      }
      item {
        MoreNavCard(
          title = "定价",
          subtitle = "管理模型单价与上游同步",
          icon = Icons.Outlined.AttachMoney,
          onClick = { navController.navigate("pricing") }
        )
      }
      item {
        MoreNavCard(
          title = "设置",
          subtitle = "主题色、触感与 Hub 连接",
          icon = Icons.Outlined.Settings,
          onClick = { navController.navigate("settings") }
        )
      }
    }
  }
}

@Composable
private fun MoreNavCard(
  title: String,
  subtitle: String,
  icon: ImageVector,
  onClick: () -> Unit
) {
  AppCard(onClick = onClick) {
    Row(
      Modifier.fillMaxWidth(),
      verticalAlignment = Alignment.CenterVertically
    ) {
      Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
      Spacer(Modifier.width(14.dp))
      Column(Modifier.weight(1f)) {
        Text(title, style = MaterialTheme.typography.titleMedium)
        Text(
          subtitle,
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
      }
      Icon(
        Icons.AutoMirrored.Filled.KeyboardArrowRight,
        contentDescription = null,
        tint = MaterialTheme.colorScheme.onSurfaceVariant
      )
    }
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SessionsScreen(stats: StatsDto?, navController: NavHostController) {
  val sessions = availableSessions(stats)
  val costRank = sessions
    .sortedByDescending { it.second.costUsd }
    .take(8)
    .map { (key, session) ->
      val label = session.sessionId.orEmpty().ifBlank { key }.let { id ->
        if (id.length > 18) id.take(16) + "…" else id
      }
      ShareEntry(
        key = label,
        tokens = session.totalTokens.coerceAtLeast(0L),
        costUsd = session.costUsd
      )
    }
  Column(Modifier.fillMaxSize()) {
    TopAppBar(
      title = { Text("对话") },
      navigationIcon = {
        IconButton(onClick = { navController.popBackStack() }) {
          Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")
        }
      }
    )
    if (sessions.isEmpty()) {
      EmptyState(title = "暂无对话", text = "Hub 当前没有可用的会话快照。")
    } else {
      LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
      ) {
        if (costRank.isNotEmpty()) {
          item {
            AppCard {
              SectionHeader(
                title = "费用排行",
                subtitle = "按会话费用 Top ${costRank.size}"
              )
              Spacer(Modifier.height(12.dp))
              ShareBarList(entries = costRank, brandClients = false, showCost = true)
            }
          }
        }
        items(sessions, key = { it.first }) { (key, session) ->
          val clientId = session.client.orEmpty()
          AppCard(onClick = { navController.navigate("session/${Uri.encode(key)}") }) {
            Row(verticalAlignment = Alignment.CenterVertically) {
              if (clientId.isNotBlank()) {
                ClientMonogram(clientId, size = 28.dp)
                Spacer(Modifier.width(10.dp))
              }
              Column(Modifier.weight(1f)) {
                Text(
                  if (clientId.isBlank()) "未知客户端" else ClientBranding.label(clientId),
                  style = MaterialTheme.typography.labelLarge,
                  color = MaterialTheme.colorScheme.primary
                )
                Text(
                  session.sessionId.orEmpty().ifBlank { key },
                  style = MaterialTheme.typography.titleMedium,
                  maxLines = 1,
                  overflow = TextOverflow.Ellipsis
                )
              }
            }
            Spacer(Modifier.height(8.dp))
            Row(
              Modifier.fillMaxWidth(),
              horizontalArrangement = Arrangement.SpaceBetween
            ) {
              Text(formatTokensShort(session.totalTokens), style = MaterialTheme.typography.titleSmall)
              Text(
                formatUsd(session.costUsd, compact = true),
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
              )
            }
            Spacer(Modifier.height(4.dp))
            Text(
              "消息 ${session.messageCount} · 最后使用 ${session.lastUsedAt ?: "未知"}",
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant
            )
          }
        }
      }
    }
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SessionDetailScreen(stats: StatsDto?, key: String, onBack: () -> Unit) {
  val session = availableSessions(stats).firstOrNull { it.first == key }?.second
  Column(Modifier.fillMaxSize()) {
    TopAppBar(
      title = { Text("对话详情") },
      navigationIcon = {
        IconButton(onClick = onBack) {
          Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")
        }
      }
    )
    if (session == null) {
      EmptyState(text = "会话不在当前 Hub 快照中。")
      return
    }
    Column(
      Modifier
        .fillMaxSize()
        .verticalScroll(rememberScrollState())
        .padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
      Row(verticalAlignment = Alignment.CenterVertically) {
        val clientId = session.client.orEmpty()
        if (clientId.isNotBlank()) {
          ClientMonogram(clientId, size = 36.dp)
          Spacer(Modifier.width(12.dp))
        }
        Column {
          Text(
            if (clientId.isBlank()) "未知客户端" else ClientBranding.label(clientId),
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.primary
          )
          Text(
            session.sessionId.orEmpty().ifBlank { key },
            style = MaterialTheme.typography.headlineSmall
          )
        }
      }
      MetricHeroCard(
        title = "累计用量",
        period = PeriodDto(totalTokens = session.totalTokens, costUsd = session.costUsd)
      )
      AppCard {
        Text("Token 类型", style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(12.dp))
        SegmentedTokenBar(
          listOf(
            "输入" to session.inputTokens,
            "输出" to session.outputTokens,
            "缓存读取" to session.cacheReadTokens,
            "缓存写入" to session.cacheWriteTokens,
            "推理" to session.reasoningTokens
          )
        )
        Spacer(Modifier.height(10.dp))
        Text(
          "消息 ${session.messageCount} · 开始 ${session.startedAt ?: "未知"} · 最后使用 ${session.lastUsedAt ?: "未知"}",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
      }
      if (session.models.isNotEmpty()) {
        AppCard {
          Text("模型", style = MaterialTheme.typography.titleMedium)
          Spacer(Modifier.height(8.dp))
          session.models.entries.sortedByDescending { it.value }.forEach { (model, tokens) ->
            Row(
              Modifier
                .fillMaxWidth()
                .padding(vertical = 6.dp),
              horizontalArrangement = Arrangement.SpaceBetween
            ) {
              Text(
                model,
                style = MaterialTheme.typography.bodyMedium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f)
              )
              Spacer(Modifier.width(8.dp))
              Text(formatTokens(tokens), style = MaterialTheme.typography.bodyMedium)
            }
          }
        }
      }
      Text(
        "当前 Hub 未提供按会话和时间范围查询事件流水的接口；此页展示已有 stats 快照，不会虚构历史趋势。",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant
      )
    }
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PricingScreen(state: HubUiState, viewModel: HubViewModel, onBack: () -> Unit) {
  var editing by remember { mutableStateOf<PricingDto?>(null) }
  var showNew by remember { mutableStateOf(false) }

  androidx.compose.foundation.layout.Box(Modifier.fillMaxSize()) {
    Column(Modifier.fillMaxSize()) {
      TopAppBar(
        title = { Text("定价") },
        navigationIcon = {
          IconButton(onClick = onBack) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")
          }
        },
        actions = {
          IconButton(onClick = viewModel::refreshPricing) {
            Icon(Icons.Default.Refresh, contentDescription = "刷新")
          }
        }
      )
      LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
      ) {
        item {
          Text(
            "修改价格只影响未来产生的用量记录；已写入历史事件的费用快照不会重算。",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )
        }
        item {
          Button(
            onClick = viewModel::fetchAllUpstream,
            modifier = Modifier.fillMaxWidth()
          ) { Text("批量从上游拉取全部") }
        }
        if (state.pricing.isEmpty()) {
          item {
            EmptyState(text = "Hub 尚未配置任何模型定价。可手动新增，或在设备有模型记录后批量拉取。")
          }
        } else {
          items(state.pricing, key = { it.model }) { pricing ->
            AppCard(onClick = { editing = pricing }) {
              Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
              ) {
                Column(Modifier.weight(1f)) {
                  Text(pricing.model, style = MaterialTheme.typography.titleMedium)
                  Text(
                    "${pricing.source} · ${pricing.updatedAt ?: "未知时间"}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                  )
                }
                IconButton(onClick = { viewModel.fetchUpstream(pricing.model) }) {
                  Icon(Icons.Default.Refresh, contentDescription = "从上游拉取")
                }
              }
              Spacer(Modifier.height(8.dp))
              Text(
                "输入 ${pricing.inputPricePerMillion} · 输出 ${pricing.outputPricePerMillion}",
                style = MaterialTheme.typography.bodyMedium
              )
              Text(
                "缓存读 ${pricing.cacheReadPricePerMillion} · 缓存写 ${pricing.cacheWritePricePerMillion} / 百万 token",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
              )
            }
          }
        }
      }
    }
    FloatingActionButton(
      onClick = { showNew = true },
      modifier = Modifier
        .align(Alignment.BottomEnd)
        .padding(20.dp)
    ) {
      Icon(Icons.Default.Add, contentDescription = "新增")
    }
  }

  if (showNew || editing != null) {
    PricingEditorDialog(
      existing = editing,
      onDismiss = { showNew = false; editing = null },
      onSave = { model, request ->
        viewModel.savePricing(model, request)
        showNew = false
        editing = null
      }
    )
  }
  state.batchResult?.let { result ->
    BatchResultDialog(result.results) { viewModel.clearBatchResult() }
  }
}

@Composable
private fun PricingEditorDialog(
  existing: PricingDto?,
  onDismiss: () -> Unit,
  onSave: (String, PricingRequestDto) -> Unit
) {
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
        OutlinedTextField(
          model,
          { model = it },
          label = { Text("模型") },
          enabled = existing == null,
          singleLine = true
        )
        PriceField("输入 / 百万", input) { input = it }
        PriceField("输出 / 百万", output) { output = it }
        PriceField("缓存读取 / 百万", cacheRead) { cacheRead = it }
        PriceField("缓存写入 / 百万", cacheWrite) { cacheWrite = it }
        if (!valid) {
          Text(
            "模型不能为空，四项价格必须是非负数字。",
            color = MaterialTheme.colorScheme.error,
            style = MaterialTheme.typography.bodySmall
          )
        }
      }
    },
    confirmButton = {
      TextButton(
        enabled = valid,
        onClick = {
          onSave(
            model.trim(),
            PricingRequestDto(values[0]!!, values[1]!!, values[2]!!, values[3]!!)
          )
        }
      ) { Text("保存") }
    },
    dismissButton = { TextButton(onClick = onDismiss) { Text("取消") } }
  )
}

@Composable
private fun PriceField(label: String, value: String, onChange: (String) -> Unit) {
  OutlinedTextField(value, onChange, label = { Text(label) }, singleLine = true)
}

@Composable
private fun BatchResultDialog(results: List<BatchPricingResultDto>, dismiss: () -> Unit) {
  AlertDialog(
    onDismissRequest = dismiss,
    title = { Text("批量拉取结果") },
    text = {
      Column(Modifier.verticalScroll(rememberScrollState())) {
        results.forEach { result ->
          Text("${result.model}: ${if (result.ok) "成功" else result.message ?: result.error ?: "失败"}")
        }
      }
    },
    confirmButton = { TextButton(onClick = dismiss) { Text("关闭") } }
  )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
  state: ConnectionUiState,
  viewModel: ConnectionViewModel,
  restartRealtime: () -> Unit,
  onBack: () -> Unit,
  preferencesViewModel: PreferencesViewModel = hiltViewModel()
) {
  val uriHandler = LocalUriHandler.current
  val prefs by preferencesViewModel.preferences.collectAsStateWithLifecycle()
  val haptics = rememberAppHaptics()

  Column(Modifier.fillMaxSize()) {
    TopAppBar(
      title = { Text("设置") },
      navigationIcon = {
        IconButton(onClick = {
          haptics.perform(HapticEvent.Tap)
          onBack()
        }) {
          Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")
        }
      }
    )
    Column(
      Modifier
        .fillMaxSize()
        .verticalScroll(rememberScrollState())
        .padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
      AppCard {
        Text("外观", style = MaterialTheme.typography.titleMedium)
        Text(
          "主题色会应用到按钮、导航与强调色。选择「系统」可跟随壁纸动态取色（Android 12+）。",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.height(12.dp))
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
          listOf(
            listOf(ThemeSeedId.System, ThemeSeedId.Blue, ThemeSeedId.Green, ThemeSeedId.Purple),
            listOf(ThemeSeedId.Teal, ThemeSeedId.Orange, ThemeSeedId.Rose)
          ).forEach { rowSeeds ->
            Row(
              Modifier.fillMaxWidth(),
              horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
              rowSeeds.forEach { seed ->
                val selected = prefs.themeSeed == seed
                val swatch = themeSeedSwatch(seed)
                Column(
                  horizontalAlignment = Alignment.CenterHorizontally,
                  modifier = Modifier
                    .weight(1f)
                    .clickable {
                      preferencesViewModel.setThemeSeed(seed)
                      haptics.perform(HapticEvent.Selection)
                    }
                ) {
                  Box(
                    Modifier
                      .size(40.dp)
                      .clip(CircleShape)
                      .background(swatch)
                      .then(
                        if (selected) {
                          Modifier.border(3.dp, MaterialTheme.colorScheme.onSurface, CircleShape)
                        } else {
                          Modifier.border(1.dp, MaterialTheme.colorScheme.outlineVariant, CircleShape)
                        }
                      )
                  )
                  Spacer(Modifier.height(4.dp))
                  Text(
                    seed.labelZh,
                    style = MaterialTheme.typography.labelSmall,
                    color = if (selected) {
                      MaterialTheme.colorScheme.primary
                    } else {
                      MaterialTheme.colorScheme.onSurfaceVariant
                    },
                    maxLines = 1
                  )
                }
              }
              // keep second row spacing balanced when only 3 chips
              if (rowSeeds.size < 4) {
                repeat(4 - rowSeeds.size) { Spacer(Modifier.weight(1f)) }
              }
            }
          }
        }
      }

      AppCard {
        Text("触感反馈", style = MaterialTheme.typography.titleMedium)
        Text(
          "标准：按钮轻触反馈。增强：切换、成功、错误等使用更丰富的震动模式。",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.height(10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          HapticsMode.entries.forEach { mode ->
            FilterChip(
              selected = prefs.hapticsMode == mode,
              onClick = {
                preferencesViewModel.setHapticsMode(mode)
                if (mode != HapticsMode.Off) {
                  haptics.perform(
                    if (mode == HapticsMode.Enhanced) HapticEvent.Confirm else HapticEvent.Tap,
                    forceMode = mode
                  )
                }
              },
              label = { Text(mode.labelZh) }
            )
          }
        }
        if (prefs.hapticsMode == HapticsMode.Enhanced) {
          Spacer(Modifier.height(8.dp))
          Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = { haptics.perform(HapticEvent.Success) }) { Text("试听成功") }
            OutlinedButton(onClick = { haptics.perform(HapticEvent.Error) }) { Text("试听错误") }
            OutlinedButton(onClick = { haptics.perform(HapticEvent.Refresh) }) { Text("试听刷新") }
          }
        }
      }

      AppCard {
        Text("Hub 连接", style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
          state.hubUrl,
          viewModel::updateUrl,
          label = { Text("Hub URL") },
          placeholder = { Text("http://192.168.5.28:17321") },
          singleLine = true,
          modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(
          state.secret,
          viewModel::updateSecret,
          label = { Text("共享密钥") },
          visualTransformation = if (state.secret.isEmpty()) {
            VisualTransformation.None
          } else {
            PasswordVisualTransformation()
          },
          singleLine = true,
          modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          Button(
            onClick = {
              haptics.perform(HapticEvent.Confirm)
              viewModel.testConnection()
            },
            enabled = !state.testing
          ) { Text(if (state.testing) "测试中" else "测试连接") }
          OutlinedButton(onClick = {
            haptics.perform(HapticEvent.Success)
            viewModel.save()
            restartRealtime()
          }) { Text("加密保存") }
        }
        TextButton(onClick = {
          haptics.perform(HapticEvent.Error)
          viewModel.clear()
        }) { Text("清除本机连接") }
      }

      AppCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
          Icon(Icons.Outlined.Info, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
          Spacer(Modifier.width(10.dp))
          Text("关于", style = MaterialTheme.typography.titleMedium)
        }
        Spacer(Modifier.height(10.dp))
        Text(
          "本项目 fork 自 Javis603/token-monitor，遵循 MIT License。",
          style = MaterialTheme.typography.bodyMedium
        )
        Spacer(Modifier.height(6.dp))
        Text(
          "当前 Android 版本：${BuildConfig.VERSION_NAME}",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        state.health?.version?.let {
          Text(
            "当前连接 Hub 版本：$it",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
          )
        }
        Spacer(Modifier.height(4.dp))
        TextButton(
          onClick = {
            haptics.perform(HapticEvent.Tap)
            uriHandler.openUri("https://github.com/IGNGserver/token-monitor-mysql/releases/latest")
          }
        ) { Text("检查并下载最新 Android 版本") }
      }
    }
  }
}

fun availableSessions(stats: StatsDto?): List<Pair<String, SessionDto>> {
  val periods = listOf(stats?.periods?.today, stats?.periods?.month, stats?.periods?.allTime)
  return periods
    .firstOrNull { !it?.sessions.isNullOrEmpty() }
    ?.sessions
    .orEmpty()
    .toList()
    .sortedByDescending { it.second.lastUsedAt.orEmpty() }
}

