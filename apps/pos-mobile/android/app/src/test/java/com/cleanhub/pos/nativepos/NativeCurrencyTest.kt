package com.cleanhub.pos.nativepos

import org.junit.Assert.assertEquals
import org.junit.Test

class NativeCurrencyTest {

    /**
     * Every zero-decimal currency in `packages/domain/src/currency.ts`. This
     * list is a second copy of a server rule; if one is added there and missed
     * here, an offline total disagrees with the server's price and the replayed
     * sale is rejected as PRICE_CHANGED.
     */
    private val zeroDecimal = listOf(
        "BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW",
        "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
    )

    @Test
    fun everyZeroDecimalCurrencyPaysInWholeUnits() {
        // The code previously special-cased XOF and XAF only, so the other
        // fourteen priced offline in hundredths of a unit that does not exist.
        zeroDecimal.forEach { code ->
            assertEquals("$code minor units", 0, nativeCurrencyMinorUnits(code))
            assertEquals("$code payable step", 100L, nativeCurrencyPayableStep(code))
        }
    }

    @Test
    fun theListMatchesTheServerInSize() {
        // A size check catches an entry added to one side and not the other,
        // which the per-code assertions above cannot.
        assertEquals(16, zeroDecimal.size)
    }

    @Test
    fun anOrdinaryCurrencyPaysToTheCent() {
        listOf("EUR", "USD", "CNY", "GBP").forEach { code ->
            assertEquals("$code minor units", 2, nativeCurrencyMinorUnits(code))
            assertEquals("$code payable step", 1L, nativeCurrencyPayableStep(code))
        }
    }

    @Test
    fun anUnknownOrMissingCurrencyFallsBackToTwoDecimals() {
        // Assuming whole units for something unrecognised would round real
        // money away; assuming cents is the safe direction.
        assertEquals(2, nativeCurrencyMinorUnits("ZZZ"))
        assertEquals(2, nativeCurrencyMinorUnits(null))
        assertEquals(2, nativeCurrencyMinorUnits(""))
        assertEquals(2, nativeCurrencyMinorUnits("   "))
    }

    @Test
    fun currencyCodesAreMatchedRegardlessOfCaseOrPadding() {
        assertEquals(0, nativeCurrencyMinorUnits("xof"))
        assertEquals(0, nativeCurrencyMinorUnits(" XOF "))
        assertEquals(0, nativeCurrencyMinorUnits("Xof"))
    }

    @Test
    fun cashNotesFollowTheCurrencyShapeNotAHardcodedCode() {
        // KMF is zero-decimal but was not in the old hardcoded pair, so it used
        // to be offered single-unit notes.
        assertEquals(listOf(100L, 500L, 1_000L, 5_000L), nativeCashNoteLadder("KMF"))
        assertEquals(listOf(100L, 500L, 1_000L, 5_000L), nativeCashNoteLadder("XOF"))
        assertEquals(listOf(1L, 5L, 10L, 20L, 50L), nativeCashNoteLadder("EUR"))
    }
}
