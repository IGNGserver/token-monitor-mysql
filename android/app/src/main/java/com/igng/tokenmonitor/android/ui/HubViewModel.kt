package com.igng.tokenmonitor.android.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.igng.tokenmonitor.android.data.model.BatchPricingResponseDto
import com.igng.tokenmonitor.android.data.model.DeviceDto
import com.igng.tokenmonitor.android.data.model.PeriodDto
import com.igng.tokenmonitor.android.data.model.PricingDto
import com.igng.tokenmonitor.android.data.model.PricingRequestDto
import com.igng.tokenmonitor.android.data.model.StatsDto
import com.igng.tokenmonitor.android.data.model.UsageRangeDto
import com.igng.tokenmonitor.android.data.repository.HubRepository
import com.igng.tokenmonitor.android.data.repository.HubResult
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

enum class RealtimeStatus { Live, Reconnecting, Disconnected }

/** Preset windows for share analytics; Custom uses hub /api/usage/range. */
enum class AnalyticsPeriodKind { Today, Month, AllTime, Custom }

data class CustomRangeSelection(
  val fromInclusive: Instant,
  val toExclusive: Instant,
  val label: String
)

data class HubUiState(
  val stats: StatsDto? = null,
  val devices: List<DeviceDto> = emptyList(),
  val pricing: List<PricingDto> = emptyList(),
  val isLoading: Boolean = false,
  val error: String? = null,
  val realtime: RealtimeStatus = RealtimeStatus.Disconnected,
  val batchResult: BatchPricingResponseDto? = null,
  val analyticsPeriod: AnalyticsPeriodKind = AnalyticsPeriodKind.Today,
  val customRange: CustomRangeSelection? = null,
  val customRangeResult: UsageRangeDto? = null,
  val customRangeLoading: Boolean = false
)

@HiltViewModel
class HubViewModel @Inject constructor(private val repository: HubRepository) : ViewModel() {
  private val _state = MutableStateFlow(HubUiState())
  val state = _state.asStateFlow()
  private var sseJob: Job? = null
  private var rangeJob: Job? = null

  init { refreshAll(); startRealtime() }

  fun refreshAll() {
    refreshStats()
    refreshDevices()
    refreshPricing()
    val current = _state.value
    if (current.analyticsPeriod == AnalyticsPeriodKind.Custom && current.customRange != null) {
      loadCustomRange(current.customRange.fromInclusive, current.customRange.toExclusive, current.customRange.label)
    }
  }

  fun refreshStats() = viewModelScope.launch {
    _state.value = _state.value.copy(isLoading = true, error = null)
    when (val result = repository.stats()) {
      is HubResult.Success -> _state.value = _state.value.copy(stats = result.value, isLoading = false)
      is HubResult.Failure -> _state.value = _state.value.copy(isLoading = false, error = result.error.message, realtime = RealtimeStatus.Disconnected)
    }
  }

  fun refreshDevices() = viewModelScope.launch {
    when (val result = repository.devices()) {
      is HubResult.Success -> _state.value = _state.value.copy(devices = result.value.devices)
      is HubResult.Failure -> _state.value = _state.value.copy(error = result.error.message)
    }
  }

  fun refreshPricing() = viewModelScope.launch {
    when (val result = repository.pricing()) {
      is HubResult.Success -> _state.value = _state.value.copy(pricing = result.value.pricing, error = null)
      is HubResult.Failure -> _state.value = _state.value.copy(error = result.error.message)
    }
  }

  fun savePricing(model: String, request: PricingRequestDto) = viewModelScope.launch {
    when (val result = repository.putPricing(model, request)) {
      is HubResult.Success -> refreshPricing()
      is HubResult.Failure -> _state.value = _state.value.copy(error = result.error.message)
    }
  }

  fun fetchUpstream(model: String) = viewModelScope.launch {
    when (val result = repository.fetchUpstream(model)) {
      is HubResult.Success -> refreshPricing()
      is HubResult.Failure -> _state.value = _state.value.copy(error = result.error.message)
    }
  }

  fun fetchAllUpstream() = viewModelScope.launch {
    when (val result = repository.fetchAllUpstream()) {
      is HubResult.Success -> {
        _state.value = _state.value.copy(batchResult = result.value)
        refreshPricing()
      }
      is HubResult.Failure -> _state.value = _state.value.copy(error = result.error.message)
    }
  }

  fun clearBatchResult() { _state.value = _state.value.copy(batchResult = null) }
  fun dismissError() { _state.value = _state.value.copy(error = null) }

  fun setAnalyticsPeriod(kind: AnalyticsPeriodKind) {
    if (kind == AnalyticsPeriodKind.Custom) {
      _state.value = _state.value.copy(analyticsPeriod = AnalyticsPeriodKind.Custom)
      return
    }
    rangeJob?.cancel()
    _state.value = _state.value.copy(
      analyticsPeriod = kind,
      customRangeLoading = false
    )
  }

  fun loadCustomRange(fromInclusive: Instant, toExclusive: Instant, label: String? = null) {
    val rangeLabel = label ?: formatRangeLabel(fromInclusive, toExclusive)
    val selection = CustomRangeSelection(fromInclusive, toExclusive, rangeLabel)
    rangeJob?.cancel()
    rangeJob = viewModelScope.launch {
      _state.value = _state.value.copy(
        analyticsPeriod = AnalyticsPeriodKind.Custom,
        customRange = selection,
        customRangeLoading = true,
        error = null
      )
      when (val result = repository.usageRange(fromInclusive.toString(), toExclusive.toString())) {
        is HubResult.Success -> _state.value = _state.value.copy(
          customRangeResult = result.value,
          customRangeLoading = false
        )
        is HubResult.Failure -> _state.value = _state.value.copy(
          customRangeLoading = false,
          error = result.error.message
        )
      }
    }
  }

  fun currentSharePeriod(): PeriodDto? {
    val state = _state.value
    return when (state.analyticsPeriod) {
      AnalyticsPeriodKind.Today -> state.stats?.periods?.today
      AnalyticsPeriodKind.Month -> state.stats?.periods?.month
      AnalyticsPeriodKind.AllTime -> state.stats?.periods?.allTime
      AnalyticsPeriodKind.Custom -> state.customRangeResult?.toPeriodDto()
    }
  }

  fun clientModelsFor(clientId: String): Map<String, Long> {
    val state = _state.value
    return when (state.analyticsPeriod) {
      AnalyticsPeriodKind.Custom -> state.customRangeResult?.clientModels?.get(clientId).orEmpty()
      else -> emptyMap()
    }
  }

  fun clientModelCostsFor(clientId: String): Map<String, Double> {
    val state = _state.value
    return when (state.analyticsPeriod) {
      AnalyticsPeriodKind.Custom -> state.customRangeResult?.clientModelCosts?.get(clientId).orEmpty()
      else -> emptyMap()
    }
  }

  fun clientsForModel(modelId: String): Pair<Map<String, Long>, Map<String, Double>> {
    val state = _state.value
    val range = state.customRangeResult ?: return emptyMap<String, Long>() to emptyMap()
    val tokens = linkedMapOf<String, Long>()
    val costs = linkedMapOf<String, Double>()
    for ((client, models) in range.clientModels) {
      val t = models[modelId] ?: continue
      tokens[client] = t
      costs[client] = range.clientModelCosts[client]?.get(modelId) ?: 0.0
    }
    return tokens to costs
  }

  fun restartRealtime() { sseJob?.cancel(); startRealtime() }

  private fun startRealtime() {
    if (!repository.connection().isComplete) return
    sseJob = viewModelScope.launch {
      var backoffMs = 1_000L
      while (isActive) {
        _state.value = _state.value.copy(realtime = RealtimeStatus.Reconnecting)
        runCatching {
          repository.statsEvents().collect { event ->
            event.stats?.let { _state.value = _state.value.copy(stats = it, realtime = RealtimeStatus.Live, error = null) }
            backoffMs = 1_000L
          }
        }.onFailure {
          if (isActive) _state.value = _state.value.copy(realtime = RealtimeStatus.Disconnected)
        }
        if (isActive) {
          _state.value = _state.value.copy(realtime = RealtimeStatus.Reconnecting)
          delay(backoffMs)
          backoffMs = (backoffMs * 2).coerceAtMost(30_000L)
        }
      }
    }
  }
}

private fun UsageRangeDto.toPeriodDto(): PeriodDto = PeriodDto(
  totalTokens = totalTokens,
  costUsd = costUsd,
  clients = clients,
  clientCosts = clientCosts,
  models = models,
  modelCosts = modelCosts
)

private val rangeLabelFormatter: DateTimeFormatter =
  DateTimeFormatter.ofPattern("MM-dd HH:mm").withZone(ZoneId.systemDefault())

fun formatRangeLabel(fromInclusive: Instant, toExclusive: Instant): String {
  val endInclusive = toExclusive.minusSeconds(1)
  return "${rangeLabelFormatter.format(fromInclusive)} → ${rangeLabelFormatter.format(endInclusive)}"
}
