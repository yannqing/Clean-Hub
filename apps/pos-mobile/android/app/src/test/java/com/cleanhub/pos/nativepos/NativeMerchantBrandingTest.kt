package com.cleanhub.pos.nativepos

import org.junit.Assert.*
import org.junit.Test

class NativeMerchantBrandingTest {
    @Test fun titleAndLogoAreIndependent() {
        assertEquals("Merchant", nativeMerchantTitle(" Merchant ", "Tenant", false))
        assertEquals("Merchant", nativeMerchantTitle("Merchant", "Tenant", true))
        assertEquals("", nativeMerchantTitle("", "Tenant", true))
        assertEquals("Tenant", nativeMerchantTitle(" ", "Tenant", false))
    }

    @Test fun cacheIsTenantScopedAndStableAcrossSignedUrlRenewal() {
        assertEquals(nativeBrandLogoCacheKey("tenant-a", "logo"), nativeBrandLogoCacheKey("tenant-a", "logo"))
        assertNotEquals(nativeBrandLogoCacheKey("tenant-a", "logo"), nativeBrandLogoCacheKey("tenant-b", "logo"))
        assertNotEquals(nativeBrandLogoCacheKey("tenant-a", "logo"), nativeBrandLogoCacheKey("tenant-a", "new-logo"))
        assertTrue(nativeBrandLogoCacheKey("tenant-a", "../../logo").matches(Regex("[a-f0-9]{64}")))
    }
}
