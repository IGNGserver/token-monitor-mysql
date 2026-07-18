package com.igng.tokenmonitor.android.data.model

import kotlinx.serialization.Serializable

@Serializable
data class HealthDto(
  val ok: Boolean = false,
  val role: String? = null,
  val version: Int? = null,
  val deviceCount: Int? = null,
  val secretRequired: Boolean? = null,
  val now: String? = null
)

@Serializable
data class StatsDto(
  val staleAfterMs: Long? = null,
  val periods: PeriodsDto = PeriodsDto(),
  val devices: List<DeviceDto> = emptyList(),
  val projectsIncomplete: Boolean? = null
)

@Serializable
data class PeriodsDto(
  val today: PeriodDto = PeriodDto(),
  val month: PeriodDto = PeriodDto(),
  val allTime: PeriodDto = PeriodDto()
)

@Serializable
data class PeriodDto(
  val totalTokens: Long = 0,
  val costUsd: Double = 0.0,
  val clients: Map<String, Long> = emptyMap(),
  val clientCosts: Map<String, Double> = emptyMap(),
  val models: Map<String, Long> = emptyMap(),
  val modelCosts: Map<String, Double> = emptyMap(),
  val sessions: Map<String, SessionDto> = emptyMap()
)

@Serializable
data class SessionDto(
  val client: String? = null,
  val sessionId: String? = null,
  val totalTokens: Long = 0,
  val costUsd: Double = 0.0,
  val messageCount: Long = 0,
  val inputTokens: Long = 0,
  val outputTokens: Long = 0,
  val cacheReadTokens: Long = 0,
  val cacheWriteTokens: Long = 0,
  val reasoningTokens: Long = 0,
  val startedAt: String? = null,
  val lastUsedAt: String? = null,
  val models: Map<String, Long> = emptyMap()
)

@Serializable
data class DeviceDto(
  val deviceId: String? = null,
  val hostname: String? = null,
  val platform: String? = null,
  val updatedAt: String? = null,
  val receivedAt: String? = null,
  val stale: Boolean = false,
  val periods: PeriodsDto = PeriodsDto()
)

@Serializable
data class DevicesResponseDto(val devices: List<DeviceDto> = emptyList())

@Serializable
data class PricingDto(
  val id: Long? = null,
  val model: String = "",
  val inputPricePerMillion: Double = 0.0,
  val outputPricePerMillion: Double = 0.0,
  val cacheReadPricePerMillion: Double = 0.0,
  val cacheWritePricePerMillion: Double = 0.0,
  val source: String = "manual",
  val updatedAt: String? = null
)

@Serializable
data class PricingListDto(val pricing: List<PricingDto> = emptyList())

@Serializable
data class PricingRequestDto(
  val inputPricePerMillion: Double,
  val outputPricePerMillion: Double,
  val cacheReadPricePerMillion: Double,
  val cacheWritePricePerMillion: Double
)

@Serializable
data class PricingResponseDto(val ok: Boolean = false, val pricing: PricingDto? = null)

@Serializable
data class BatchPricingResponseDto(val results: List<BatchPricingResultDto> = emptyList())

@Serializable
data class BatchPricingResultDto(
  val model: String = "",
  val ok: Boolean = false,
  val pricing: PricingDto? = null,
  val error: String? = null,
  val message: String? = null
)

@Serializable
data class SseStatsDto(
  val type: String? = null,
  val reason: String? = null,
  val stats: StatsDto? = null,
  val at: String? = null
)
