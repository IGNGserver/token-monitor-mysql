package com.igng.tokenmonitor.android.data.local

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class ThemeSeedId(val storageKey: String, val labelZh: String) {
  System("system", "系统"),
  Blue("blue", "蓝色"),
  Green("green", "绿色"),
  Purple("purple", "紫色"),
  Teal("teal", "青色"),
  Orange("orange", "橙色"),
  Rose("rose", "玫红");

  companion object {
    fun fromStorage(value: String?): ThemeSeedId =
      entries.firstOrNull { it.storageKey == value } ?: System
  }
}

enum class HapticsMode(val storageKey: String, val labelZh: String) {
  Off("off", "关闭"),
  Standard("standard", "标准"),
  Enhanced("enhanced", "增强");

  companion object {
    fun fromStorage(value: String?): HapticsMode =
      entries.firstOrNull { it.storageKey == value } ?: Standard
  }
}

data class UserPreferences(
  val themeSeed: ThemeSeedId = ThemeSeedId.System,
  val hapticsMode: HapticsMode = HapticsMode.Standard
)

@Singleton
class UserPreferencesStore @Inject constructor(
  @ApplicationContext context: Context
) {
  private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
  private val _preferences = MutableStateFlow(read())
  val preferences: StateFlow<UserPreferences> = _preferences.asStateFlow()

  fun read(): UserPreferences = UserPreferences(
    themeSeed = ThemeSeedId.fromStorage(prefs.getString(KEY_THEME_SEED, ThemeSeedId.System.storageKey)),
    hapticsMode = HapticsMode.fromStorage(prefs.getString(KEY_HAPTICS, HapticsMode.Standard.storageKey))
  )

  fun setThemeSeed(seed: ThemeSeedId) {
    prefs.edit().putString(KEY_THEME_SEED, seed.storageKey).apply()
    _preferences.value = _preferences.value.copy(themeSeed = seed)
  }

  fun setHapticsMode(mode: HapticsMode) {
    prefs.edit().putString(KEY_HAPTICS, mode.storageKey).apply()
    _preferences.value = _preferences.value.copy(hapticsMode = mode)
  }

  private companion object {
    const val PREFS_NAME = "token_monitor_prefs"
    const val KEY_THEME_SEED = "theme_seed"
    const val KEY_HAPTICS = "haptics_mode"
  }
}
