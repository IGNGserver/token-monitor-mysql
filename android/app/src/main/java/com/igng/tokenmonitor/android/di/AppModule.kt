package com.igng.tokenmonitor.android.di

import com.igng.tokenmonitor.android.data.local.ConnectionStorage
import com.igng.tokenmonitor.android.data.local.ConnectionStore
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton
import kotlinx.serialization.json.Json

@Module
@InstallIn(SingletonComponent::class)
object AppModule {
  @Provides
  @Singleton
  @OptIn(kotlinx.serialization.ExperimentalSerializationApi::class)
  fun json(): Json = Json { ignoreUnknownKeys = true; explicitNulls = false }
}

@Module
@InstallIn(SingletonComponent::class)
abstract class StorageModule {
  @Binds
  @Singleton
  abstract fun bindConnectionStorage(store: ConnectionStore): ConnectionStorage
}
