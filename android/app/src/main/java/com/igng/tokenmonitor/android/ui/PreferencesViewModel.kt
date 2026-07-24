package com.igng.tokenmonitor.android.ui

import androidx.lifecycle.ViewModel
import com.igng.tokenmonitor.android.data.local.HapticsMode
import com.igng.tokenmonitor.android.data.local.ThemeSeedId
import com.igng.tokenmonitor.android.data.local.UserPreferencesStore
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class PreferencesViewModel @Inject constructor(
  private val store: UserPreferencesStore
) : ViewModel() {
  val preferences = store.preferences

  fun setThemeSeed(seed: ThemeSeedId) = store.setThemeSeed(seed)
  fun setHapticsMode(mode: HapticsMode) = store.setHapticsMode(mode)
}
