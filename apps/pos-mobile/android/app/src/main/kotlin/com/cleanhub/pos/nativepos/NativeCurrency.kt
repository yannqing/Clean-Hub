package com.cleanhub.pos.nativepos

import java.util.Locale

/**
 * Currency shape as an accounting rule, mirroring
 * `packages/domain/src/currency.ts`.
 *
 * This is a second copy of a server rule, so it has to be kept in step by hand:
 * a currency added there and missed here makes an offline total disagree with
 * the price the server quotes, and the replayed sale is rejected as
 * PRICE_CHANGED. The list previously covered only XOF and XAF, so a tenant
 * trading in any of the other fourteen priced offline in hundredths of a unit
 * that does not exist.
 */
private val CURRENCY_MINOR_UNITS: Map<String, Int> = mapOf(
    "BIF" to 0,
    "CLP" to 0,
    "DJF" to 0,
    "GNF" to 0,
    "ISK" to 0,
    "JPY" to 0,
    "KMF" to 0,
    "KRW" to 0,
    "PYG" to 0,
    "RWF" to 0,
    "UGX" to 0,
    "VND" to 0,
    "VUV" to 0,
    "XAF" to 0,
    "XOF" to 0,
    "XPF" to 0,
)

private const val DEFAULT_MINOR_UNITS = 2

/**
 * Storage scale. Money is carried in hundredths whatever the currency, matching
 * `MONEY_STORAGE_DECIMALS` and every `numeric(_, 2)` column.
 */
internal const val NATIVE_MONEY_STORAGE_DECIMALS = 2

/** How many decimals a currency can actually be paid in. */
internal fun nativeCurrencyMinorUnits(currency: String?): Int {
    val code = currency?.trim()?.uppercase(Locale.ROOT)
    if (code.isNullOrEmpty()) return DEFAULT_MINOR_UNITS
    return CURRENCY_MINOR_UNITS[code] ?: DEFAULT_MINOR_UNITS
}

/**
 * Smallest payable amount in storage minor units.
 *
 * XOF has no sub-franc coin, so its step is 100 hundredths; EUR pays to the
 * cent, so its step is 1.
 */
internal fun nativeCurrencyPayableStep(currency: String?): Long {
    val shift = NATIVE_MONEY_STORAGE_DECIMALS - nativeCurrencyMinorUnits(currency)
    if (shift <= 0) return 1L
    var step = 1L
    repeat(shift) { step *= 10L }
    return step
}

/**
 * Cash denominations to offer as quick-tender buttons, in major units.
 *
 * A zero-decimal currency needs notes in the hundreds and thousands; a
 * two-decimal one needs single units. Driven by the currency's own shape rather
 * than by a hardcoded pair of codes.
 */
internal fun nativeCashNoteLadder(currency: String?): List<Long> =
    if (nativeCurrencyMinorUnits(currency) == 0) {
        listOf(100L, 500L, 1_000L, 5_000L)
    } else {
        listOf(1L, 5L, 10L, 20L, 50L)
    }
