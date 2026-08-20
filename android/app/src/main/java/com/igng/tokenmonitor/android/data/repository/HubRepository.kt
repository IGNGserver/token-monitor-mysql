package com.igng.tokenmonitor.android.data.repository

import com.igng.tokenmonitor.android.data.local.ConnectionConfig
import com.igng.tokenmonitor.android.data.local.ConnectionStorage
import com.igng.tokenmonitor.android.data.model.BatchPricingResponseDto
import com.igng.tokenmonitor.android.data.model.DevicesResponseDto
import com.igng.tokenmonitor.android.data.model.HealthDto
import com.igng.tokenmonitor.android.data.model.HistoryDto
import com.igng.tokenmonitor.android.data.model.PricingListDto
import com.igng.tokenmonitor.android.data.model.PricingRequestDto
import com.igng.tokenmonitor.android.data.model.PricingResponseDto
import com.igng.tokenmonitor.android.data.model.SseStatsDto
import com.igng.tokenmonitor.android.data.model.StatsDto
import com.igng.tokenmonitor.android.data.model.SubscriptionsDto
import com.igng.tokenmonitor.android.data.model.SubscriptionsRequestDto
import com.igng.tokenmonitor.android.data.model.UsageRangeDto
import com.igng.tokenmonitor.android.data.remote.HubApiFactory
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.Response
import okhttp3.sse.EventSource
import okhttp3.sse.EventSourceListener
import retrofit2.HttpException

sealed interface HubResult<out T> {
  data class Success<T>(val value: T) : HubResult<T>
  data class Failure(val error: HubError) : HubResult<Nothing>
}

data class HubError(val message: String, val kind: Kind) {
  enum class Kind { NotConfigured, Unauthorized, Conflict, Network, MalformedResponse, Api }
}

@Singleton
class HubRepository @Inject constructor(
  private val store: ConnectionStorage,
  private val apiFactory: HubApiFactory,
  private val json: Json
) {
  fun connection(): ConnectionConfig = store.read()
  fun saveConnection(config: ConnectionConfig) = store.save(config)
  fun clearConnection() = store.clear()

  suspend fun testConnection(config: ConnectionConfig): HubResult<HealthDto> = safeCall { apiFactory.create(config).health() }
  suspend fun stats(): HubResult<StatsDto> = withConnection { apiFactory.create(it).stats() }
  suspend fun history(): HubResult<HistoryDto> = withConnection { apiFactory.create(it).history() }
  suspend fun devices(): HubResult<DevicesResponseDto> = withConnection { apiFactory.create(it).devices() }
  suspend fun subscriptions(): HubResult<SubscriptionsDto> = withConnection { apiFactory.create(it).subscriptions() }
  suspend fun putSubscriptions(request: SubscriptionsRequestDto): HubResult<SubscriptionsDto> =
    withConnection { apiFactory.create(it).putSubscriptions(request) }
  suspend fun usageRange(
    startDate: String,
    endDate: String,
    startHour: Int = 0,
    endHour: Int = 23
  ): HubResult<UsageRangeDto> =
    withConnection { apiFactory.create(it).usageRange(startDate, endDate, startHour, endHour) }
  suspend fun pricing(): HubResult<PricingListDto> = withConnection { apiFactory.create(it).pricing() }
  suspend fun putPricing(model: String, request: PricingRequestDto): HubResult<PricingResponseDto> = withConnection { apiFactory.create(it).putPricing(model, request) }
  suspend fun fetchUpstream(model: String): HubResult<PricingResponseDto> = withConnection { apiFactory.create(it).fetchUpstream(model) }
  suspend fun fetchAllUpstream(): HubResult<BatchPricingResponseDto> = withConnection { apiFactory.create(it).fetchAllUpstream() }

  fun statsEvents(): Flow<SseStatsDto> = callbackFlow {
    val config = connection()
    if (!config.isComplete) {
      close(IllegalStateException("Hub connection is not configured"))
      return@callbackFlow
    }
    val source = apiFactory.eventSource(config, apiFactory.statsRequest(config), object : EventSourceListener() {
      override fun onEvent(eventSource: EventSource, id: String?, type: String?, data: String) {
        runCatching { json.decodeFromString<SseStatsDto>(data) }.onSuccess { trySend(it) }.onFailure { close(it) }
      }

      override fun onFailure(eventSource: EventSource, t: Throwable?, response: Response?) {
        close(t ?: IOException("SSE closed with HTTP ${response?.code ?: "unknown"}"))
      }
    })
    awaitClose { source.cancel() }
  }

  private suspend fun <T> withConnection(call: suspend (ConnectionConfig) -> T): HubResult<T> {
    val config = connection()
    return if (!config.isComplete) HubResult.Failure(HubError("请先在设置中保存 Hub 地址和共享密钥。", HubError.Kind.NotConfigured))
    else safeCall { call(config) }
  }

  private suspend fun <T> safeCall(call: suspend () -> T): HubResult<T> = try {
    HubResult.Success(call())
  } catch (error: HttpException) {
    val detail = httpErrorDetail(error)
    val message = when (error.code()) {
      401 -> "未授权：请检查共享密钥。"
      409 -> "数据已被其他客户端更新，请先刷新后再保存。"
      404 -> detail?.let { "Hub 不支持此接口：$it" } ?: "Hub 不支持此接口或资源不存在。"
      422 -> detail?.let { "请求未完成：$it" } ?: "Hub 拒绝了这次请求。"
      else -> "Hub 返回 HTTP ${error.code()}。"
    }
    val kind = when (error.code()) {
      401 -> HubError.Kind.Unauthorized
      409 -> HubError.Kind.Conflict
      else -> HubError.Kind.Api
    }
    HubResult.Failure(HubError(message, kind))
  } catch (_: SerializationException) {
    HubResult.Failure(HubError("Hub 返回的数据格式无法解析，请确认客户端与 Hub 版本兼容。", HubError.Kind.MalformedResponse))
  } catch (error: IOException) {
    HubResult.Failure(HubError("无法连接 Hub：${error.message ?: "网络不可用"}", HubError.Kind.Network))
  } catch (error: IllegalArgumentException) {
    HubResult.Failure(HubError(error.message ?: "Hub 地址无效。", HubError.Kind.Api))
  }

  private fun httpErrorDetail(error: HttpException): String? {
    val body = error.response()?.errorBody()?.string().orEmpty()
    if (body.isBlank()) return null
    return runCatching {
      val jsonObject = json.parseToJsonElement(body).jsonObject
      val code = jsonObject["error"]?.jsonPrimitive?.contentOrNull
      val message = jsonObject["message"]?.jsonPrimitive?.contentOrNull
      listOfNotNull(code, message)
        .joinToString(": ")
        .takeIf { it.isNotBlank() }
    }.getOrNull() ?: body.trim().take(240).takeIf { it.isNotBlank() }
  }
}
