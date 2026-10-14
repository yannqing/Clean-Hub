package com.cleanhub.pos.nativepos

import org.junit.Assert.*
import org.junit.Test

class NativeTerminalSettingsPatchTest {
    @Test fun settingsCannotBeAppliedToADifferentDevice() {
        requireNativeTerminalDevice("device-one", "device-one", nativePosCopy("en"))
        assertThrows(NativePosValidationException::class.java) {
            requireNativeTerminalDevice("device-two", "device-one", nativePosCopy("en"))
        }
        assertThrows(NativePosValidationException::class.java) {
            requireNativeTerminalDevice("", "device-one", nativePosCopy("en"))
        }
    }
    @Test fun printingChangesDoNotSubmitOtherSections() {
        val patch = NativeTerminalSettingsPatch(autoPrintReceipt=false,printCopies=2)
        assertTrue(patch.isValid())
        assertNull(patch.lockTimeoutSeconds)
        assertNull(patch.roundingRule)
        assertNull(patch.label)
    }
    @Test fun rejectsValuesOutsideServerLimitsAndEmptyPatches() {
        assertFalse(NativeTerminalSettingsPatch().isValid())
        assertFalse(NativeTerminalSettingsPatch(label="x".repeat(65)).isValid())
        assertFalse(NativeTerminalSettingsPatch(lockTimeoutSeconds=0).isValid())
        assertFalse(NativeTerminalSettingsPatch(lockTimeoutSeconds=86401).isValid())
        assertFalse(NativeTerminalSettingsPatch(printCopies=6).isValid())
        assertTrue(NativeTerminalSettingsPatch(printCopies=5).isValid())
        assertFalse(NativeTerminalSettingsPatch(roundingRule="unknown").isValid())
        assertTrue(NativeTerminalSettingsPatch(lockTimeoutSeconds=30).isValid())
        assertTrue(NativeTerminalSettingsPatch(lockTimeoutSeconds=86400).isValid())
    }
}
