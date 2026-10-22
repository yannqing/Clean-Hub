package com.cleanhub.pos.nativepos

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NativeCashReadinessTest {
    private fun state(mode: String, shift: String? = null, register: String? = "register", cash: String? = null) =
        NativeCashState(shift, register, cash, mode, 1L)

    @Test fun defaultCashDoesNotNeedAnEmployeeShiftOrDrawer() {
        assertTrue(state("untracked").isOfflineCashReady())
        assertTrue(state("untracked", shift = "shift").isOfflineCashReady())
    }

    @Test fun offlineCashStillNeedsSyncedTerminalBookkeeping() {
        assertFalse(state("untracked", register = null).isOfflineCashReady())
        assertFalse(state("untracked", register = "").isOfflineCashReady())
        assertFalse(state("none").isOfflineCashReady())
        assertFalse(state("unknown").isOfflineCashReady())
    }

    @Test fun optionalCashTrackingStillChecksItsDrawerButNotAttendance() {
        for (mode in listOf("shared_drawer", "cash_in_hand")) {
            assertFalse(state(mode).isOfflineCashReady())
            assertFalse(state(mode, cash = "").isOfflineCashReady())
            assertTrue(state(mode, cash = "cash-session").isOfflineCashReady())
        }
    }

    @Test fun syncPreparesDefaultRegisterAutomaticallyAndOnlyWhenMissing() {
        assertTrue(shouldPrepareNativeCashRegister("untracked", false, false, true))
        assertFalse(shouldPrepareNativeCashRegister("untracked", true, false, false))
        assertFalse(shouldPrepareNativeCashRegister("none", false, false, false))
        assertFalse(shouldPrepareNativeCashRegister("unknown", false, false, false))
    }

    @Test fun optInOpeningFloatIsNotSilentlyFabricated() {
        assertFalse(shouldPrepareNativeCashRegister("shared_drawer", false, false, true))
        assertFalse(shouldPrepareNativeCashRegister("cash_in_hand", true, false, true))
        assertTrue(shouldPrepareNativeCashRegister("shared_drawer", false, false, false))
        assertTrue(shouldPrepareNativeCashRegister("cash_in_hand", true, false, false))
    }
}
