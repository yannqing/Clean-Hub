package com.cleanhub.pos.nativepos

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

/**
 * Mirrors how createCustomer decides whether a tap continues the previous
 * attempt or starts a new customer. Creating a customer is two calls with no
 * transaction spanning them, and both endpoints return the existing record when
 * handed an id they have already seen -- so reusing the ids turns a retry into
 * a no-op instead of a second account with no profile under it.
 */
private fun draftFor(
    pending: NativeCustomerDraft?,
    fullName: String,
    phone: String,
    mintAccountId: () -> String,
    mintProfileId: () -> String,
): NativeCustomerDraft =
    pending?.takeIf { it.fullName == fullName.trim() && it.phone == phone.trim() }
        ?: NativeCustomerDraft(
            accountId = mintAccountId(),
            profileId = mintProfileId(),
            fullName = fullName.trim(),
            phone = phone.trim(),
        )

class NativeCustomerDraftTest {

    private var minted = 0
    private fun mint(): String = "ULID-${++minted}"

    @Test
    fun retryingTheSameCustomerReusesBothIds() {
        val first = draftFor(null, "Awa Diop", "77000000", ::mint, ::mint)

        // The second call failed, so the draft is still pending when the
        // cashier taps again.
        val retry = draftFor(first, "Awa Diop", "77000000", ::mint, ::mint)

        assertEquals(first.accountId, retry.accountId)
        assertEquals(first.profileId, retry.profileId)
    }

    @Test
    fun aDifferentCustomerGetsFreshIds() {
        val first = draftFor(null, "Awa Diop", "77000000", ::mint, ::mint)

        val other = draftFor(first, "Moussa Fall", "77111111", ::mint, ::mint)

        assertNotEquals(first.accountId, other.accountId)
        assertNotEquals(first.profileId, other.profileId)
    }

    @Test
    fun aCorrectedTypoStartsANewDraft() {
        // The cashier fixed the phone number after a failure, so this is a
        // different customer and must not reuse the ids of the failed attempt.
        val first = draftFor(null, "Awa Diop", "77000000", ::mint, ::mint)

        val corrected = draftFor(first, "Awa Diop", "77000001", ::mint, ::mint)

        assertNotEquals(first.accountId, corrected.accountId)
    }

    @Test
    fun whitespaceDoesNotLookLikeADifferentCustomer() {
        val first = draftFor(null, "Awa Diop", "77000000", ::mint, ::mint)

        val retry = draftFor(first, "  Awa Diop  ", " 77000000 ", ::mint, ::mint)

        assertEquals(first.accountId, retry.accountId)
    }

    @Test
    fun aClearedDraftStartsAfresh() {
        val first = draftFor(null, "Awa Diop", "77000000", ::mint, ::mint)

        // Both halves landed, so createCustomer clears the draft.
        val next = draftFor(null, "Awa Diop", "77000000", ::mint, ::mint)

        assertNotEquals(
            "a second customer with the same details is still a new customer",
            first.accountId,
            next.accountId,
        )
    }
}
