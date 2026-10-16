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
 * Keys are per subject -- an order id for a payment, or a cash movement's own
 * identity -- so two operations in flight together never collide.
 */
class NativePaymentIdempotency(private val newKey: () -> String = { NativeUlid.create() }) {
    private val keys = mutableMapOf<String, String>()

    /** The key for this subject's in-flight request, minting one if needed. */
    fun keyFor(subject: String): String = keys.getOrPut(subject) { newKey() }

    /** Call once the request has landed, so the next one starts a new key. */
    fun release(subject: String) {
        keys.remove(subject)
    }

    /** Visible for tests. */
    fun inFlightCount(): Int = keys.size
}
