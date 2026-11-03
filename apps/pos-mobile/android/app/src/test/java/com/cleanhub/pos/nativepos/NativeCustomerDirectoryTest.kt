package com.cleanhub.pos.nativepos

import org.junit.Assert.*
import org.junit.Test

class NativeCustomerDirectoryTest {
    private val customer = NativeCustomer("customer-one", "account-one", "Amina Diop", "Diop family", "+221 77 123 45 67", "amina@example.com", "disabled")

    @Test fun managementSearchIncludesDisabledCustomersAndContactFormats() {
        assertTrue(nativeDirectoryCustomerMatches(customer, "77-123", "all"))
        assertTrue(nativeDirectoryCustomerMatches(customer, "AMINA@EXAMPLE.COM", "disabled"))
        assertTrue(nativeDirectoryCustomerMatches(customer, "diop family", "all"))
        assertFalse(nativeDirectoryCustomerMatches(customer, "", "active"))
        assertFalse(nativeDirectoryCustomerMatches(customer, "unrelated77", "all"))
    }

    @Test fun registrationRequiresAnAccountContactAndValidEmail() {
        assertFalse(nativeCustomerFormValid("Amina", "", ""))
        assertFalse(nativeCustomerFormValid("", "771234567", ""))
        assertFalse(nativeCustomerFormValid("Amina", "771234567", "wrong@"))
        assertTrue(nativeCustomerFormValid("Amina", "", "amina@example.com"))
        assertTrue(nativeCustomerFormValid("Amina", "771234567", ""))
        assertFalse(nativeCustomerFormValid("Amina", "1".repeat(33), ""))
    }
}
