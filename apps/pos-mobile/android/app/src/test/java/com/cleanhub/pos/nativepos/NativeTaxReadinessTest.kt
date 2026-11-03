package com.cleanhub.pos.nativepos

import org.junit.Assert.*
import org.junit.Test

class NativeTaxReadinessTest {
    private val now = 1_800_000_000_000L

    @Test fun freshVerifiedConfigurationCanBeUsedOffline() {
        assertTrue(NativeCheckoutSettings(taxReady = true, taxVerifiedAt = now).taxReadyForCheckout(now + 1000))
    }

    @Test fun unknownMissingExpiredAndFutureConfigurationFailClosed() {
        assertFalse(NativeCheckoutSettings().taxReadyForCheckout(now))
        assertFalse(NativeCheckoutSettings(taxReady = true).taxReadyForCheckout(now))
        assertFalse(NativeCheckoutSettings(taxReady = false, taxVerifiedAt = now).taxReadyForCheckout(now))
        val expired = NativeCheckoutSettings(taxReady = true, taxVerifiedAt = now - NATIVE_TAX_READINESS_MAX_AGE_MS - 1)
        assertFalse(expired.taxReadyForCheckout(now))
        assertEquals("POS_TAX_STATUS_UNAVAILABLE", expired.taxCheckoutBlockCode(now))
        assertFalse(NativeCheckoutSettings(taxReady = true, taxVerifiedAt = now + 1000).taxReadyForCheckout(now))
    }

    @Test fun localPreferenceChangesCannotRenewFiscalVerification() {
        val original = NativeCheckoutSettings(taxReady = true, taxVerifiedAt = now)
        val edited = original.copy(autoPrintReceipt = false, lockTimeoutSeconds = 300)
        assertEquals(now, edited.taxVerifiedAt)
        assertFalse(edited.taxReadyForCheckout(now + NATIVE_TAX_READINESS_MAX_AGE_MS + 1))
    }
}
