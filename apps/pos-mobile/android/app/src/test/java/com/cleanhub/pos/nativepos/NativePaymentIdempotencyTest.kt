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
}
