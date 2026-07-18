package com.igng.tokenmonitor.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.igng.tokenmonitor.android.ui.TokenMonitorApp
import com.igng.tokenmonitor.android.ui.theme.TokenMonitorTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContent { TokenMonitorTheme { TokenMonitorApp() } }
  }
}
