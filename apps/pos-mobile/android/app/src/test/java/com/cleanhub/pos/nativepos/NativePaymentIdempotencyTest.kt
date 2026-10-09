package com.cleanhub.pos.nativepos

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class NativePaymentIdempotencyTest {

    private fun counting(): NativePaymentIdempotency {
        var issued = 0
        return NativePaymentIdempotency { "KEY-${++issued}" }
    }

    /**
     * The failure this class exists to prevent: the response is lost to a
     * timeout, the cashier taps again, and the retry must carry the key the
     * server already saw -- otherwise it records a second payment.
     */
    @Test
    fun retryAfterLostResponseReusesTheSameKey() {
        val keys = counting()

        val first = keys.keyFor("order_1")
        // No release(): the request threw, so the payment may or may not have
        // landed and the key has to survive.
        val retry = keys.keyFor("order_1")

        assertEquals(first, retry)
    }

    @Test
    fun aPaymentThatLandedReleasesItsKey() {
        val keys = counting()

        val first = keys.keyFor("order_1")
        keys.release("order_1")
        val second = keys.keyFor("order_1")

        assertNotEquals("a genuinely new payment needs a new key", first, second)
        assertEquals(1, keys.inFlightCount())
    }

    @Test
    fun ordersSettledInParallelDoNotShareAKey() {
        val keys = counting()

        val one = keys.keyFor("order_1")
        val two = keys.keyFor("order_2")

        assertNotEquals(one, two)
        assertEquals(2, keys.inFlightCount())

        keys.release("order_1")
        assertEquals(two, keys.keyFor("order_2"))
    }

    @Test
    fun releasingAnUnknownOrderIsHarmless() {
        val keys = counting()

        keys.release("never_seen")

        assertEquals(0, keys.inFlightCount())
    }

    /**
     * Cash movements share this keyring. Their subject is the movement itself
     * -- type, amount and reason -- because a pay-out the cashier re-taps after
     * a timeout is the same movement, while a genuinely second pay-out of the
     * same amount is entered separately and must be allowed through.
     */
    @Test
    fun aRetriedCashMovementReusesItsKeyButANewOneDoesNot() {
        val keys = counting()

        val first = keys.keyFor("pay_out|50.00|Bank run")
        val retryAfterTimeout = keys.keyFor("pay_out|50.00|Bank run")
        assertEquals(first, retryAfterTimeout)

        // Different reason, so a different movement.
        assertNotEquals(first, keys.keyFor("pay_out|50.00|Supplier"))
        // Different amount, so a different movement.
        assertNotEquals(first, keys.keyFor("pay_out|60.00|Bank run"))
        // A pay-in is not the pay-out being retried.
        assertNotEquals(first, keys.keyFor("pay_in|50.00|Bank run"))
    }

    /**
     * Once the server has the movement, an identical one entered later is a
     * real second movement and must not be deduplicated against the first.
     */
    @Test
    fun anIdenticalCashMovementAfterReleaseGetsANewKey() {
        val keys = counting()
        val subject = "pay_in|20.00|Float top-up"

        val first = keys.keyFor(subject)
        keys.release(subject)
        val second = keys.keyFor(subject)

        assertNotEquals(first, second)
        assertEquals(0, keys.inFlightCount() - 1)
    }
}
