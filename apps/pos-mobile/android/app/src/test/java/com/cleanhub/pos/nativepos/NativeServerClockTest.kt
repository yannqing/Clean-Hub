package com.cleanhub.pos.nativepos

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

class NativeServerClockTest {

    private val device = 1_700_000_000_000L

    @Before
    fun clearOffset() = NativeServerClock.reset()

    @After
    fun restoreOffset() = NativeServerClock.reset()

    @Test
    fun withoutAResponseItFallsBackToTheDeviceClock() {
        assertEquals(device, NativeServerClock.now(device))
    }

    /**
     * The failure this prevents: an offline sale is stamped when it happens and
     * replayed later, and the server rejects a cash payment dated more than
     * five minutes ahead. A tablet running fast therefore wrote sales it could
     * never upload.
     */
    @Test
    fun aFastDeviceClockIsPulledBackToServerTime() {
        val serverNow = device - 600_000L // device is ten minutes ahead

        NativeServerClock.observeServerTime(serverNow, device)

        assertEquals(serverNow, NativeServerClock.now(device))
        assertEquals(-600_000L, NativeServerClock.offsetMillis())
    }

    @Test
    fun aSlowDeviceClockIsPushedForward() {
        val serverNow = device + 300_000L

        NativeServerClock.observeServerTime(serverNow, device)

        assertEquals(serverNow, NativeServerClock.now(device))
    }

    @Test
    fun theOffsetKeepsTrackingTheDeviceClockAsTimePasses() {
        NativeServerClock.observeServerTime(device - 600_000L, device)

        // Ten seconds later the correction still applies; it is an offset, not
        // a frozen timestamp.
        assertEquals(device - 600_000L + 10_000L, NativeServerClock.now(device + 10_000L))
    }

    @Test
    fun aLaterResponseReplacesAnEarlierOffset() {
        NativeServerClock.observeServerTime(device - 600_000L, device)
        NativeServerClock.observeServerTime(device, device)

        assertEquals(0L, NativeServerClock.offsetMillis())
    }
}
