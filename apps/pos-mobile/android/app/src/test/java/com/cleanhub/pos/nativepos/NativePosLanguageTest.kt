package com.cleanhub.pos.nativepos

import org.junit.Assert.assertEquals
import org.junit.Test

class NativePosLanguageTest {
    @Test
    fun firstLaunchUsesDeviceLanguageWithEnglishFallback() {
        assertEquals("fr", resolvePosLanguageCode(null, null, "fr"))
        assertEquals("zh-CN", resolvePosLanguageCode(null, null, "zh"))
        assertEquals("en", resolvePosLanguageCode(null, null, "es"))
    }

    @Test
    fun tenantDefaultAppliesAfterLoginUnlessDeviceWasChangedManually() {
        assertEquals("fr", resolvePosLanguageCode(null, "fr", "en"))
        assertEquals("zh-CN", resolvePosLanguageCode("zh-CN", "fr", "en"))
        assertEquals("fr", resolvePosLanguageCode("unsupported", "FR", "en"))
    }
}
