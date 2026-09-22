package com.cleanhub.pos.nativepos

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NativeReplayFailureTest {

    private fun error(status: Int, code: String? = null) =
        NativePosApiException(status, code, "replay failed")

    @Test
    fun aLostConnectionOrSessionIsRetried() {
        assertTrue("no connection", isTransientReplayFailure(error(0)))
        assertTrue("session expired", isTransientReplayFailure(error(401)))
        assertTrue("terminal rejected", isTransientReplayFailure(error(403)))
    }

    @Test
    fun aServerFaultIsRetried() {
        assertTrue(isTransientReplayFailure(error(500)))
        assertTrue(isTransientReplayFailure(error(502)))
        assertTrue(isTransientReplayFailure(error(503)))
    }

    @Test
    fun theServerRejectingThisSaleIsPermanent() {
        // A price change or a deleted product is about this command only.
        // Retrying it forever would hold up every sale queued behind it.
        assertFalse("price changed", isTransientReplayFailure(error(409, "PRICE_CHANGED")))
        assertFalse("validation", isTransientReplayFailure(error(422)))
        assertFalse("not found", isTransientReplayFailure(error(404)))
    }

    /**
     * The failure this guards: one command failing used to abort the whole
     * `forEach`, leaving every sale behind it unsynced even though each carries
     * its own order id and is independent of the others.
     */
    @Test
    fun aPermanentFailureDoesNotStopLaterCommands() {
        val queue = listOf(409, 200, 200)
        var replayed = 0
        var parked = 0
        var deferred = false

        for (status in queue) {
            if (deferred) break
            when {
                status == 200 -> replayed += 1
                isTransientReplayFailure(error(status)) -> deferred = true
                else -> parked += 1
            }
        }

        assertEquals("the two good sales must still replay", 2, replayed)
        assertEquals(1, parked)
        assertFalse(deferred)
    }

    @Test
    fun aTransientFailureStopsTheRunButKeepsEarlierWork() {
        val queue = listOf(200, 503, 200)
        var replayed = 0
        var deferred = false

        for (status in queue) {
            if (deferred) break
            when {
                status == 200 -> replayed += 1
                isTransientReplayFailure(error(status)) -> deferred = true
            }
        }

        // The sale that landed before the connection dropped stays committed;
        // the rest stay pending for the next run.
        assertEquals(1, replayed)
        assertTrue(deferred)
    }
}
