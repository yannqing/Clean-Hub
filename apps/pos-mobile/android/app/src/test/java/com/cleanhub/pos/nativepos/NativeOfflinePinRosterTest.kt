package com.cleanhub.pos.nativepos

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class NativeOfflinePinRosterTest {

    @Test
    fun aHandoverKeepsBothCashiersAbleToUnlock() {
        // The bug this replaces: one slot for the whole device meant saving B
        // erased A, so after a handover A could not unlock while offline.
        val roster = mapOf("cashier_a" to 1_000L)

        assertTrue(
            "remembering a second cashier must not evict the first",
            offlinePinUserIdsToEvict(roster, keepUserId = "cashier_b", maxUsers = 8).isEmpty(),
        )
    }

    @Test
    fun reSavingTheSameCashierEvictsNobody() {
        val roster = (1..8).associate { "cashier_$it" to it.toLong() }

        assertEquals(
            emptyList<String>(),
            offlinePinUserIdsToEvict(roster, keepUserId = "cashier_3", maxUsers = 8),
        )
    }

    @Test
    fun aFullRosterDropsTheLeastRecentlySaved() {
        val roster = mapOf(
            "oldest" to 100L,
            "middle" to 200L,
            "newest" to 300L,
        )

        assertEquals(
            listOf("oldest"),
            offlinePinUserIdsToEvict(roster, keepUserId = "arriving", maxUsers = 3),
        )
    }

    @Test
    fun aRosterOverTheLimitShedsEnoughToFit() {
        // A lowered limit, or state left by an older build, must converge
        // rather than evict one entry per login forever.
        val roster = mapOf(
            "a" to 1L,
            "b" to 2L,
            "c" to 3L,
            "d" to 4L,
        )

        assertEquals(
            listOf("a", "b"),
            offlinePinUserIdsToEvict(roster, keepUserId = "e", maxUsers = 3),
        )
    }

    @Test
    fun theCashierBeingSavedIsNeverEvicted() {
        val roster = mapOf("oldest" to 1L, "newer" to 2L)

        val evicted = offlinePinUserIdsToEvict(roster, keepUserId = "oldest", maxUsers = 1)

        assertTrue(
            "the cashier signing in must keep their own PIN",
            !evicted.contains("oldest"),
        )
        assertEquals(listOf("newer"), evicted)
    }

    @Test
    fun anEmptyRosterEvictsNobody() {
        assertEquals(
            emptyList<String>(),
            offlinePinUserIdsToEvict(emptyMap(), keepUserId = "first", maxUsers = 8),
        )
    }
}
