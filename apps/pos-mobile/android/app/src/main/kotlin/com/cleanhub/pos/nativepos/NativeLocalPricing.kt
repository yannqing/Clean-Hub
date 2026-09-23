package com.cleanhub.pos.nativepos

import java.math.BigDecimal
import java.math.RoundingMode

/**
 * Offline pricing for the native till.
 *
 * A transcription of the server's `calculatePosFinancialTotals` and of
 * `calculateTaxedTotals` in packages/domain/src/tax.ts, which the API and
 * pos-web share. The replay sends this total as the expected amount and the
 * server rejects the sale if its own differs, so the two must agree to the
 * unit. NativeOfflinePricingParityTest holds them together; change both or
 * neither.
 *
 * Each line is taxed at its own rate, or the tenant default when it has none.
 * Tax is taken once per rate group -- the way a VAT return is filed -- never
 * per line, so a ten-line receipt cannot drift from its own total. Offline
 * cash never carries a discount, so no discount is allocated here.
 */

/** Ten-thousandths of the fraction, matching the server's four-decimal rates. */
internal const val NATIVE_TAX_RATE_SCALE = 10_000L

/** One rate's line on a receipt or a VAT return. */
data class NativeTaxBreakdownEntry(
    val taxRate: String,
    val taxableMinor: Long,
    val taxMinor: Long,
)

/** "0.18" and "0.1800" are the same rate; the server's taxRateToScale. */
internal fun nativeTaxRateToScale(value: String): Long = runCatching {
    BigDecimal(value.trim())
        .movePointRight(4)
        .setScale(0, RoundingMode.HALF_UP)
        .longValueExact()
        .coerceAtLeast(0L)
}.getOrDefault(0L)

/** Canonical "0.1800" form, so rates group the way the server groups them. */
internal fun normalizeNativeTaxRate(value: String): String {
    val scaled = nativeTaxRateToScale(value)
    return "%d.%04d".format(java.util.Locale.ROOT, scaled / NATIVE_TAX_RATE_SCALE, scaled % NATIVE_TAX_RATE_SCALE)
}

/** "0.1800" -> "18%", "0.0750" -> "7.5%". */
internal fun formatNativeTaxRate(value: String): String {
    val scaled = nativeTaxRateToScale(value)
    val whole = scaled / 100
    val hundredths = "%02d".format(java.util.Locale.ROOT, scaled % 100).trimEnd('0')
    return if (hundredths.isEmpty()) "$whole%" else "$whole.$hundredths%"
}

private fun roundRatio(numerator: Long, denominator: Long): Long =
    if (denominator <= 0L) 0L else (numerator + denominator / 2) / denominator

internal fun nativeRoundToIncrement(value: Long, increment: Long): Long =
    if (increment <= 1) value else ((value + increment / 2) / increment) * increment

/** A line to price: its gross amount and the rate it carries, if any. */
internal data class NativePricedLine(
    val grossMinor: Long,
    val taxRate: String?,
)

internal fun NativePosCart.pricedLines(): List<NativePricedLine> =
    products.map { NativePricedLine(it.amountMinor * it.quantity, it.taxRate) } +
        // Ticket lines cannot be sold offline; the server preview prices them
        // while online, so their own service rate never decides this total.
        ticketItems.map { NativePricedLine(it.lineAmountMinor, null) }

internal fun calculateNativeLocalPricing(
    cart: NativePosCart,
    settings: NativeCheckoutSettings,
    taxExemptionReason: String?,
): NativeCartPricing = calculateNativeLinePricing(
    lines = cart.pricedLines(),
    currency = cart.currency,
    settings = settings,
    taxExemptionReason = taxExemptionReason,
)

internal fun calculateNativeLinePricing(
    lines: List<NativePricedLine>,
    currency: String,
    settings: NativeCheckoutSettings,
    taxExemptionReason: String?,
): NativeCartPricing {
    val applyTax = settings.taxEnabled && taxExemptionReason.isNullOrBlank()
    val subtotal = lines.sumOf { it.grossMinor.coerceAtLeast(0L) }

    // Group in first-seen order, exactly as the server does, then compute each
    // group's tax once.
    val groupBase = LinkedHashMap<String, Long>()
    for (line in lines) {
        val rate = if (applyTax) normalizeNativeTaxRate(line.taxRate ?: settings.defaultTaxRate) else "0.0000"
        groupBase[rate] = (groupBase[rate] ?: 0L) + line.grossMinor.coerceAtLeast(0L)
    }
    val groups = groupBase.map { (rate, base) ->
        val scaled = nativeTaxRateToScale(rate)
        val tax = when {
            scaled == 0L -> 0L
            settings.pricesIncludeTax -> roundRatio(base * scaled, NATIVE_TAX_RATE_SCALE + scaled)
            else -> roundRatio(base * scaled, NATIVE_TAX_RATE_SCALE)
        }
        NativeTaxBreakdownEntry(
            taxRate = rate,
            taxableMinor = if (settings.pricesIncludeTax) base - tax else base,
            taxMinor = tax,
        ) to base
    }
        // Largest base first, ties in first-seen order (sortedByDescending is
        // stable, as the server's Array.prototype.sort is).
        .sortedByDescending { it.second }

    val tax = groups.sumOf { it.first.taxMinor }
    val beforeRounding = if (settings.pricesIncludeTax) subtotal else subtotal + tax
    val configuredStep = when (settings.roundingRule) {
        "round_yuan" -> 100L
        "round_jiao" -> 10L
        else -> 1L
    }
    val step = maxOf(nativeCurrencyPayableStep(currency), configuredStep)
    val total = nativeRoundToIncrement(beforeRounding, step)
    return NativeCartPricing(
        subtotalMinor = subtotal,
        discounts = emptyList(),
        discountMinor = 0,
        taxableMinor = groups.sumOf { it.first.taxableMinor },
        taxMinor = tax,
        taxRate = groups.firstOrNull()?.first?.taxRate ?: "0.0000",
        taxBreakdown = groups
            .filter { (_, base) -> base != 0L || groups.size == 1 }
            .map { it.first },
        pricesIncludeTax = settings.pricesIncludeTax,
        taxRegistrationNumber = settings.taxRegistrationNumber,
        roundingAdjustmentMinor = total - beforeRounding,
        totalMinor = total,
    )
}

/**
 * The item's own rate from a catalogue payload: null when the server sent null
 * (sold at the default) or an older server sent nothing, never "null".
 */
internal fun org.json.JSONObject.optNativeTaxRate(): String? =
    if (!has("taxRate") || isNull("taxRate")) null
    else optString("taxRate").trim().takeIf { it.isNotEmpty() }?.let(::normalizeNativeTaxRate)
