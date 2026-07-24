@file:OptIn(
  androidx.compose.material.ExperimentalMaterialApi::class,
  androidx.compose.material3.ExperimentalMaterial3Api::class
)

package com.igng.tokenmonitor.android.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Analytics
import androidx.compose.material.icons.filled.Devices
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.igng.tokenmonitor.android.ui.analytics.AnalyticsScreen
import com.igng.tokenmonitor.android.ui.devices.DeviceDetailScreen
import com.igng.tokenmonitor.android.ui.devices.DevicesScreen
import com.igng.tokenmonitor.android.ui.more.MoreHubScreen
import com.igng.tokenmonitor.android.ui.more.PricingScreen
import com.igng.tokenmonitor.android.ui.more.SessionDetailScreen
import com.igng.tokenmonitor.android.ui.more.SessionsScreen
import com.igng.tokenmonitor.android.ui.more.SettingsScreen
import com.igng.tokenmonitor.android.ui.overview.OverviewScreen
import android.net.Uri

private data class Destination(
  val route: String,
  val label: String,
  val icon: ImageVector
)

private val primaryDestinations = listOf(
  Destination("overview", "总览", Icons.Default.Home),
  Destination("analytics", "分析", Icons.Default.Analytics),
  Destination("devices", "设备", Icons.Default.Devices),
  Destination("more", "更多", Icons.Default.MoreHoriz)
)

private val primaryRoutes = primaryDestinations.map { it.route }.toSet()

@Composable
fun TokenMonitorApp(
  hubViewModel: HubViewModel = hiltViewModel(),
  connectionViewModel: ConnectionViewModel = hiltViewModel()
) {
  val navController = rememberNavController()
  val hubState by hubViewModel.state.collectAsStateWithLifecycle()
  val connectionState by connectionViewModel.state.collectAsStateWithLifecycle()
  val snackbarHost = remember { SnackbarHostState() }
  val navBackStack by navController.currentBackStackEntryAsState()
  val currentRoute = navBackStack?.destination?.route
  val showBottomBar = currentRoute in primaryRoutes

  LaunchedEffect(hubState.error) {
    hubState.error?.let {
      snackbarHost.showSnackbar(it)
      hubViewModel.dismissError()
    }
  }
  LaunchedEffect(connectionState.message) {
    connectionState.message?.let { snackbarHost.showSnackbar(it) }
  }

  LaunchedEffect(connectionState.hubUrl, connectionState.secret, currentRoute) {
    val incomplete = connectionState.hubUrl.isBlank() || connectionState.secret.isBlank()
    if (incomplete && currentRoute != null && currentRoute != "settings") {
      navController.navigate("settings") {
        launchSingleTop = true
      }
    }
  }

  Surface(color = MaterialTheme.colorScheme.background) {
    Scaffold(
      snackbarHost = { SnackbarHost(snackbarHost) },
      bottomBar = {
        if (showBottomBar) {
          AppNavigationBar(navController, currentRoute)
        }
      }
    ) { padding ->
      NavHost(
        navController = navController,
        startDestination = "overview",
        modifier = Modifier.padding(padding)
      ) {
        composable("overview") {
          OverviewScreen(
            state = hubState,
            onRefresh = hubViewModel::refreshAll,
            onOpenAnalytics = {
              navController.navigate("analytics") {
                popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                launchSingleTop = true
                restoreState = true
              }
            },
            onOpenDevices = {
              navController.navigate("devices") {
                popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                launchSingleTop = true
                restoreState = true
              }
            },
            onOpenSettings = { navController.navigate("settings") }
          )
        }
        composable("analytics") {
          AnalyticsScreen(hubState.stats)
        }
        composable("devices") {
          DevicesScreen(hubState.devices, navController, isLoading = hubState.isLoading)
        }
        composable("more") {
          MoreHubScreen(navController)
        }
        composable("sessions") {
          SessionsScreen(hubState.stats, navController)
        }
        composable("pricing") {
          PricingScreen(
            state = hubState,
            viewModel = hubViewModel,
            onBack = { navController.popBackStack() }
          )
        }
        composable("settings") {
          SettingsScreen(
            state = connectionState,
            viewModel = connectionViewModel,
            restartRealtime = hubViewModel::restartRealtime,
            onBack = {
              if (!navController.popBackStack()) {
                navController.navigate("overview") {
                  launchSingleTop = true
                }
              }
            }
          )
        }
        composable("session/{key}") { backStack ->
          SessionDetailScreen(
            stats = hubState.stats,
            key = Uri.decode(backStack.arguments?.getString("key").orEmpty()),
            onBack = { navController.popBackStack() }
          )
        }
        composable("device/{id}") { backStack ->
          val id = Uri.decode(backStack.arguments?.getString("id").orEmpty())
          DeviceDetailScreen(
            device = hubState.devices.firstOrNull { it.deviceId == id },
            onBack = { navController.popBackStack() }
          )
        }
      }
    }
  }
}

@Composable
private fun AppNavigationBar(navController: NavHostController, currentRoute: String?) {
  NavigationBar {
    primaryDestinations.forEach { destination ->
      NavigationBarItem(
        selected = currentRoute == destination.route,
        onClick = {
          navController.navigate(destination.route) {
            popUpTo(navController.graph.findStartDestination().id) {
              saveState = true
            }
            launchSingleTop = true
            restoreState = true
          }
        },
        icon = { Icon(destination.icon, contentDescription = destination.label) },
        label = { Text(destination.label) }
      )
    }
  }
}


