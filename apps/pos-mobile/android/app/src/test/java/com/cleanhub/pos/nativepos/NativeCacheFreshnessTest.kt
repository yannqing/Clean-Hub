package com.cleanhub.pos.nativepos

import org.junit.Assert.assertEquals
import org.junit.Test

class NativeCacheFreshnessTest {

    private val now = 1_700_000_000_000L
    private fun hours(count: Long) = count * 3_600_000L

    @Test
    fun aRecentlySyncedCatalogIsFresh() {
        assertEquals(
            NativeCacheFreshness.Fresh,
            nativeCacheFreshness(now - hours(1), now),
        )
        assertEquals(
            NativeCacheFreshness.Fresh,
            nativeCacheFreshness(now - hours(23), now),
        )
    }

    /**
     * The failure this replaces: staleness was judged only by "is the product
     * list empty", so a terminal offline for a week kept selling at week-old
     * prices with nothing on screen to say so.
     */
    @Test
    fun aCatalogLeftUnsyncedForADayIsStale() {
        assertEquals(
            NativeCacheFreshness.Stale,
            nativeCacheFreshness(now - hours(24), now),
        )
        assertEquals(
            NativeCacheFreshness.Stale,
            nativeCacheFreshness(now - hours(24 * 7), now),
        )
    }

    @Test
    fun aTerminalThatHasNeverSyncedIsNotWarnedAboutStaleness() {
        // The empty-catalog path already blocks this case; warning as well
        // would put two contradictory messages on one screen.
        assertEquals(NativeCacheFreshness.Fresh, nativeCacheFreshness(0, now))
    }

    @Test
    fun aClockThatMovedBackwardsDoesNotWarnOnEveryScreen() {
        assertEquals(
            NativeCacheFreshness.Fresh,
            nativeCacheFreshness(now + hours(5), now),
        )
    }

    @Test
    fun theAgeIsReportedInWholeHours() {
        assertEquals(0L, nativeCacheAgeHours(now - hours(1) + 1, now))
        assertEquals(26L, nativeCacheAgeHours(now - hours(26), now))
        assertEquals(0L, nativeCacheAgeHours(now + hours(3), now))
    }
}
