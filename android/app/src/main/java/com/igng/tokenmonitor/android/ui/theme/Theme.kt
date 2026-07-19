package com.igng.tokenmonitor.android.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext

@Composable
fun TokenMonitorTheme(content: @Composable () -> Unit) {
  val dark = isSystemInDarkTheme()
  val colors = when {
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && dark -> dynamicDarkColorScheme(LocalContext.current)
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> dynamicLightColorScheme(LocalContext.current)
    dark -> darkColorScheme()
    else -> lightColorScheme()
  }
  MaterialTheme(colorScheme = colors, content = content)
}
