package com.cleanhub.pos.nativepos

/**
 * Correction between this device's clock and the server's.
 *
 * An offline sale records `occurredAt` when it happens and replays it later.
 * The server refuses a cash payment dated more than five minutes in the future
 * (`validateCashOccurrence`), so a tablet whose clock runs fast writes a sale
 * that can never be accepted -- it is parked as a permanent failure and the
 * takings have to be reconciled by hand.
 *
 * Every API response carries a `Date` header, so the offset is learned for free
 * on each call and applied when stamping offline work.
 */
object NativeServerClock {
    @Volatile
    private var offsetMs: Long = 0

    /** Record the offset implied by one response's `Date` header. */
    fun observeServerTime(serverEpochMs: Long, deviceEpochMs: Long = System.currentTimeMillis()) {
        offsetMs = serverEpochMs - deviceEpochMs
    }

    /**
     * Now, as the server would date it.
     *
     * Falls back to the device clock when no response has been seen yet, which
     * is the same behaviour this replaces.
     */
    fun now(deviceEpochMs: Long = System.currentTimeMillis()): Long = deviceEpochMs + offsetMs

    /** Visible for tests. */
    fun offsetMillis(): Long = offsetMs

    /** Visible for tests. */
    fun reset() {
        offsetMs = 0
    }
}
