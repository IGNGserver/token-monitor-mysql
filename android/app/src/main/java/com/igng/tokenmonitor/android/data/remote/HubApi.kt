package com.igng.tokenmonitor.android.data.remote

import com.igng.tokenmonitor.android.data.model.BatchPricingResponseDto
import com.igng.tokenmonitor.android.data.model.DevicesResponseDto
import com.igng.tokenmonitor.android.data.model.HealthDto
import com.igng.tokenmonitor.android.data.model.PricingListDto
import com.igng.tokenmonitor.android.data.model.PricingRequestDto
import com.igng.tokenmonitor.android.data.model.PricingResponseDto
import com.igng.tokenmonitor.android.data.model.StatsDto
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path

interface HubApi {
  @GET("api/health") suspend fun health(): HealthDto
  @GET("api/stats") suspend fun stats(): StatsDto
  @GET("api/devices") suspend fun devices(): DevicesResponseDto
  @GET("api/pricing") suspend fun pricing(): PricingListDto
  @PUT("api/pricing/{model}") suspend fun putPricing(@Path("model") model: String, @Body request: PricingRequestDto): PricingResponseDto
  @POST("api/pricing/{model}/fetch-upstream") suspend fun fetchUpstream(@Path("model") model: String): PricingResponseDto
  @POST("api/pricing/fetch-upstream-all") suspend fun fetchAllUpstream(): BatchPricingResponseDto
}
