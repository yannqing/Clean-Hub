package com.cleanhub.pos.nativepos

import java.math.BigDecimal
import java.text.NumberFormat
import java.util.Locale

/** Presentation only: cached values and financial units are never changed by the locale. */
internal fun nativeAmountText(value: BigDecimal, fractionDigits: Int, language: String): String =
    NumberFormat.getNumberInstance(Locale.forLanguageTag(language)).apply {
        minimumFractionDigits = fractionDigits
        maximumFractionDigits = fractionDigits
        isGroupingUsed = language == "fr"
    }.format(value)

internal fun formatMoney(minor: Long, currency: String, language: String = "en"): String =
    "$currency ${nativeAmountText(BigDecimal.valueOf(minor, 2), 2, language)}"

internal fun NativePosCopy.money(minor: Long, currency: String): String = formatMoney(minor, currency, localeCode())
internal fun NativePosCopy.orderMoney(value: String, currency: String): String = nativeOrderMoney(value, currency, localeCode())
internal fun NativePosCopy.signedMoney(minor: Long, currency: String): String =
    if (minor < 0) "-${money(-minor, currency)}" else money(minor, currency)

internal fun NativePosCopy.taxRate(value: String): String = formatNativeTaxRate(value).let {
    if (localeCode() == "fr") it.replace('.', ',').replace("%", "\u00a0%") else it
}
internal fun NativePosCopy.orderRate(value: String): String = nativeOrderRate(value).let {
    if (localeCode() == "fr") it.replace('.', ',').replace("%", "\u00a0%") else it
}
