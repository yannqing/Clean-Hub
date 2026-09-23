package com.cleanhub.pos.nativepos

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * The offline pricing in NativeLocalPricing.kt duplicates the server's
 * `calculatePosFinancialTotals`, which delegates tax to `calculateTaxedTotals`
 * in packages/domain/src/tax.ts. Nothing at runtime notices when the two
 * disagree: the till prints one total offline, the server computes another when
 * the sale replays, and the replay is rejected.
 *
 * `serverTotals` below is a line-by-line transcription of the TypeScript. The
 * Kotlin side is the real `calculateNativeLinePricing`, not a copy of it, so a
 * change to the app that is not mirrored here fails this test.
 */
class NativeOfflinePricingParityTest {

    private data class Line(val grossMinor: Long, val taxRate: String?)

    private data class Totals(
        val taxMinor: Long,
        val totalMinor: Long,
        val roundingMinor: Long,
        /** (rate, taxable, tax) per group, dominant first. */
        val breakdown: List<Triple<String, Long, Long>>,
    )

    /** Transcribed from packages/domain/src/tax.ts and orders.financial.ts. */
    private fun serverTotals(
        lines: List<Line>,
        defaultRate: String,
        taxEnabled: Boolean,
        pricesIncludeTax: Boolean,
        roundingRule: String,
        currencyStep: Long,
    ): Totals {
        fun roundRatio(numerator: Long, denominator: Long): Long =
            if (denominator <= 0L) 0L else (numerator + denominator / 2) / denominator

        // taxRateToScale: Math.round(Number(value) * 10_000)
        fun scale(value: String): Long = Math.round(value.toDouble() * 10_000.0).coerceAtLeast(0L)

        // normalizeTaxRate
        fun normalize(value: String): String {
            val scaled = scale(value)
            return "${scaled / 10_000}.${(scaled % 10_000).toString().padStart(4, '0')}"
        }

        val subtotal = lines.sumOf { it.grossMinor }
        // Offline: no discount, so every line's base is its gross.
        val rated = lines.map {
            (if (taxEnabled) normalize(it.taxRate ?: defaultRate) else "0.0000") to it.grossMinor
        }
        val order = mutableListOf<String>()
        val base = mutableMapOf<String, Long>()
        for ((rate, gross) in rated) {
            if (rate !in base) order += rate
            base[rate] = (base[rate] ?: 0L) + gross
        }
        data class Group(val rate: String, val base: Long, val taxable: Long, val tax: Long)
        val groups = order.map { rate ->
            val groupBase = base.getValue(rate)
            val scaled = scale(rate)
            val tax = when {
                scaled == 0L -> 0L
                pricesIncludeTax -> roundRatio(groupBase * scaled, 10_000L + scaled)
                else -> roundRatio(groupBase * scaled, 10_000L)
            }
            Group(rate, groupBase, if (pricesIncludeTax) groupBase - tax else groupBase, tax)
        }
        // [...groups].sort((l, r) => r.base === l.base ? 0 : r.base > l.base ? 1 : -1)
        val sorted = groups.sortedWith { left, right ->
            if (right.base == left.base) 0 else if (right.base > left.base) 1 else -1
        }
        val tax = groups.sumOf { it.tax }
        val beforeRounding = if (pricesIncludeTax) subtotal else subtotal + tax
        val configuredStep = when (roundingRule) {
            "round_yuan" -> 100L
            "round_jiao" -> 10L
            else -> 1L
        }
        val step = if (configuredStep > currencyStep) configuredStep else currencyStep
        val total = if (step <= 1L) beforeRounding else ((beforeRounding + step / 2) / step) * step
        return Totals(
            taxMinor = tax,
            totalMinor = total,
            roundingMinor = total - beforeRounding,
            breakdown = sorted
                .filter { it.base != 0L || sorted.size == 1 }
                .map { Triple(it.rate, it.taxable, it.tax) },
        )
    }

    private fun nativeTotals(
        lines: List<Line>,
        defaultRate: String,
        taxEnabled: Boolean,
        pricesIncludeTax: Boolean,
        roundingRule: String,
        currency: String,
    ): Totals {
        val pricing = calculateNativeLinePricing(
            lines = lines.map { NativePricedLine(it.grossMinor, it.taxRate) },
            currency = currency,
            settings = NativeCheckoutSettings(
                roundingRule = roundingRule,
                taxEnabled = taxEnabled,
                defaultTaxRate = defaultRate,
                pricesIncludeTax = pricesIncludeTax,
            ),
            taxExemptionReason = null,
        )
        return Totals(
            taxMinor = pricing.taxMinor,
            totalMinor = pricing.totalMinor,
            roundingMinor = pricing.roundingAdjustmentMinor,
            breakdown = pricing.taxBreakdown.map { Triple(it.taxRate, it.taxableMinor, it.taxMinor) },
        )
    }

    // EUR: two-decimal, step 1. XOF: zero-decimal, a franc is 100 storage units.
    private val currencies = listOf("EUR" to 1L, "XOF" to 100L)
    private val roundingRules = listOf("none", "round_jiao", "round_yuan")

    @Test
    fun singleRateBasketsMatchTheServerAcrossEveryConfiguration() {
        val subtotals = listOf(
            0L, 1L, 3L, 7L, 49L, 50L, 51L, 99L, 100L, 101L,
            333L, 1_234L, 5_225L, 9_999L, 10_000L, 123_456L, 999_999L,
        )
        // Fractions, as stored: 0.1800 is Senegal's 18% VAT.
        val rates = listOf("0.0000", "0.1800", "0.2000", "0.0550", "0.0725", "0.1000", "0.0333")

        var compared = 0
        for (subtotal in subtotals) for (rate in rates) for (includeTax in listOf(true, false)) {
            for (rule in roundingRules) for ((currency, step) in currencies) {
                val lines = listOf(Line(subtotal, null))
                assertEquals(
                    "subtotal=$subtotal rate=$rate includeTax=$includeTax rule=$rule currency=$currency",
                    serverTotals(lines, rate, true, includeTax, rule, step),
                    nativeTotals(lines, rate, true, includeTax, rule, currency),
                )
                compared += 1
            }
        }
        // Guard the guard: a loop that silently stopped comparing would pass.
        assertEquals(17 * 7 * 2 * 3 * 2, compared)
    }

    @Test
    fun mixedRateBasketsMatchTheServer() {
        val rates = listOf(null, "0.1800", "0.0900", "0.0000", "0.0333", "0.18")
        var seed = 42L
        fun random(max: Int): Int {
            seed = (seed * 1_103_515_245L + 12_345L) % 2_147_483_648L
            return (seed % max).toInt()
        }
        var compared = 0
        repeat(2_000) { trial ->
            val lines = List(1 + random(8)) { Line(random(250_000).toLong(), rates[random(rates.size)]) }
            val defaultRate = listOf("0.1800", "0.0000", "0.2000")[random(3)]
            val includeTax = random(2) == 0
            val taxEnabled = random(5) != 0
            val rule = roundingRules[random(3)]
            val (currency, step) = currencies[random(2)]
            assertEquals(
                "trial=$trial lines=$lines default=$defaultRate includeTax=$includeTax " +
                    "taxEnabled=$taxEnabled rule=$rule currency=$currency",
                serverTotals(lines, defaultRate, taxEnabled, includeTax, rule, step),
                nativeTotals(lines, defaultRate, taxEnabled, includeTax, rule, currency),
            )
            compared += 1
        }
        assertEquals(2_000, compared)
    }

    /**
     * Parity alone is not correctness: both sides once read 0.18 as 0.18% and
     * this test passed throughout. These are the amounts a customer and a tax
     * inspector expect.
     */
    @Test
    fun eighteenPercentIsEighteenPercent() {
        // Tax-exclusive 10,000 F CFA at 18%: 1,800 of tax, 11,800 to pay.
        val exclusive = nativeTotals(listOf(Line(1_000_000L, null)), "0.1800", true, false, "none", "XOF")
        assertEquals(180_000L, exclusive.taxMinor)
        assertEquals(1_180_000L, exclusive.totalMinor)

        // Tax-inclusive 11,800 holds the same 1,800 and is what the customer pays.
        val inclusive = nativeTotals(listOf(Line(1_180_000L, null)), "0.1800", true, true, "none", "XOF")
        assertEquals(180_000L, inclusive.taxMinor)
        assertEquals(1_180_000L, inclusive.totalMinor)
    }

    @Test
    fun eachItemIsTaxedAtItsOwnRate() {
        // 10,000 at 18%, 5,000 exempt, 2,000 on the 18% default: 1,800 + 0 + 360.
        val totals = nativeTotals(
            listOf(Line(1_000_000L, "0.1800"), Line(500_000L, "0.0000"), Line(200_000L, null)),
            "0.1800", true, false, "none", "XOF",
        )
        assertEquals(216_000L, totals.taxMinor)
        assertEquals(1_916_000L, totals.totalMinor)
        assertEquals(
            listOf(Triple("0.1800", 1_200_000L, 216_000L), Triple("0.0000", 500_000L, 0L)),
            totals.breakdown,
        )
    }

    @Test
    fun ratesAreFormattedExactly() {
        assertEquals("18%", formatNativeTaxRate("0.1800"))
        assertEquals("7%", formatNativeTaxRate("0.0700"))
        assertEquals("7.5%", formatNativeTaxRate("0.0750"))
        assertEquals("7.35%", formatNativeTaxRate("0.0735"))
        assertEquals("0.1800", normalizeNativeTaxRate("0.18"))
    }
}
