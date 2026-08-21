package com.igng.tokenmonitor.android.ui

import com.igng.tokenmonitor.android.data.model.HubBuildDto

private const val SUPPORTED_HUB_BUILD_SCHEMA = 1
private val buildIdPattern = Regex("^sha256:[0-9a-fA-F]{64}$")

enum class HubBuildCompatibilityStatus {
  Current,
  UpdateAvailable,
  RemoteNewer,
  Legacy,
  Unknown
}

data class HubBuildCompatibility(
  val status: HubBuildCompatibilityStatus,
  val runtime: String = "",
  val schemaVersion: Int? = null
)

private fun normalizeHubRuntime(value: String?): String = when (value?.trim()?.lowercase()) {
  "node", "hub", "node-hub" -> "node-hub"
  "worker", "cloudflare-worker" -> "cloudflare-worker"
  else -> ""
}

private fun validRevision(value: Int?): Boolean = value != null && value > 0

private fun validBuildId(value: String?): Boolean = value?.let(buildIdPattern::matches) == true

/**
 * Compare the Hub's advertised wire schema with what this Android build can
 * safely consume. A Current result means protocol-compatible, not identical
 * desktop/Hub revision; Hub revisions are implementation details of the
 * shared runtime and may advance without requiring an Android release.
 */
fun compareHubBuild(build: HubBuildDto?): HubBuildCompatibility {
  if (build == null) return HubBuildCompatibility(HubBuildCompatibilityStatus.Legacy)
  val runtime = normalizeHubRuntime(build.runtime)
  if (runtime.isBlank()) return HubBuildCompatibility(HubBuildCompatibilityStatus.Unknown)
  val schema = build.schemaVersion
    ?: return HubBuildCompatibility(HubBuildCompatibilityStatus.Unknown, runtime)
  if (schema > SUPPORTED_HUB_BUILD_SCHEMA) {
    return HubBuildCompatibility(HubBuildCompatibilityStatus.RemoteNewer, runtime, schema)
  }
  if (schema < SUPPORTED_HUB_BUILD_SCHEMA) {
    return HubBuildCompatibility(HubBuildCompatibilityStatus.UpdateAvailable, runtime, schema)
  }
  if (!validRevision(build.coreRevision)
    || !validRevision(build.runtimeRevision)
    || !validBuildId(build.coreBuildId)
    || !validBuildId(build.runtimeBuildId)
  ) {
    return HubBuildCompatibility(HubBuildCompatibilityStatus.Unknown, runtime, schema)
  }
  return HubBuildCompatibility(HubBuildCompatibilityStatus.Current, runtime, schema)
}

fun hubBuildCompatibilityLabel(status: HubBuildCompatibilityStatus): String = when (status) {
  HubBuildCompatibilityStatus.Current -> "协议兼容"
  HubBuildCompatibilityStatus.UpdateAvailable -> "Hub 需要更新"
  HubBuildCompatibilityStatus.RemoteNewer -> "Hub 协议较新"
  HubBuildCompatibilityStatus.Legacy -> "旧版 Hub"
  HubBuildCompatibilityStatus.Unknown -> "无法判断"
}
