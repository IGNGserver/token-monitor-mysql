package com.igng.tokenmonitor.android.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember

/** Animate a 0..1 fraction toward [target], growing from the previous value (or 0). */
@Composable
fun animateGrowFraction(
  target: Float,
  durationMillis: Int = 900
): Float {
  val safe = target.coerceIn(0f, 1f)
  val animatable = remember { Animatable(0f) }
  LaunchedEffect(safe) {
    animatable.animateTo(
      targetValue = safe,
      animationSpec = tween(durationMillis = durationMillis, easing = FastOutSlowInEasing)
    )
  }
  return animatable.value
}

/**
 * Full grow 0→1 when [resetKey] changes (e.g. period switch for donut charts).
 * Use as a sweep multiplier.
 */
@Composable
fun animateGrowProgress(
  resetKey: Any?,
  durationMillis: Int = 1000
): Float {
  val animatable = remember { Animatable(0f) }
  LaunchedEffect(resetKey) {
    animatable.snapTo(0f)
    animatable.animateTo(
      targetValue = 1f,
      animationSpec = tween(durationMillis = durationMillis, easing = FastOutSlowInEasing)
    )
  }
  return animatable.value
}
