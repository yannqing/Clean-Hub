package com.cleanhub.pos.nativepos

import org.junit.Assert.*
import org.junit.Test

class NativeSaleExperienceTest {
    @Test fun unconfirmedCommandsNeverDisplayPaymentSuccess() {
        listOf("cash", "wave", "orange_money", "later").forEach { method ->
            assertEquals(NativeSaleState.Queued, nativeSaleState("pending", method, "paid"))
            assertEquals(NativeSaleState.NeedsReview, nativeSaleState("failed", method, "paid"))
        }
        assertEquals(NativeSaleState.AwaitingPayment, nativeSaleState(null, "wave", "pending"))
        assertEquals(NativeSaleState.AwaitingPayment, nativeSaleState(null, "cash", "partial"))
        assertEquals(NativeSaleState.Deferred, nativeSaleState(null, "later", "unpaid"))
        assertEquals(NativeSaleState.Paid, nativeSaleState(null, "cash", "paid"))
        assertEquals(NativeSaleState.Paid, nativeSaleState(null, "orange_money", "paid"))
    }

    @Test fun customerSearchCoversIdentityAndContactButExcludesInactiveProfiles() {
        val customer = NativeCustomer("profile", "account", "Amina Fall", "Atelier Dakar", "+221771234567", "amina@example.test", "active")
        listOf(" AMINA ", "dakar", "771234", "EXAMPLE.TEST").forEach { assertTrue(nativeCustomerMatches(customer, it)) }
        assertFalse(nativeCustomerMatches(customer, "nobody"))
        assertFalse(nativeCustomerMatches(customer.copy(status = "inactive"), ""))
    }

    @Test fun ticketCartKeepsItsCustomerWhileRetailCartCanUseWalkIn() {
        val customer = NativeCustomer("customer", "account", "Amina", "Amina", null, null, "active")
        val cart = NativePosCart.empty("XOF").copy(customer = NativeCartCustomer(customer.id, customer.fullName))
        assertTrue(canChangeNativeCartCustomer(cart, null))
        val ticketCart = cart.copy(ticketItems = listOf(NativeTicketCartLine("ticket", "item", "T-1", null, "Shirt", "per_item", 1, null, null, 100000, 100000, "XOF", customer.id, customer.fullName)))
        assertTrue(canChangeNativeCartCustomer(ticketCart, customer))
        assertFalse(canChangeNativeCartCustomer(ticketCart, customer.copy(id = "other")))
        assertFalse(canChangeNativeCartCustomer(ticketCart, null))
    }

    @Test fun detailAmountsAndRatesDoNotLosePrecisionOrUseCurrentConfiguration() {
        assertEquals("XOF 1250", nativeOrderMoney("1250.00", "XOF"))
        assertEquals("NGN 1250.75", nativeOrderMoney("1250.75", "NGN"))
        assertEquals("19.25%", nativeOrderRate("0.1925"))
        assertEquals("0.25", nativeOrderBalance("999999999999.99", "999999999999.74"))
        assertEquals("0", nativeOrderBalance("10.00", "11.00"))
    }
}
