package com.igng.tokenmonitor.android.data.repository

import com.igng.tokenmonitor.android.data.local.ConnectionConfig
import com.igng.tokenmonitor.android.data.local.ConnectionStorage
import com.igng.tokenmonitor.android.data.remote.HubApiFactory
import com.igng.tokenmonitor.android.data.model.SubscriptionDto
import com.igng.tokenmonitor.android.data.model.SubscriptionsRequestDto
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.Json
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.SocketPolicy
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class HubRepositoryTest {
  private lateinit var server: MockWebServer
  private lateinit var repository: HubRepository
  private lateinit var store: FakeConnectionStorage
  private val json = Json { ignoreUnknownKeys = true; explicitNulls = false }

  @Before fun setUp() {
    server = MockWebServer()
    server.start()
    store = FakeConnectionStorage(ConnectionConfig(server.url("/").toString(), "shared-secret"))
    repository = HubRepository(store, HubApiFactory.forTesting(json, 150), json)
  }

  @After fun tearDown() { server.shutdown() }

  @Test fun pricingReturnsDataFor200() = runBlocking {
    server.enqueue(MockResponse().setResponseCode(200).setBody("""{"pricing":[{"model":"gpt-5","inputPricePerMillion":1.25,"outputPricePerMillion":10,"cacheReadPricePerMillion":0.125,"cacheWritePricePerMillion":0,"source":"manual"}]}"""))

    val result = repository.pricing()

    assertTrue(result is HubResult.Success)
    assertEquals("gpt-5", (result as HubResult.Success).value.pricing.single().model)
    assertEquals("Bearer shared-secret", server.takeRequest().getHeader("Authorization"))
  }

  @Test fun pricingMaps401ToReadableUnauthorizedError() = runBlocking {
    server.enqueue(MockResponse().setResponseCode(401).setBody("""{"error":"unauthorized"}"""))

    val result = repository.pricing()

    assertTrue(result is HubResult.Failure)
    assertEquals(HubError.Kind.Unauthorized, (result as HubResult.Failure).error.kind)
  }

  @Test fun pricingMapsTimeoutToNetworkError() = runBlocking {
    server.enqueue(MockResponse().setSocketPolicy(SocketPolicy.NO_RESPONSE))

    val result = repository.pricing()

    assertTrue(result is HubResult.Failure)
    assertEquals(HubError.Kind.Network, (result as HubResult.Failure).error.kind)
  }

  @Test fun pricingMapsMalformedJsonToReadableError() = runBlocking {
    server.enqueue(MockResponse().setResponseCode(200).setBody("{not-json"))

    val result = repository.pricing()

    assertTrue(result is HubResult.Failure)
    assertEquals(HubError.Kind.MalformedResponse, (result as HubResult.Failure).error.kind)
  }

  @Test fun upstream422KeepsHubFailureReason() = runBlocking {
    server.enqueue(MockResponse().setResponseCode(422).setBody("""{"error":"pricing_not_found","message":"No upstream pricing was found for missing-model"}"""))

    val result = repository.fetchUpstream("missing-model")

    assertTrue(result is HubResult.Failure)
    val error = (result as HubResult.Failure).error
    assertEquals(HubError.Kind.Api, error.kind)
    assertTrue(error.message.contains("pricing_not_found"))
  }

  @Test fun subscriptionsReturnsDocumentFor200() = runBlocking {
    server.enqueue(MockResponse().setResponseCode(200).setBody("""
      {"ok":true,"version":1,"updatedAt":"2026-08-20T08:00:00.000Z","subscriptions":[]}
    """.trimIndent()))

    val result = repository.subscriptions()

    assertTrue(result is HubResult.Success)
    assertEquals("2026-08-20T08:00:00.000Z", (result as HubResult.Success).value.updatedAt)
    val request = server.takeRequest()
    assertEquals("GET", request.method)
    assertEquals("/api/subscriptions", request.path)
  }

  @Test fun subscriptionsMapsStaleWriteToConflict() = runBlocking {
    server.enqueue(MockResponse().setResponseCode(409).setBody("""
      {"error":"stale_write","updatedAt":"2026-08-20T08:00:00.000Z","subscriptions":[]}
    """.trimIndent()))

    val result = repository.putSubscriptions(
      SubscriptionsRequestDto(
        subscriptions = listOf(SubscriptionDto(provider = "codex")),
        baseUpdatedAt = "old"
      )
    )

    assertTrue(result is HubResult.Failure)
    assertEquals(HubError.Kind.Conflict, (result as HubResult.Failure).error.kind)
    assertTrue((result as HubResult.Failure).error.message.contains("刷新"))
    val request = server.takeRequest()
    assertEquals("PUT", request.method)
    assertEquals("/api/subscriptions", request.path)
  }

  @Test fun statsEventsDecodeTheHubSnapshotAndAttachAuth() = runBlocking {
    server.enqueue(
      MockResponse()
        .setResponseCode(200)
        .setHeader("Content-Type", "text/event-stream")
        .setChunkedBody(
          "event: snapshot\r\ndata: {\"type\":\"snapshot\",\"stats\":{\"updatedAt\":\"2026-08-20T08:00:00.000Z\",\"devices\":[{\"deviceId\":\"dev-1\"}]}}\r\n\r\n",
          1
        )
    )

    val event = withTimeout(3_000) {
      repository.statsEvents().first { it.stats != null }
    }

    assertEquals("2026-08-20T08:00:00.000Z", event.stats?.updatedAt)
    assertEquals("dev-1", event.stats?.devices?.single()?.deviceId)
    val request = server.takeRequest(1, TimeUnit.SECONDS)
    assertEquals("/api/stats/stream", request?.path)
    assertEquals("Bearer shared-secret", request?.getHeader("Authorization"))
  }

  private class FakeConnectionStorage(private var config: ConnectionConfig) : ConnectionStorage {
    override fun read(): ConnectionConfig = config
    override fun save(config: ConnectionConfig) { this.config = config }
    override fun clear() { config = ConnectionConfig("", "") }
  }
}
