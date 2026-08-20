package com.igng.tokenmonitor.android.data.model

import kotlinx.serialization.Serializable

@Serializable
data class HealthDto(
  val ok: Boolean = false,
  val role: String? = null,
  val runtime: String? = null,
  val version: Int? = null,
  val hubBuild: HubBuildDto? = null,
  val deviceCount: Int? = null,
  val secretRequired: Boolean? = null,
  val now: String? = null
)

@Serializable
data class HubBuildDto(
  val schemaVersion: Int? = null,
  val runtime: String? = null,
  val coreRevision: Int? = null,
  val coreBuildId: String? = null,
  val runtimeRevision: Int? = null,
  val runtimeBuildId: String? = null
)

@Serializable
data class StatsDto(
  val updatedAt: String? = null,
  val staleAfterMs: Long? = null,
  val periods: PeriodsDto = PeriodsDto(),
  val devices: List<DeviceDto> = emptyList(),
  val projectsIncomplete: Boolean? = null,
  val sessionDetailsOmitted: Map<String, Long> = emptyMap(),
  val periodProjectsOmitted: Map<String, Long> = emptyMap(),
  val historyPreview: HistoryDto? = null,
  val historyRevision: String? = null,
  val deviceHistoryRevision: String? = null,
  val subscriptionsUpdatedAt: String? = null,
  val limits: LimitsDto? = null
)

@Serializable
data class HistoryBreakdownDto(
  val tokens: Double = 0.0,
  val cost: Double = 0.0,
  val messages: Double = 0.0,
  val cacheReadTokens: Double? = null,
  val cacheWriteTokens: Double? = null,
  val outputTokens: Double? = null,
  val unclassifiedTokens: Double? = null,
  val tokenComponentsAvailable: Boolean? = null
)

@Serializable
data class HistoryDayDto(
  val date: String = "",
  val tokens: Double = 0.0,
  val cost: Double = 0.0,
  val activeTimeMs: Double = 0.0,
  val cacheReadTokens: Double? = null,
  val cacheWriteTokens: Double? = null,
  val outputTokens: Double? = null,
  val unclassifiedTokens: Double? = null,
  val tokenComponentsAvailable: Boolean? = null,
  val perClient: Map<String, HistoryBreakdownDto> = emptyMap(),
  val perModel: Map<String, HistoryBreakdownDto> = emptyMap()
)

@Serializable
data class HistoryMonthDto(
  val month: String = "",
  val tokens: Double = 0.0,
  val cost: Double = 0.0,
  val activeTimeMs: Double = 0.0,
  val cacheReadTokens: Double? = null,
  val cacheWriteTokens: Double? = null,
  val outputTokens: Double? = null,
  val unclassifiedTokens: Double? = null,
  val tokenComponentsAvailable: Boolean? = null,
  val perClient: Map<String, HistoryBreakdownDto> = emptyMap(),
  val perModel: Map<String, HistoryBreakdownDto> = emptyMap()
)

/** Full /api/history payload (includes perClient/perModel stacks). */
@Serializable
data class HistoryDto(
  val daily: List<HistoryDayDto> = emptyList(),
  val monthly: List<HistoryMonthDto> = emptyList(),
  val summary: HistorySummaryDto = HistorySummaryDto()
)

typealias HistoryPreviewDto = HistoryDto

@Serializable
data class HistorySummaryDto(
  val totalTokens: Double = 0.0,
  val totalCost: Double = 0.0,
  val activeDays: Double = 0.0,
  val currentStreak: Double = 0.0,
  val longestStreak: Double = 0.0,
  val peakDayTokens: Double = 0.0,
  val favoriteModel: String? = null,
  val messages: Double = 0.0,
  val activeTimeMs: Double = 0.0,
  val timeMetrics: HistoryTimeMetricsDto? = null
)

@Serializable
data class HistoryTimeMetricsDto(
  val totalActiveTimeMs: Double = 0.0,
  val longestContinuousMs: Double = 0.0,
  val maxConcurrentSessions: Double = 0.0,
  val sessionCount: Double = 0.0
)

@Serializable
data class LimitsDto(
  val updatedAt: String? = null,
  val refreshMs: Long? = null,
  val providers: List<LimitProviderDto> = emptyList()
)

@Serializable
data class LimitProviderDto(
  val provider: String = "",
  val accountKey: String? = null,
  val accountKeyAliases: List<String> = emptyList(),
  val webAccountKey: String? = null,
  val accountEmail: String? = null,
  val accountLabel: String? = null,
  val accountName: String? = null,
  val plan: String? = null,
  val planType: String? = null,
  val planLabel: String? = null,
  val workspaceKind: String? = null,
  val status: String? = null,
  val source: String? = null,
  val sourceDetail: String? = null,
  val updatedAt: String? = null,
  val balanceUsd: Double? = null,
  val balance: BalanceDto? = null,
  val resetCredits: ResetCreditsDto? = null,
  val region: String? = null,
  val windows: List<LimitWindowDto> = emptyList()
)

@Serializable
data class BalanceDto(
  val amount: Double? = null,
  val currency: String? = null,
  val todaySpend: Double? = null,
  val weekSpend: Double? = null,
  val monthSpend: Double? = null,
  val allTimeSpend: Double? = null,
  val requestCount: Double? = null,
  val quotaGroup: String? = null,
  val expiresAt: String? = null,
  val trackingSince: String? = null,
  val monthSinceTracking: Boolean? = null,
  val giftBalance: Double? = null,
  val cashBalance: Double? = null,
  val planUsed: Double? = null,
  val planLimit: Double? = null,
  val planPercent: Double? = null,
  val planStatus: String? = null,
  val todayTokenTotal: Double? = null,
  val todayUsageDate: String? = null,
  val latestModelUsageDate: String? = null,
  val todayUsageBasis: String? = null,
  val snapshotDate: String? = null,
  val tranches: List<BalanceTrancheDto> = emptyList()
)

@Serializable
data class BalanceTrancheDto(
  val amount: Double? = null,
  val currency: String? = null,
  val expiresAt: String? = null
)

@Serializable
data class ResetCreditsDto(
  val availableCount: Double? = null,
  val totalCount: Double? = null,
  val available: Double? = null,
  val total: Double? = null,
  val remaining: Double? = null,
  val limit: Double? = null,
  val nextExpiresAt: String? = null,
  val expirations: List<String> = emptyList()
)

@Serializable
data class LimitWindowDto(
  val kind: String = "",
  val source: String? = null,
  val label: String? = null,
  val used: Double? = null,
  val limit: Double? = null,
  val remaining: Double? = null,
  val usedPercent: Double? = null,
  val remainingPercent: Double? = null,
  val resetsAt: String? = null,
  val windowMinutes: Double? = null,
  val resetDescription: String? = null,
  val metric: String? = null,
  val detail: String? = null,
  val currency: String? = null,
  val showMeter: Boolean = true
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
  val capabilities: TokenCapabilitiesDto? = null,
  val cacheReadTokens: Long = 0,
  val cacheWriteTokens: Long = 0,
  val outputTokens: Long = 0,
  val unclassifiedTokens: Long = 0,
  val timedTokens: Long = 0,
  val timedOutputTokens: Long = 0,
  val timedDurationMs: Long = 0,
  val clients: Map<String, Long> = emptyMap(),
  val clientCosts: Map<String, Double> = emptyMap(),
  val clientCacheReads: Map<String, Long> = emptyMap(),
  val clientCacheWrites: Map<String, Long> = emptyMap(),
  val clientOutputs: Map<String, Long> = emptyMap(),
  val clientUnclassifiedTokens: Map<String, Long> = emptyMap(),
  val models: Map<String, Long> = emptyMap(),
  val modelCosts: Map<String, Double> = emptyMap(),
  val modelCacheReads: Map<String, Long> = emptyMap(),
  val modelCacheWrites: Map<String, Long> = emptyMap(),
  val modelOutputs: Map<String, Long> = emptyMap(),
  val modelUnclassifiedTokens: Map<String, Long> = emptyMap(),
  val clientModels: Map<String, Map<String, Long>> = emptyMap(),
  val clientModelCosts: Map<String, Map<String, Double>> = emptyMap(),
  val projects: Map<String, ProjectDto> = emptyMap(),
  val sessions: Map<String, SessionDto> = emptyMap()
)

@Serializable
data class ProjectDto(
  val label: String? = null,
  val tokens: Long = 0,
  val costUsd: Double = 0.0,
  val clients: Map<String, Long> = emptyMap()
)

@Serializable
data class SessionDto(
  val client: String? = null,
  val sessionId: String? = null,
  val projectId: String? = null,
  val projectLabel: String? = null,
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
  val models: Map<String, Long> = emptyMap(),
  val modelCosts: Map<String, Double> = emptyMap(),
  val providers: Map<String, Long> = emptyMap(),
  val archived: Boolean? = null
)

@Serializable
data class TokenCapabilitiesDto(
  val tokenComponents: Boolean? = null
)

@Serializable
data class DeviceDto(
  val deviceId: String? = null,
  val hostname: String? = null,
  val platform: String? = null,
  val osName: String? = null,
  val osVersion: String? = null,
  val agentRuntime: String? = null,
  val agentVersion: String? = null,
  val updatedAt: String? = null,
  val receivedAt: String? = null,
  val ageMs: Long? = null,
  val stale: Boolean = false,
  val trackedClients: List<String> = emptyList(),
  val clientStatus: Map<String, String> = emptyMap(),
  val clientHealth: ClientHealthDto? = null,
  val wslStatus: WslStatusDto? = null,
  val projectsEnabled: Boolean? = null,
  val allTimeProjectsOmitted: Boolean? = null,
  val allTimeProjectsIncomplete: Boolean? = null,
  val sessionDetailsOmitted: Map<String, Long> = emptyMap(),
  val periodProjectsOmitted: Map<String, Long> = emptyMap(),
  val syncUploadIntervalMs: Long? = null,
  val historyAvailable: Boolean? = null,
  val history: HistoryDto? = null,
  val periodWindows: PeriodWindowsDto? = null,
  val periods: PeriodsDto = PeriodsDto(),
  val limits: LimitsDto? = null
)

@Serializable
data class PeriodWindowsDto(
  val today: PeriodWindowDto? = null,
  val month: PeriodWindowDto? = null,
  val timeZone: String? = null
)

@Serializable
data class PeriodWindowDto(
  val endsAt: String = "",
  val key: String? = null
)

@Serializable
data class ClientHealthDto(
  val version: Int? = null,
  val observedAt: String? = null,
  val clients: Map<String, ClientHealthEntryDto> = emptyMap()
)

@Serializable
data class ClientHealthEntryDto(
  val source: ClientHealthSourceDto? = null,
  val collection: ClientHealthCollectionDto? = null,
  val data: ClientHealthDataDto? = null,
  val diagnostics: List<ClientHealthDiagnosticDto> = emptyList(),
  val overall: String? = null
)

@Serializable
data class ClientHealthSourceDto(
  val state: String? = null,
  val detectedCount: Int? = null,
  val checkedCount: Int? = null,
  val checks: List<ClientHealthCheckDto> = emptyList()
)

@Serializable
data class ClientHealthCheckDto(
  val id: String = "",
  val exists: Boolean = false
)

@Serializable
data class ClientHealthCollectionDto(
  val state: String? = null,
  val lastAttemptAt: String? = null,
  val lastSuccessAt: String? = null,
  val syncFailureStage: String? = null,
  val syncExitCode: Int? = null,
  val syncDetailCode: String? = null
)

@Serializable
data class ClientHealthDataDto(
  val liveTokens: Long = 0,
  val lastActivityDay: String? = null
)

@Serializable
data class ClientHealthDiagnosticDto(
  val code: String = ""
)

@Serializable
data class WslStatusDto(
  val state: String? = null,
  val detected: List<String> = emptyList(),
  val withData: List<String> = emptyList()
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
data class UsageRangeDto(
  val from: String = "",
  val to: String = "",
  val startDate: String? = null,
  val endDate: String? = null,
  val startHour: Int? = null,
  val endHour: Int? = null,
  val source: String = "",
  val totalTokens: Long = 0,
  val costUsd: Double = 0.0,
  val clients: Map<String, Long> = emptyMap(),
  val clientCosts: Map<String, Double> = emptyMap(),
  val models: Map<String, Long> = emptyMap(),
  val modelCosts: Map<String, Double> = emptyMap(),
  val clientModels: Map<String, Map<String, Long>> = emptyMap(),
  val clientModelCosts: Map<String, Map<String, Double>> = emptyMap(),
  val projects: Map<String, ProjectDto> = emptyMap(),
  val sessions: Map<String, SessionDto> = emptyMap()
)

@Serializable
data class SseStatsDto(
  val type: String? = null,
  val reason: String? = null,
  val stats: StatsDto? = null,
  val at: String? = null
)

@Serializable
data class SubscriptionBindingDto(
  val profileName: String = "",
  val accountKey: String = "",
  val accountEmail: String = ""
)

@Serializable
data class SubscriptionTopUpDto(
  val id: String = "",
  val date: String = "",
  val amountMinor: Long = 0
)

@Serializable
data class SubscriptionDto(
  val id: String = "",
  val provider: String = "",
  val kind: String = "subscription",
  val binding: SubscriptionBindingDto = SubscriptionBindingDto(),
  val planName: String = "",
  val amountMinor: Long = 0,
  val currency: String = "USD",
  val interval: String = "month",
  val intervalCount: Int = 1,
  val startDate: String? = null,
  val topUps: List<SubscriptionTopUpDto> = emptyList(),
  val autoRenew: Boolean = true,
  val nextRenewalOverride: String? = null,
  val endDate: String? = null,
  val note: String = "",
  val updatedAt: String = ""
)

@Serializable
data class SubscriptionsDto(
  val ok: Boolean? = null,
  val version: Int = 1,
  val updatedAt: String = "",
  val subscriptions: List<SubscriptionDto> = emptyList()
)

@Serializable
data class SubscriptionsRequestDto(
  val subscriptions: List<SubscriptionDto> = emptyList(),
  val baseUpdatedAt: String = ""
)
