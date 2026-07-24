package com.igng.tokenmonitor.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.igng.tokenmonitor.android.data.local.UserPreferencesStore
import com.igng.tokenmonitor.android.ui.TokenMonitorApp
import com.igng.tokenmonitor.android.ui.haptics.LocalHapticsMode
import com.igng.tokenmonitor.android.ui.theme.TokenMonitorTheme
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
  @Inject lateinit var preferencesStore: UserPreferencesStore

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContent {
      val prefs by preferencesStore.preferences.collectAsStateWithLifecycle()
      TokenMonitorTheme(themeSeed = prefs.themeSeed) {
        CompositionLocalProvider(LocalHapticsMode provides prefs.hapticsMode) {
          TokenMonitorApp()
        }
      }
    }
  }
}
