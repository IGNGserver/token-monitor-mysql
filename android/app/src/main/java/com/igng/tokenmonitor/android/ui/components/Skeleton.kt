package com.igng.tokenmonitor.android.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

@Composable
fun SkeletonBox(
  modifier: Modifier = Modifier,
  height: Dp = 16.dp,
  shape: RoundedCornerShape = RoundedCornerShape(8.dp)
) {
  val base = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.55f)
  val highlight = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.08f)
  val transition = rememberInfiniteTransition(label = "skeleton")
  val shift by transition.animateFloat(
    initialValue = 0f,
    targetValue = 1f,
    animationSpec = infiniteRepeatable(
      animation = tween(1100, easing = LinearEasing),
      repeatMode = RepeatMode.Restart
    ),
    label = "shimmer"
  )
  val brush = Brush.linearGradient(
    colors = listOf(base, highlight, base),
    start = Offset(shift * 400f - 200f, 0f),
    end = Offset(shift * 400f + 200f, 200f)
  )
  Box(
    modifier
      .height(height)
      .clip(shape)
      .background(brush)
  )
}

@Composable
fun OverviewSkeleton() {
  Column(
    Modifier
      .fillMaxWidth()
      .padding(16.dp),
    verticalArrangement = Arrangement.spacedBy(14.dp)
  ) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
      Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SkeletonBox(Modifier.size(width = 120.dp, height = 28.dp))
        SkeletonBox(Modifier.size(width = 160.dp, height = 14.dp))
      }
      SkeletonBox(Modifier.size(width = 72.dp, height = 28.dp), shape = RoundedCornerShape(50))
    }
    AppCard {
      SkeletonBox(Modifier.fillMaxWidth(), height = 96.dp, shape = RoundedCornerShape(16.dp))
      Spacer(Modifier.height(12.dp))
      Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        repeat(3) {
          SkeletonBox(Modifier.weight(1f), height = 56.dp)
        }
      }
    }
    AppCard {
      SkeletonBox(Modifier.size(width = 100.dp, height = 18.dp))
      Spacer(Modifier.height(12.dp))
      SkeletonBox(Modifier.fillMaxWidth(), height = 180.dp, shape = RoundedCornerShape(12.dp))
    }
    AppCard {
      SkeletonBox(Modifier.size(width = 80.dp, height = 18.dp))
      Spacer(Modifier.height(12.dp))
      repeat(3) {
        SkeletonBox(Modifier.fillMaxWidth(), height = 36.dp)
        Spacer(Modifier.height(8.dp))
      }
    }
  }
}

@Composable
fun DevicesSkeleton() {
  Column(
    Modifier
      .fillMaxWidth()
      .padding(16.dp),
    verticalArrangement = Arrangement.spacedBy(10.dp)
  ) {
    AppCard {
      SkeletonBox(Modifier.size(width = 120.dp, height = 18.dp))
      Spacer(Modifier.height(12.dp))
      SkeletonBox(Modifier.fillMaxWidth(), height = 160.dp)
    }
    repeat(4) {
      AppCard {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
          Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            SkeletonBox(Modifier.size(width = 140.dp, height = 18.dp))
            SkeletonBox(Modifier.size(width = 100.dp, height = 12.dp))
          }
          SkeletonBox(Modifier.size(width = 56.dp, height = 28.dp))
        }
      }
    }
  }
}
