package com.igng.tokenmonitor.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.snapping.rememberSnapFlingBehavior
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.igng.tokenmonitor.android.ui.haptics.HapticEvent
import com.igng.tokenmonitor.android.ui.haptics.rememberAppHaptics
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.YearMonth
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch

@Composable
fun DateTimeRangePickerDialog(
  onDismiss: () -> Unit,
  onConfirm: (fromInclusive: Instant, toExclusive: Instant) -> Unit,
  initialFrom: Instant? = null,
  initialToExclusive: Instant? = null
) {
  val zone = ZoneId.systemDefault()
  val now = LocalDateTime.now(zone)
  val startLdt = initialFrom?.atZone(zone)?.toLocalDateTime()
    ?: now.toLocalDate().atStartOfDay()
  val endInclusiveLdt = initialToExclusive?.atZone(zone)?.toLocalDateTime()?.minusHours(1)
    ?: now.withMinute(0).withSecond(0).withNano(0)
  val haptics = rememberAppHaptics()

  var startDate by remember { mutableStateOf(startLdt.toLocalDate()) }
  var endDate by remember { mutableStateOf(endInclusiveLdt.toLocalDate()) }
  // null = next click sets start; non-null = next click completes range
  var pickingEnd by remember { mutableStateOf(true) }
  var visibleMonth by remember { mutableStateOf(YearMonth.from(endDate)) }
  var startHour by remember { mutableIntStateOf(startLdt.hour.coerceIn(0, 23)) }
  var endHour by remember { mutableIntStateOf(endInclusiveLdt.hour.coerceIn(0, 23)) }
  var errorText by remember { mutableStateOf("") }

  val rangeLabel = remember(startDate, endDate, startHour, endHour) {
    val fmt = DateTimeFormatter.ofPattern("MM-dd")
    "${fmt.format(startDate)} ${"%02d".format(startHour)}:00 → ${fmt.format(endDate)} ${"%02d".format(endHour)}:00"
  }

  AlertDialog(
    onDismissRequest = onDismiss,
    confirmButton = {
      TextButton(
        onClick = {
          val from = LocalDateTime.of(startDate, LocalTime.of(startHour, 0)).atZone(zone).toInstant()
          val endInclusive = LocalDateTime.of(endDate, LocalTime.of(endHour, 0)).atZone(zone).toInstant()
          val toExclusive = endInclusive.plusSeconds(3600)
          if (!from.isBefore(toExclusive)) {
            errorText = "结束时间必须晚于开始时间"
            haptics.perform(HapticEvent.Error)
            return@TextButton
          }
          haptics.perform(HapticEvent.Confirm)
          onConfirm(from, toExclusive)
        }
      ) { Text("确定") }
    },
    dismissButton = {
      TextButton(onClick = {
        haptics.perform(HapticEvent.Tap)
        onDismiss()
      }) { Text("取消") }
    },
    title = { Text("自定义时间范围") },
    text = {
      Column(
        Modifier
          .fillMaxWidth()
          .verticalScroll(rememberScrollState())
      ) {
        Text(
          "点选起止日期（可同一天），滚轮设置小时；结束小时含在内。",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.height(10.dp))
        Text(
          rangeLabel,
          style = MaterialTheme.typography.titleSmall,
          fontWeight = FontWeight.SemiBold,
          color = MaterialTheme.colorScheme.primary
        )
        Spacer(Modifier.height(12.dp))
        RangeCalendar(
          month = visibleMonth,
          startDate = startDate,
          endDate = endDate,
          onMonthChange = { visibleMonth = it },
          onDayClick = { day ->
            haptics.perform(HapticEvent.Selection)
            errorText = ""
            if (!pickingEnd) {
              startDate = day
              endDate = day
              pickingEnd = true
            } else {
              if (day.isBefore(startDate)) {
                endDate = startDate
                startDate = day
              } else {
                endDate = day
              }
              pickingEnd = false
            }
          }
        )
        Spacer(Modifier.height(16.dp))
        Text(
          "小时",
          style = MaterialTheme.typography.labelLarge,
          color = MaterialTheme.colorScheme.onSurface
        )
        Spacer(Modifier.height(8.dp))
        Surface(
          shape = RoundedCornerShape(16.dp),
          color = MaterialTheme.colorScheme.surfaceContainerHighest.copy(alpha = 0.55f),
          modifier = Modifier.fillMaxWidth()
        ) {
          Row(
            Modifier
              .fillMaxWidth()
              .padding(vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically
          ) {
            ComposeHourWheel(
              label = "开始",
              value = startHour,
              onValueChange = {
                startHour = it
                haptics.perform(HapticEvent.Selection)
              }
            )
            Box(
              Modifier
                .height(1.dp)
                .width(24.dp)
                .background(MaterialTheme.colorScheme.outlineVariant)
            )
            ComposeHourWheel(
              label = "结束",
              value = endHour,
              onValueChange = {
                endHour = it
                haptics.perform(HapticEvent.Selection)
              }
            )
          }
        }
        if (errorText.isNotBlank()) {
          Spacer(Modifier.height(10.dp))
          Text(
            errorText,
            color = MaterialTheme.colorScheme.error,
            style = MaterialTheme.typography.bodySmall
          )
        }
      }
    }
  )
}

@Composable
private fun RangeCalendar(
  month: YearMonth,
  startDate: LocalDate,
  endDate: LocalDate,
  onMonthChange: (YearMonth) -> Unit,
  onDayClick: (LocalDate) -> Unit
) {
  val locale = Locale.CHINA
  val weekdays = remember(locale) {
    // Monday-first to match common Chinese calendars
    listOf(
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY,
      DayOfWeek.SATURDAY,
      DayOfWeek.SUNDAY
    ).map { it.getDisplayName(TextStyle.NARROW, locale) }
  }
  val firstOfMonth = month.atDay(1)
  val lead = (firstOfMonth.dayOfWeek.value + 6) % 7 // Monday = 0
  val daysInMonth = month.lengthOfMonth()
  val cells = remember(month) {
    buildList {
      repeat(lead) { add(null) }
      for (day in 1..daysInMonth) add(month.atDay(day))
      while (size % 7 != 0) add(null)
    }
  }
  val monthTitle = remember(month) {
    DateTimeFormatter.ofPattern("yyyy年M月", locale).format(month.atDay(1))
  }
  val rangeStart = if (startDate.isAfter(endDate)) endDate else startDate
  val rangeEnd = if (startDate.isAfter(endDate)) startDate else endDate

  Column(Modifier.fillMaxWidth()) {
    Row(
      Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = Alignment.CenterVertically
    ) {
      IconButton(onClick = { onMonthChange(month.minusMonths(1)) }) {
        Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, contentDescription = "上一月")
      }
      Text(
        monthTitle,
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.SemiBold
      )
      IconButton(onClick = { onMonthChange(month.plusMonths(1)) }) {
        Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = "下一月")
      }
    }
    Spacer(Modifier.height(4.dp))
    Row(Modifier.fillMaxWidth()) {
      weekdays.forEach { label ->
        Text(
          label,
          modifier = Modifier.weight(1f),
          textAlign = TextAlign.Center,
          style = MaterialTheme.typography.labelMedium,
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
      }
    }
    Spacer(Modifier.height(4.dp))
    cells.chunked(7).forEach { week ->
      Row(Modifier.fillMaxWidth()) {
        week.forEach { date ->
          Box(
            modifier = Modifier
              .weight(1f)
              .aspectRatio(1f)
              .then(if (date != null) Modifier.clickable { onDayClick(date) } else Modifier),
            contentAlignment = Alignment.Center
          ) {
            if (date != null) {
              val inRange = !date.isBefore(rangeStart) && !date.isAfter(rangeEnd)
              val isStart = date == rangeStart
              val isEnd = date == rangeEnd
              val isEndpoint = isStart || isEnd
              val today = date == LocalDate.now()

              // Full-width range band shares the same center as the day circle/number.
              if (inRange && rangeStart != rangeEnd) {
                val stripColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.75f)
                Box(
                  Modifier
                    .fillMaxWidth()
                    .height(36.dp)
                    .align(Alignment.Center)
                    .background(
                      color = stripColor,
                      shape = when {
                        isStart -> RoundedCornerShape(topStartPercent = 50, bottomStartPercent = 50)
                        isEnd -> RoundedCornerShape(topEndPercent = 50, bottomEndPercent = 50)
                        else -> RoundedCornerShape(0.dp)
                      }
                    )
                )
              }

              Box(
                modifier = Modifier
                  .size(36.dp)
                  .clip(CircleShape)
                  .background(if (isEndpoint) MaterialTheme.colorScheme.primary else Color.Transparent),
                contentAlignment = Alignment.Center
              ) {
                Text(
                  text = date.dayOfMonth.toString(),
                  modifier = Modifier.fillMaxWidth(),
                  textAlign = TextAlign.Center,
                  style = MaterialTheme.typography.bodyMedium,
                  fontWeight = if (isEndpoint || today) FontWeight.SemiBold else FontWeight.Normal,
                  color = when {
                    isEndpoint -> MaterialTheme.colorScheme.onPrimary
                    today -> MaterialTheme.colorScheme.primary
                    else -> MaterialTheme.colorScheme.onSurface
                  }
                )
              }
            }
          }
        }
      }
    }
  }
}

@Composable
private fun ComposeHourWheel(
  label: String,
  value: Int,
  onValueChange: (Int) -> Unit
) {
  val itemHeight = 40.dp
  val visibleCount = 3
  val listState = rememberLazyListState(initialFirstVisibleItemIndex = value)
  val fling = rememberSnapFlingBehavior(lazyListState = listState)
  val scope = rememberCoroutineScope()
  var suppress by remember { mutableStateOf(false) }

  // Keep list aligned when value changes externally
  LaunchedEffect(value) {
    val target = value.coerceIn(0, 23)
    if (listState.firstVisibleItemIndex != target || listState.firstVisibleItemScrollOffset != 0) {
      suppress = true
      listState.scrollToItem(target)
      suppress = false
    }
  }

  // Emit selected hour when snap settles on a new index
  LaunchedEffect(listState) {
    snapshotFlow {
      val info = listState.layoutInfo
      val center = info.viewportStartOffset + (info.viewportEndOffset - info.viewportStartOffset) / 2
      info.visibleItemsInfo
        .minByOrNull { item ->
          val itemCenter = item.offset + item.size / 2
          kotlin.math.abs(itemCenter - center)
        }
        ?.index
    }
      .distinctUntilChanged()
      .collect { index ->
        if (index == null || suppress) return@collect
        // index 0 = top spacer, 1..24 = hours 0..23, 25 = bottom spacer
        val hour = (index - 1).coerceIn(0, 23)
        if (hour != value) onValueChange(hour)
      }
  }

  Column(horizontalAlignment = Alignment.CenterHorizontally) {
    Text(
      label,
      style = MaterialTheme.typography.labelMedium,
      color = MaterialTheme.colorScheme.onSurfaceVariant
    )
    Spacer(Modifier.height(6.dp))
    Box(
      modifier = Modifier
        .height(itemHeight * visibleCount)
        .width(96.dp),
      contentAlignment = Alignment.Center
    ) {
      // Center selection band
      Box(
        Modifier
          .fillMaxWidth()
          .height(itemHeight)
          .clip(RoundedCornerShape(12.dp))
          .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.12f))
          .align(Alignment.Center)
      )
      LazyColumn(
        state = listState,
        flingBehavior = fling,
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.fillMaxSize()
      ) {
        // top spacer so first item can center
        item { Spacer(Modifier.height(itemHeight)) }
        items(24) { hour ->
          val selected = hour == value
          Box(
            modifier = Modifier
              .fillMaxWidth()
              .height(itemHeight)
              .clickable {
                scope.launch {
                  listState.animateScrollToItem(hour)
                }
                onValueChange(hour)
              },
            contentAlignment = Alignment.Center
          ) {
            Text(
              text = "%02d:00".format(hour),
              textAlign = TextAlign.Center,
              fontSize = if (selected) 18.sp else 15.sp,
              fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
              color = if (selected) {
                MaterialTheme.colorScheme.primary
              } else {
                MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.55f)
              }
            )
          }
        }
        // bottom spacer so last item can center
        item { Spacer(Modifier.height(itemHeight)) }
      }
    }
  }
}
