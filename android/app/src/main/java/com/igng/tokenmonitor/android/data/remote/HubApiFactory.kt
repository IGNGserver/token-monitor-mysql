package com.igng.tokenmonitor.android.data.remote

import com.igng.tokenmonitor.android.data.local.ConnectionConfig
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.sse.EventSource
import okhttp3.sse.EventSourceListener
import okhttp3.sse.EventSources
import retrofit2.Retrofit
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class HubApiFactory private constructor(
  private val json: Json,
  private val requestTimeoutMs: Long
) {
  @Inject constructor(json: Json) : this(json, 20_000L)

  fun create(config: ConnectionConfig): HubApi = Retrofit.Builder()
    .baseUrl(normalizeUrl(config.hubUrl))
    .client(client(config, eventStream = false))
    .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
    .build()
    .create(HubApi::class.java)

  fun eventSource(config: ConnectionConfig, request: Request, listener: EventSourceListener): EventSource =
    EventSources.createFactory(client(config, eventStream = true)).newEventSource(request, listener)

  fun statsRequest(config: ConnectionConfig): Request = Request.Builder()
    .url("${normalizeUrl(config.hubUrl)}api/stats/stream")
    .header("Accept", "text/event-stream")
    .build()

  private fun client(config: ConnectionConfig, eventStream: Boolean): OkHttpClient = OkHttpClient.Builder()
    .connectTimeout(requestTimeoutMs, TimeUnit.MILLISECONDS)
    .readTimeout(if (eventStream) 0 else requestTimeoutMs, TimeUnit.MILLISECONDS)
    .addInterceptor { chain ->
      val request = chain.request().newBuilder().apply {
        if (config.secret.isNotBlank()) header("Authorization", "Bearer ${config.secret}")
      }.build()
      chain.proceed(request)
    }
    .build()

  private fun normalizeUrl(raw: String): String {
    val value = raw.trim()
    require(value.startsWith("http://") || value.startsWith("https://")) { "Hub URL must start with http:// or https://" }
    return if (value.endsWith('/')) value else "$value/"
  }

  companion object {
    fun forTesting(json: Json, requestTimeoutMs: Long = 100L): HubApiFactory = HubApiFactory(json, requestTimeoutMs)
  }
}
