package com.igng.tokenmonitor.android.data.local

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

data class ConnectionConfig(val hubUrl: String, val secret: String) {
  val isComplete: Boolean get() = hubUrl.isNotBlank() && secret.isNotBlank()
}

interface ConnectionStorage {
  fun read(): ConnectionConfig
  fun save(config: ConnectionConfig)
  fun clear()
}

@Singleton
class ConnectionStore @Inject constructor(@ApplicationContext context: Context) : ConnectionStorage {
  private val masterKey = MasterKey.Builder(context)
    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
    .build()
  private val preferences = EncryptedSharedPreferences.create(
    context,
    "token_monitor_hub",
    masterKey,
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
  )

  override fun read(): ConnectionConfig = ConnectionConfig(
    hubUrl = preferences.getString(HUB_URL, "").orEmpty(),
    secret = preferences.getString(SECRET, "").orEmpty()
  )

  override fun save(config: ConnectionConfig) {
    preferences.edit().putString(HUB_URL, config.hubUrl.trim()).putString(SECRET, config.secret).apply()
  }

  override fun clear() = preferences.edit().clear().apply()

  private companion object {
    const val HUB_URL = "hub_url"
    const val SECRET = "hub_secret"
  }
}
