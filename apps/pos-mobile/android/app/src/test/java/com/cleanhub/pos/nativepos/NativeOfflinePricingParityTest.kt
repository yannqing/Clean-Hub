package com.cleanhub.pos.nativepos

import java.math.BigDecimal
import java.math.RoundingMode
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * The offline pricing in NativePosApp duplicates the server's
 * `calculatePosFinancialTotals`. Nothing at runtime notices when the two
 * disagree: the till prints one total offline and the server records another
 * when the sale replays, and the difference lands in the day's cash variance.
 *
 * This transcribes the server algorithm -- which scales the tax rate by 10,000
 * where the Kotlin divides BigDecimal directly -- and asserts the two agree
 * across the rates, rounding rules and currencies a branch can be configured
 * with. It is a parity test, not a test of either implementation.
 */
class NativeOfflinePricingParityTest {

    /** Transcribed from apps/api/src/modules/pos/orders/orders.financial.ts. */
    private fun serverTotals(
        subtotalMinor: Long,
        taxRate: String,
        pricesIncludeTax: Boolean,
        roundingRule: String,
        currencyStep: Long,
    ): Triple<Long, Long, Long> {
        fun roundRatio(numerator: Long, denominator: Long): Long =
            if (denominator <= 0L) 0L else (numerator + denominator / 2) / denominator

        fun roundToIncrement(value: Long, increment: Long): Long =
            if (increment <= 1L) value else ((value + increment / 2) / increment) * increment

        // taxRateToScale: Math.round(Number(value) * 10_000); TAX_RATE_SCALE = 10_000
        val rateScaled = Math.round(taxRate.toDouble() * 10_000.0).coerceAtLeast(0L)
        val taxRateScale = 10_000L
        val tax = when {
            rateScaled == 0L -> 0L
            pricesIncludeTax ->
                roundRatio(subtotalMinor * rateScaled, taxRateScale + rateScaled)
            else -> roundRatio(subtotalMinor * rateScaled, taxRateScale)
        }
        val beforeRounding = if (pricesIncludeTax) subtotalMinor else subtotalMinor + tax
        val configuredStep = when (roundingRule) {
            "round_yuan" -> 100L
            "round_jiao" -> 10L
            else -> 1L
        }
        val step = if (configuredStep > currencyStep) configuredStep else currencyStep
        val total = roundToIncrement(beforeRounding, step)
        return Triple(tax, total, total - beforeRounding)
    }

    /** Transcribed from calculateNativeLocalPricing in NativePosApp.kt. */
    private fun nativeTotals(
        subtotalMinor: Long,
        taxRate: String,
        pricesIncludeTax: Boolean,
        roundingRule: String,
        currencyStep: Long,
    ): Triple<Long, Long, Long> {
        val percentage = runCatching { BigDecimal(taxRate) }.getOrDefault(BigDecimal.ZERO)
        val base = BigDecimal(subtotalMinor)
        val tax = if (percentage.signum() == 0) {
            0L
        } else {
            val divisor = if (pricesIncludeTax) {
                BigDecimal.ONE.add(percentage)
            } else {
                BigDecimal.ONE
            }
            base.multiply(percentage).divide(divisor, 0, RoundingMode.HALF_UP).longValueExact()
        }
        val beforeRounding = if (pricesIncludeTax) subtotalMinor else subtotalMinor + tax
        val configuredStep = when (roundingRule) {
            "round_yuan" -> 100L
            "round_jiao" -> 10L
            else -> 1L
        }
        val step = maxOf(currencyStep, configuredStep)
        val total =
            if (step <= 1) beforeRounding else ((beforeRounding + step / 2) / step) * step
        return Triple(tax, total, total - beforeRounding)
    }

    @Test
    fun offlinePricingMatchesTheServerAcrossEveryConfiguration() {
        // Amounts that exercise rounding boundaries, not just round numbers.
        val subtotals = listOf(
            0L, 1L, 3L, 7L, 49L, 50L, 51L, 99L, 100L, 101L,
            333L, 1_234L, 5_225L, 9_999L, 10_000L, 123_456L, 999_999L,
        )
        // Rates as the owner's settings form stores them -- fractions, so 0.1800
        // is Senegal's 18% VAT -- including rates whose thirds do not divide
        // cleanly.
        val rates = listOf("0.0000", "0.1800", "0.2000", "0.0550", "0.0725", "0.1000", "0.0333")
        val roundingRules = listOf("none", "round_jiao", "round_yuan")
        // 1 = a two-decimal currency such as EUR; 100 = XOF and the other
        // zero-decimal currencies, where a franc is the smallest payable unit.
        val currencySteps = listOf(1L, 100L)

        var compared = 0
        for (subtotal in subtotals) {
            for (rate in rates) {
                for (includeTax in listOf(true, false)) {
                    for (rule in roundingRules) {
                        for (step in currencySteps) {
                            val server = serverTotals(subtotal, rate, includeTax, rule, step)
                            val native = nativeTotals(subtotal, rate, includeTax, rule, step)
                            assertEquals(
                                "subtotal=$subtotal rate=$rate includeTax=$includeTax " +
                                    "rule=$rule currencyStep=$step",
                                server,
                                native,
                            )
                            compared += 1
                        }
                    }
                }
            }
        }

        // Guard the guard: a loop that silently stopped comparing would pass.
        assertEquals(17 * 7 * 2 * 3 * 2, compared)
    }

    /**
     * Parity alone is not correctness. Both implementations read 0.18 as 0.18%
     * for as long as they agreed with each other, and this test passed
     * throughout. These are the amounts a customer and a tax inspector expect.
     */
    @Test
    fun eighteenPercentIsEighteenPercentOnBothSides() {
        // Tax-exclusive 10,000 F CFA at 18%: 1,800 of tax, 11,800 to pay.
        val exclusive = Triple(180_000L, 1_180_000L, 0L)
        assertEquals(exclusive, serverTotals(1_000_000L, "0.1800", false, "none", 100L))
        assertEquals(exclusive, nativeTotals(1_000_000L, "0.1800", false, "none", 100L))

        // Tax-inclusive 11,800 holds the same 1,800 and is what the customer pays.
        val inclusive = Triple(180_000L, 1_180_000L, 0L)
        assertEquals(inclusive, serverTotals(1_180_000L, "0.1800", true, "none", 100L))
        assertEquals(inclusive, nativeTotals(1_180_000L, "0.1800", true, "none", 100L))
    }
}
