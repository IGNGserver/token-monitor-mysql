package com.igng.tokenmonitor.android.ui.components

import android.widget.NumberPicker
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DatePickerDefaults
import androidx.compose.material3.DateRangePicker
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDateRangePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.igng.tokenmonitor.android.ui.haptics.HapticEvent
import com.igng.tokenmonitor.android.ui.haptics.rememberAppHaptics
import java.time.Instant
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZoneOffset

@OptIn(ExperimentalMaterial3Api::class)
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

  val pickerState = rememberDateRangePickerState(
    initialSelectedStartDateMillis = startLdt.toLocalDate().atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli(),
    initialSelectedEndDateMillis = endInclusiveLdt.toLocalDate().atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
  )
  var startHour by remember { mutableIntStateOf(startLdt.hour.coerceIn(0, 23)) }
  var endHour by remember { mutableIntStateOf(endInclusiveLdt.hour.coerceIn(0, 23)) }
  var errorText by remember { mutableStateOf("") }

  AlertDialog(
    onDismissRequest = onDismiss,
    confirmButton = {
      TextButton(
        onClick = {
          val startMillis = pickerState.selectedStartDateMillis
          val endMillis = pickerState.selectedEndDateMillis ?: pickerState.selectedStartDateMillis
          if (startMillis == null || endMillis == null) {
            errorText = "请选择开始和结束日期"
            haptics.perform(HapticEvent.Error)
            return@TextButton
          }
          val startDate = Instant.ofEpochMilli(startMillis).atZone(ZoneOffset.UTC).toLocalDate()
          val endDate = Instant.ofEpochMilli(endMillis).atZone(ZoneOffset.UTC).toLocalDate()
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
          .heightIn(max = 520.dp)
          .verticalScroll(rememberScrollState())
      ) {
        Text(
          "选择起止日期，并用滚轮设置小时（结束小时含在内）",
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.height(8.dp))
        DateRangePicker(
          state = pickerState,
          modifier = Modifier
            .fillMaxWidth()
            .height(360.dp),
          title = null,
          headline = null,
          showModeToggle = false,
          colors = DatePickerDefaults.colors()
        )
        Spacer(Modifier.height(8.dp))
        Row(
          Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceEvenly,
          verticalAlignment = Alignment.CenterVertically
        ) {
          HourWheel(
            label = "开始小时",
            value = startHour,
            onValueChange = {
              startHour = it
              haptics.perform(HapticEvent.Selection)
            }
          )
          HourWheel(
            label = "结束小时",
            value = endHour,
            onValueChange = {
              endHour = it
              haptics.perform(HapticEvent.Selection)
            }
          )
        }
        if (errorText.isNotBlank()) {
          Spacer(Modifier.height(8.dp))
          Text(errorText, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }
      }
    }
  )
}

@Composable
private fun HourWheel(
  label: String,
  value: Int,
  onValueChange: (Int) -> Unit
) {
  Column(horizontalAlignment = Alignment.CenterHorizontally) {
    Text(label, style = MaterialTheme.typography.labelMedium)
    AndroidView(
      modifier = Modifier.padding(top = 4.dp),
      factory = { context ->
        NumberPicker(context).apply {
          minValue = 0
          maxValue = 23
          wrapSelectorWheel = true
          setFormatter { hour -> String.format("%02d:00", hour) }
          this.value = value
          setOnValueChangedListener { _, _, newVal -> onValueChange(newVal) }
        }
      },
      update = { picker ->
        if (picker.value != value) picker.value = value
      }
    )
  }
}
