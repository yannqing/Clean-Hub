package com.cleanhub.pos.nativepos

import org.junit.Assert.*
import org.junit.Test

class NativePosNavigationTest {
    @Test fun wideTallWindowsExposeEveryDestinationWithoutMore() {
        val layout = nativeNavigationLayout(900f, 56f, 80f)
        assertTrue(layout.overflow.isEmpty())
        assertFalse(layout.displayed.contains(NativeNavigationDestination.More))
        assertTrue(layout.visible.contains(NativeNavigationDestination.Settings))
    }
    @Test fun shortWindowsReserveOneSlotForActualOverflow() {
        val layout = nativeNavigationLayout(480f, 56f, 80f)
        assertEquals(7, layout.displayed.size)
        assertEquals(NativeNavigationDestination.More, layout.displayed.last())
        assertTrue(layout.visible.contains(NativeNavigationDestination.Customers))
        assertFalse(layout.overflow.contains(NativeNavigationDestination.Customers))
    }
    @Test fun narrowAndLargeFontWindowsKeepAllDestinationsReachable() {
        for (size in listOf(120f,240f,320f,390f,600f,800f,1200f)) {
            for (extent in listOf(56f,76f,110f,152f)) {
                val layout = nativeNavigationLayout(size,extent)
                val all = layout.visible + layout.overflow
                assertEquals(NativeNavigationDestination.entries.filter { it != NativeNavigationDestination.More }, all)
                assertEquals(all.size, all.toSet().size)
                assertEquals(layout.overflow.isNotEmpty(), layout.displayed.contains(NativeNavigationDestination.More))
                assertTrue(layout.displayed.size <= (size / extent).toInt().coerceAtLeast(1))
            }
        }
    }
    @Test fun resizingDoesNotRemoveOrDuplicateTheCurrentDestination() {
        val current = NativeNavigationDestination.Orders
        val short = nativeNavigationLayout(320f,76f)
        val tall = nativeNavigationLayout(900f,56f,80f)
        assertTrue(current in short.overflow)
        assertTrue(current in tall.visible)
        assertEquals(1,(short.visible+short.overflow).count { it==current })
    }
}
