package com.igng.tokenmonitor.android.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.igng.tokenmonitor.android.data.model.BatchPricingResponseDto
import com.igng.tokenmonitor.android.data.model.DeviceDto
import com.igng.tokenmonitor.android.data.model.PricingDto
import com.igng.tokenmonitor.android.data.model.PricingRequestDto
import com.igng.tokenmonitor.android.data.model.StatsDto
import com.igng.tokenmonitor.android.data.repository.HubRepository
import com.igng.tokenmonitor.android.data.repository.HubResult
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

enum class RealtimeStatus { Live, Reconnecting, Disconnected }

data class HubUiState(
  val stats: StatsDto? = null,
  val devices: List<DeviceDto> = emptyList(),
  val pricing: List<PricingDto> = emptyList(),
  val isLoading: Boolean = false,
  val error: String? = null,
  val realtime: RealtimeStatus = RealtimeStatus.Disconnected,
  val batchResult: BatchPricingResponseDto? = null
)

@HiltViewModel
class HubViewModel @Inject constructor(private val repository: HubRepository) : ViewModel() {
  private val _state = MutableStateFlow(HubUiState())
  val state = _state.asStateFlow()
  private var sseJob: Job? = null

  init { refreshAll(); startRealtime() }

  fun refreshAll() {
    refreshStats()
    refreshDevices()
    refreshPricing()
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
