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

    /**
     * A dropped connection or a timeout reaches the replay loop as a
     * NETWORK_ERROR with status 0. Before the client wrapped IOException, it
     * arrived as a raw IOException and slipped past this classification
     * entirely -- the loop caught only NativePosApiException.
     */
    @Test
    fun aWrappedTransportFailureIsRetried() {
        assertTrue(isTransientReplayFailure(error(0, "NETWORK_ERROR")))
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

    /**
     * The decision the replay loop makes for one command: keep it pending, or
     * give up and park it. Without the cap, a command that keeps failing
     * transiently -- an endpoint returning 500 forever -- stays pending for
     * good and nobody is told the sale never landed.
     */
    private fun keepsRetrying(error: NativePosApiException, attempt: Int): Boolean =
        isTransientReplayFailure(error) && attempt < NATIVE_REPLAY_MAX_ATTEMPTS

    @Test
    fun anExhaustedCommandIsParkedEvenWhenTheFailureLooksTransient() {
        val outage = error(503)

        assertTrue("first attempt", keepsRetrying(outage, 1))
        assertTrue("well within the cap", keepsRetrying(outage, NATIVE_REPLAY_MAX_ATTEMPTS - 1))
        assertFalse("at the cap", keepsRetrying(outage, NATIVE_REPLAY_MAX_ATTEMPTS))
        assertFalse("past the cap", keepsRetrying(outage, NATIVE_REPLAY_MAX_ATTEMPTS + 1))
    }

    @Test
    fun aRejectedSaleIsParkedOnItsFirstAttempt() {
        // The cap is for transient failures. A sale the server has rejected on
        // its merits should not be retried 25 times first.
        assertFalse(keepsRetrying(error(422), 1))
    }

    @Test
    fun theAttemptCapIsGenerousEnoughForABadNetworkDay() {
        // A failing network is the normal offline case, so the cap must not be
        // so tight that an ordinary outage abandons a real sale. Matches
        // OFFLINE_QUEUE_MAX_ATTEMPTS in packages/offline.
        assertEquals(25, NATIVE_REPLAY_MAX_ATTEMPTS)
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
