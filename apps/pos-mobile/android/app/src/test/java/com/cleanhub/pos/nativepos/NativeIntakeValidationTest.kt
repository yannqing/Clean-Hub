package com.cleanhub.pos.nativepos

import org.junit.Assert.*
import org.junit.Test

class NativeIntakeValidationTest {
    @Test
    fun perItemAndWeightBoundariesMatchServer() {
        assertTrue(nativeValidIntakeMeasurement("per_item", "9999", "", ""))
        assertFalse(nativeValidIntakeMeasurement("per_item", "0", "", ""))
        assertFalse(nativeValidIntakeMeasurement("per_item", "10000", "", ""))
        assertFalse(nativeValidIntakeMeasurement("per_item", "1.5", "", ""))
        assertTrue(nativeValidIntakeMeasurement("per_kg", "1", "1.125", "2"))
        assertFalse(nativeValidIntakeMeasurement("per_kg", "1", "1.1254", "2"))
        assertFalse(nativeValidIntakeMeasurement("per_kg", "1", "0", "2"))
        assertFalse(nativeValidIntakeMeasurement("per_kg", "1", "-1", "2"))
        assertFalse(nativeValidIntakeMeasurement("per_kg", "1", "1", "0"))
        assertFalse(nativeValidIntakeMeasurement("per_kg", "1", "1", "10000"))
    }
}
