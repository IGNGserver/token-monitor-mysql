package com.igng.tokenmonitor.android.ui

import com.igng.tokenmonitor.android.data.model.HubBuildDto
import org.junit.Assert.assertEquals
import org.junit.Test

class HubBuildCompatibilityTest {
  private val buildId = "sha256:" + "a".repeat(64)

  @Test
  fun missingBuildIsLegacy() {
    assertEquals(
      HubBuildCompatibilityStatus.Legacy,
      compareHubBuild(null).status
    )
  }

  @Test
  fun currentSchemaWithCompleteIdentityIsCompatible() {
    val result = compareHubBuild(
      HubBuildDto(
        schemaVersion = 1,
        runtime = "node-hub",
        coreRevision = 11,
        coreBuildId = buildId,
        runtimeRevision = 9,
        runtimeBuildId = buildId
      )
    )

    assertEquals(HubBuildCompatibilityStatus.Current, result.status)
    assertEquals("协议兼容", hubBuildCompatibilityLabel(result.status))
  }

  @Test
  fun schemaDirectionsAreReported() {
    assertEquals(
      HubBuildCompatibilityStatus.UpdateAvailable,
      compareHubBuild(HubBuildDto(schemaVersion = 0, runtime = "node-hub")).status
    )
    assertEquals(
      HubBuildCompatibilityStatus.RemoteNewer,
      compareHubBuild(HubBuildDto(schemaVersion = 2, runtime = "node-hub")).status
    )
  }

  @Test
  fun incompleteIdentityIsUnknown() {
    assertEquals(
      HubBuildCompatibilityStatus.Unknown,
      compareHubBuild(HubBuildDto(schemaVersion = 1, runtime = "node-hub")).status
    )
  }
}
