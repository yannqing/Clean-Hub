package com.cleanhub.pos.nativepos

/**
 * Idempotency keys for payments against an existing order.
 *
 * The server deduplicates a payment by `(tenant_id, idempotency_key)`, so a
 * retry only reaches that guard if it carries the key the first attempt used.
 * Generating a fresh key per tap defeats it entirely: a response lost to a
 * timeout looks like a new payment, and the customer is charged twice.
 *
 * A key is therefore minted once per payment attempt, held while the request is
 * in flight, and released only once the payment is known to have landed -- at
 * which point a further payment on the same order is genuinely a new one and
 * must get its own key.
 *
 * Keys are per order id, so two orders being settled in parallel never collide.
 */
class NativePaymentIdempotency(private val newKey: () -> String = { NativeUlid.create() }) {
    private val keys = mutableMapOf<String, String>()

    /** The key for this order's in-flight payment, minting one if needed. */
    fun keyFor(orderId: String): String = keys.getOrPut(orderId) { newKey() }

    /** Call once the payment has landed, so the next one starts a new key. */
    fun release(orderId: String) {
        keys.remove(orderId)
    }

    /** Visible for tests. */
    fun inFlightCount(): Int = keys.size
}
