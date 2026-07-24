package com.igng.tokenmonitor.android.ui.haptics

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.hapticfeedback.HapticFeedback
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import com.igng.tokenmonitor.android.data.local.HapticsMode

enum class HapticEvent {
  Tap,
  Selection,
  ToggleOn,
  ToggleOff,
  Success,
  Error,
  Refresh,
  Confirm
}

val LocalHapticsMode = staticCompositionLocalOf { HapticsMode.Standard }

class AppHaptics(
  private val context: Context,
  private val composeHaptics: HapticFeedback,
  private val modeProvider: () -> HapticsMode
) {
  fun perform(event: HapticEvent, forceMode: HapticsMode? = null) {
    val mode = forceMode ?: modeProvider()
    if (mode == HapticsMode.Off) return

    if (mode == HapticsMode.Standard) {
      when (event) {
        HapticEvent.Tap, HapticEvent.Selection, HapticEvent.ToggleOn, HapticEvent.ToggleOff ->
          composeHaptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
        HapticEvent.Confirm, HapticEvent.Success, HapticEvent.Refresh, HapticEvent.Error ->
          composeHaptics.performHapticFeedback(HapticFeedbackType.LongPress)
      }
    }

    val vibrator = context.vibratorOrNull() ?: return
    if (!vibrator.hasVibrator()) return

    val effect = when (mode) {
      HapticsMode.Off -> return
      HapticsMode.Standard -> standardEffect(event)
      HapticsMode.Enhanced -> enhancedEffect(event, vibrator)
    }
    runCatching { vibrator.vibrate(effect) }
  }

  private fun standardEffect(event: HapticEvent): VibrationEffect {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      val predefined = when (event) {
        HapticEvent.Tap, HapticEvent.Selection -> VibrationEffect.EFFECT_CLICK
        HapticEvent.ToggleOn, HapticEvent.ToggleOff, HapticEvent.Confirm -> VibrationEffect.EFFECT_TICK
        HapticEvent.Success, HapticEvent.Refresh -> VibrationEffect.EFFECT_HEAVY_CLICK
        HapticEvent.Error -> VibrationEffect.EFFECT_DOUBLE_CLICK
      }
      return VibrationEffect.createPredefined(predefined)
    }
    val ms = when (event) {
      HapticEvent.Tap, HapticEvent.Selection -> 18L
      HapticEvent.ToggleOn, HapticEvent.ToggleOff -> 22L
      HapticEvent.Confirm, HapticEvent.Success, HapticEvent.Refresh -> 30L
      HapticEvent.Error -> 40L
    }
    return VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE)
  }

  private fun enhancedEffect(event: HapticEvent, vibrator: Vibrator): VibrationEffect {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val timings: LongArray
      val amplitudes: IntArray
      when (event) {
        HapticEvent.Tap -> {
          timings = longArrayOf(0, 16)
          amplitudes = intArrayOf(0, 90)
        }
        HapticEvent.Selection -> {
          timings = longArrayOf(0, 12, 28, 16)
          amplitudes = intArrayOf(0, 70, 0, 110)
        }
        HapticEvent.ToggleOn -> {
          timings = longArrayOf(0, 14, 40, 28)
          amplitudes = intArrayOf(0, 80, 0, 160)
        }
        HapticEvent.ToggleOff -> {
          timings = longArrayOf(0, 22, 36, 12)
          amplitudes = intArrayOf(0, 140, 0, 60)
        }
        HapticEvent.Success -> {
          timings = longArrayOf(0, 18, 50, 22, 40, 36)
          amplitudes = intArrayOf(0, 100, 0, 140, 0, 200)
        }
        HapticEvent.Error -> {
          timings = longArrayOf(0, 30, 45, 30, 45, 40)
          amplitudes = intArrayOf(0, 200, 0, 200, 0, 255)
        }
        HapticEvent.Refresh -> {
          timings = longArrayOf(0, 20, 35, 20, 35, 24)
          amplitudes = intArrayOf(0, 90, 0, 120, 0, 160)
        }
        HapticEvent.Confirm -> {
          timings = longArrayOf(0, 24, 50, 40)
          amplitudes = intArrayOf(0, 130, 0, 220)
        }
      }
      return if (vibrator.hasAmplitudeControl()) {
        VibrationEffect.createWaveform(timings, amplitudes, -1)
      } else {
        VibrationEffect.createWaveform(timings, -1)
      }
    }
    return standardEffect(event)
  }
}

@Composable
fun rememberAppHaptics(): AppHaptics {
  val context = LocalContext.current
  val compose = LocalHapticFeedback.current
  val mode = LocalHapticsMode.current
  return AppHaptics(context, compose) { mode }
}

private fun Context.vibratorOrNull(): Vibrator? {
  return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
    getSystemService(VibratorManager::class.java)?.defaultVibrator
  } else {
    @Suppress("DEPRECATION")
    getSystemService(Vibrator::class.java)
  }
}
