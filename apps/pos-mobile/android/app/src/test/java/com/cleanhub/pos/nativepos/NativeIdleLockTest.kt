package com.cleanhub.pos.nativepos

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NativeIdleLockTest {

    private val now = 1_700_000_000_000L

    @Test
    fun anIdleTillLocksOnceTheBudgetIsSpent() {
        val fiveMinutes = 300

        assertFalse("just used", shouldLockForIdle(fiveMinutes, now - 1_000, now))
        assertFalse("one second short", shouldLockForIdle(fiveMinutes, now - 299_000, now))
        assertTrue("exactly at the timeout", shouldLockForIdle(fiveMinutes, now - 300_000, now))
        assertTrue("long past it", shouldLockForIdle(fiveMinutes, now - 3_600_000, now))
    }

    /**
     * The server treats 0 as "never lock". Reading it as "lock immediately"
     * would lock the till between every keystroke.
     */
    @Test
    fun aZeroTimeoutDisablesTheLock() {
        assertFalse(shouldLockForIdle(0, now - 86_400_000, now))
        assertFalse(shouldLockForIdle(-1, now - 86_400_000, now))
    }

    @Test
    fun theNextCheckIsScheduledForExactlyWhenTheBudgetRunsOut() {
        // A busy till should do no periodic work: each check sleeps precisely
        // the remaining budget rather than polling on a fixed tick.
        assertEquals(300_000L, idleLockDelayMs(300, now, now))
        assertEquals(100_000L, idleLockDelayMs(300, now - 200_000, now))
    }

    @Test
    fun anAlreadyExpiredBudgetNeverSleepsNegatively() {
        // A clock that jumped, or a device resumed after sleep, must not turn
        // into a negative delay.
        assertEquals(0L, idleLockDelayMs(300, now - 900_000, now))
    }
}
