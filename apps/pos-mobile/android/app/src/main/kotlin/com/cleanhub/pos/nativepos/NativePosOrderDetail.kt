package com.cleanhub.pos.nativepos

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.json.JSONObject
import java.math.BigDecimal
import java.math.RoundingMode

internal data class NativeMoreOrderItem(
    val id: String,
    val name: String,
    val quantity: String,
    val lineAmount: String,
    val unitAmount: String = "0",
    val sku: String? = null,
    val variantName: String? = null,
    val weight: String? = null,
    val bagCount: Int? = null,
    val notes: String? = null,
    val taxAmount: String = "0",
)
internal data class NativeMorePayment(
    val id: String,
    val method: String,
    val amount: String,
    val tenderedAmount: String?,
    val changeAmount: String?,
    val status: String,
    val provider: String?,
    val externalReference: String?,
    val createdAt: String,
)
internal data class NativeMorePaymentAdjustment(
    val id: String,
    val originalPaymentId: String?,
    val type: String,
    val status: String,
    val amount: String,
    val reason: String,
)
internal data class NativeMoreOrderDetail(
    val id: String,
    val customerName: String?,
    val totalAmount: String,
    val paidAmount: String,
    val currency: String,
    val status: String,
    val paymentStatus: String,
    val version: Int,
    val items: List<NativeMoreOrderItem>,
    val payments: List<NativeMorePayment>,
    val adjustments: List<NativeMorePaymentAdjustment> = emptyList(),
    val orderType: String = "manual",
    val subtotalAmount: String = "0",
    val discountAmount: String = "0",
    val taxableAmount: String = "0",
    val taxAmount: String = "0",
    val taxRate: String = "0",
    val taxLabel: String? = null,
    val pricesIncludeTax: Boolean = true,
    val taxNumber: String? = null,
    val taxExemptionReason: String? = null,
    val roundingAmount: String = "0",
    val createdAt: String? = null,
    val updatedAt: String? = null,
    val dueAt: String? = null,
    val notes: String? = null,
    val unpaidReason: String? = null,
    val taxLines: List<NativeOrderTaxLine> = emptyList(),
    val discounts: List<NativeOrderDiscount> = emptyList(),
    val tickets: List<NativeOrderTicketReference> = emptyList(),
)
internal data class NativeOrderTaxLine(val name: String?, val rate: String, val taxableAmount: String, val taxAmount: String)
internal data class NativeOrderDiscount(val title: String, val code: String?, val amount: String)
internal data class NativeOrderTicketReference(val id: String, val number: String?, val status: String, val pickupAt: String?, val assistant: String?, val remark: String?, val count: Int, val amount: String)

internal fun JSONObject.optionalNativeString(key: String): String? =
    if (isNull(key)) null else optString(key).trim().takeIf { it.isNotEmpty() && it != "null" }

internal fun JSONObject.nativeOrderTaxLines(): List<NativeOrderTaxLine> {
    val components = optJSONArray("taxComponentsSnapshot")
    return buildList {
        val componentRates = mutableSetOf<String>()
        fun normalizedRate(value: String): String = runCatching { BigDecimal(value).stripTrailingZeros().toPlainString() }.getOrDefault(value)
        for (index in 0 until (components?.length() ?: 0)) {
            val value = components?.optJSONObject(index) ?: continue
            value.optionalNativeString("parentRate")?.let { componentRates.add(normalizedRate(it)) }
            add(NativeOrderTaxLine(value.optionalNativeString("name"), value.optString("rate", "0"), value.optString("taxableAmount", "0"), value.optString("taxAmount", "0")))
        }
        val breakdown = optJSONArray("taxBreakdown")
        for (index in 0 until (breakdown?.length() ?: 0)) {
            val value = breakdown?.optJSONObject(index) ?: continue
            val rate = value.optString("taxRate", "0")
            // Keep exempt and other rates even when a standard rate has named components.
            if (normalizedRate(rate) !in componentRates) {
                add(NativeOrderTaxLine(null, rate, value.optString("taxableAmount", "0"), value.optString("taxAmount", "0")))
            }
        }
    }
}

internal fun JSONObject.nativeOrderDiscounts(): List<NativeOrderDiscount> = buildList {
    val source = optJSONArray("discountApplications") ?: return@buildList
    for (index in 0 until source.length()) {
        val value = source.optJSONObject(index) ?: continue
        add(NativeOrderDiscount(value.optString("title"), value.optionalNativeString("code"), value.optString("amount", "0")))
    }
}

internal fun JSONObject.nativeOrderTicketReferences(): List<NativeOrderTicketReference> = buildList {
    val source = optJSONArray("ticketReferences") ?: return@buildList
    for (index in 0 until source.length()) {
        val value = source.optJSONObject(index) ?: continue
        add(NativeOrderTicketReference(value.optString("ticketId"), value.optionalNativeString("ticketNo"), value.optString("ticketStatus"), value.optionalNativeString("expectedPickupAt"), value.optionalNativeString("assistantName"), value.optionalNativeString("remark"), value.optInt("itemCount"), value.optString("itemAmount", "0")))
    }
}

internal fun nativeOrderStatusLabel(status: String, copy: NativePosCopy): String = when (status) {
    "draft" -> copy.orderStatusDraft
    "received" -> copy.orderStatusReceived
    "paid" -> copy.orderStatusPaid
    "delivered" -> copy.orderStatusDelivered
    "cancelled" -> copy.orderStatusCancelled
    else -> copy.orderUnknownStatus
}

internal fun nativePaymentStatusLabel(status: String, copy: NativePosCopy): String = when (status) {
    "paid", "succeeded" -> copy.orderStatusPaid
    "unpaid" -> copy.paymentStatusUnpaid
    "partial" -> copy.paymentStatusPartial
    "pending" -> copy.paymentStatusPending
    "failed" -> copy.paymentStatusFailed
    "refunded" -> copy.paymentStatusRefunded
    else -> copy.orderUnknownStatus
}

internal fun nativeOrderMoney(value: String, currency: String): String = runCatching {
    "$currency ${BigDecimal(value).setScale(nativeCurrencyMinorUnits(currency), RoundingMode.UNNECESSARY).toPlainString()}"
}.getOrDefault("$currency $value")

internal fun nativeOrderRate(value: String): String = runCatching {
    "${BigDecimal(value).movePointRight(2).stripTrailingZeros().toPlainString()}%"
}.getOrDefault("—")

internal fun nativeOrderBalance(total: String, paid: String): String = runCatching {
    (BigDecimal(total) - BigDecimal(paid)).max(BigDecimal.ZERO).toPlainString()
}.getOrDefault("0")

internal fun nativeOrderTime(value: String?, timeZone: String, language: String): String = value?.let {
    runCatching { java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm", java.util.Locale.forLanguageTag(language)).withZone(java.time.ZoneId.of(timeZone)).format(java.time.Instant.parse(it)) }.getOrDefault(it)
} ?: "—"

@Composable
internal fun NativeOrderOverview(copy: NativePosCopy, order: NativeMoreOrderDetail, timeZone: String) {
    OrderSection(copy.orderOverview) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OrderStatusChip(nativeOrderStatusLabel(order.status, copy))
            OrderStatusChip(nativePaymentStatusLabel(order.paymentStatus, copy))
        }
        Text(copy.orderPrefix.format(order.id.takeLast(8).uppercase()), color = POS_INK, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Text(order.customerName ?: copy.walkInCustomer, color = POS_MUTED)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OrderMetric(copy.orderAmount, nativeOrderMoney(order.totalAmount, order.currency), Modifier.weight(1f))
            OrderMetric(copy.orderPaidAmount, nativeOrderMoney(order.paidAmount, order.currency), Modifier.weight(1f))
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OrderMetric(copy.orderOutstanding, nativeOrderMoney(nativeOrderBalance(order.totalAmount, order.paidAmount), order.currency), Modifier.weight(1f))
            OrderMetric(copy.orderLineCount, order.items.size.toString(), Modifier.weight(1f))
        }
    }
    OrderSection(copy.orderInformation) {
        OrderInfoRow(copy.customerLabel, order.customerName ?: copy.walkInCustomer)
        OrderInfoRow(copy.orderTypeLabel, if (order.orderType == "ticket") copy.orderTypeTicket else copy.orderTypeManual)
        order.createdAt?.let { OrderInfoRow(copy.orderCreatedAt, nativeOrderTime(it, timeZone, copy.localeCode())) }
        order.updatedAt?.let { OrderInfoRow(copy.orderUpdatedAt, nativeOrderTime(it, timeZone, copy.localeCode())) }
        order.dueAt?.let { OrderInfoRow(copy.orderDueAt, nativeOrderTime(it, timeZone, copy.localeCode())) }
        order.unpaidReason?.let { OrderInfoRow(copy.orderUnpaidReason, it) }
        order.notes?.let { OrderInfoRow(copy.orderNotes, it) }
    }
}

@Composable
internal fun NativeOrderItemCard(copy: NativePosCopy, item: NativeMoreOrderItem, currency: String) {
    OrderSection(item.name) {
        item.variantName?.let { Text(it, color = POS_MUTED, style = MaterialTheme.typography.bodySmall) }
        item.sku?.let { OrderInfoRow(copy.orderSku, it) }
        OrderInfoRow(copy.orderUnitPrice, "${nativeOrderMoney(item.unitAmount, currency)} × ${item.quantity}")
        item.weight?.let { OrderInfoRow(copy.orderWeight, it) }
        item.bagCount?.let { OrderInfoRow(copy.bagCount, it.toString()) }
        item.notes?.let { OrderInfoRow(copy.orderNotes, it) }
        OrderInfoRow(copy.total, nativeOrderMoney(item.lineAmount, currency), true)
    }
}

@Composable
internal fun NativeOrderFinancialSummary(copy: NativePosCopy, order: NativeMoreOrderDetail) {
    OrderSection(copy.orderTaxSummary) {
        OrderInfoRow(copy.subtotal, nativeOrderMoney(order.subtotalAmount, order.currency))
        OrderInfoRow(copy.discountAmountLabel, nativeOrderMoney(order.discountAmount, order.currency))
        order.discounts.forEach { discount ->
            OrderInfoRow(listOfNotNull(discount.title.takeIf { it.isNotBlank() } ?: copy.discountFallback, discount.code).joinToString(" · "), nativeOrderMoney(discount.amount, order.currency))
        }
        Text(if (order.pricesIncludeTax) copy.pricesIncludeTax else copy.pricesExcludeTax, color = POS_MUTED, style = MaterialTheme.typography.labelSmall)
        OrderInfoRow(copy.taxableAmountLabel, nativeOrderMoney(order.taxableAmount, order.currency))
        if (order.taxLines.isEmpty()) {
            OrderInfoRow("${order.taxLabel ?: copy.tax} ${nativeOrderRate(order.taxRate)}", nativeOrderMoney(order.taxAmount, order.currency))
        } else order.taxLines.forEach { line ->
            OrderInfoRow("${line.name ?: order.taxLabel ?: copy.tax} ${nativeOrderRate(line.rate)}", nativeOrderMoney(line.taxAmount, order.currency))
            OrderInfoRow(copy.taxableAmountLabel, nativeOrderMoney(line.taxableAmount, order.currency))
        }
        OrderInfoRow(copy.taxAmountLabel, nativeOrderMoney(order.taxAmount, order.currency))
        order.taxNumber?.let { OrderInfoRow(copy.settingsTaxNumber, it) }
        order.taxExemptionReason?.let { OrderInfoRow(copy.taxExemptReason, it) }
        OrderInfoRow(copy.rounding, nativeOrderMoney(order.roundingAmount, order.currency))
        HorizontalDivider(color = POS_BORDER)
        OrderInfoRow(copy.total, nativeOrderMoney(order.totalAmount, order.currency), true)
    }
}

@Composable
internal fun NativeOrderTicketReferences(copy: NativePosCopy, order: NativeMoreOrderDetail, timeZone: String) {
    if (order.tickets.isEmpty()) return
    OrderSection(copy.orderTicketReferences) {
        order.tickets.forEachIndexed { index, ticket ->
            if (index > 0) HorizontalDivider(color = POS_BORDER)
            Text(ticket.number ?: ticket.id.takeLast(8).uppercase(), color = POS_INK, fontWeight = FontWeight.SemiBold)
            Text(ticketStatusLabel(ticket.status, copy), color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
            ticket.pickupAt?.let { OrderInfoRow(copy.expectedPickup, nativeOrderTime(it, timeZone, copy.localeCode())) }
            ticket.assistant?.let { OrderInfoRow(copy.assistantLabel, it) }
            ticket.remark?.let { OrderInfoRow(copy.orderNotes, it) }
            OrderInfoRow(copy.itemsCountSuffix.format(ticket.count.toLong()), nativeOrderMoney(ticket.amount, order.currency))
        }
    }
}

@Composable
internal fun NativeOrderPaymentCard(copy: NativePosCopy, payment: NativeMorePayment, currency: String, timeZone: String) {
    val method = payment.provider?.let {
        when (it) { "wave" -> copy.wavePayment; "orange_money" -> copy.orangeMoneyPayment; else -> it }
    } ?: when (payment.method) { "cash" -> copy.cashPayment; "card" -> copy.cardPayment; else -> copy.mobilePayment }
    OrderSection(method) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            OrderStatusChip(nativePaymentStatusLabel(payment.status, copy))
            Text(nativeOrderMoney(payment.amount, currency), fontWeight = FontWeight.Bold, color = POS_INK)
        }
        Text(nativeOrderTime(payment.createdAt, timeZone, copy.localeCode()), color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
        payment.tenderedAmount?.let { OrderInfoRow(copy.tenderedForChange, nativeOrderMoney(it, currency)) }
        payment.changeAmount?.let { OrderInfoRow(copy.changeLabel, nativeOrderMoney(it, currency)) }
        payment.externalReference?.let { OrderInfoRow(copy.paymentReference, it) }
    }
}

@Composable
private fun OrderSection(title: String, content: @Composable ColumnScope.() -> Unit) {
    Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = POS_PANEL_BACKGROUND)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(title, color = POS_INK, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            content()
        }
    }
}

@Composable
private fun OrderStatusChip(text: String) {
    Text(text, Modifier.background(POS_PAGE_BACKGROUND, RoundedCornerShape(8.dp)).border(1.dp, POS_BORDER, RoundedCornerShape(8.dp)).padding(horizontal = 10.dp, vertical = 5.dp), color = POS_INK, style = MaterialTheme.typography.labelMedium)
}

@Composable
private fun OrderMetric(label: String, value: String, modifier: Modifier) {
    Column(modifier.background(POS_PAGE_BACKGROUND, RoundedCornerShape(12.dp)).padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(label, color = POS_MUTED, style = MaterialTheme.typography.labelSmall)
        Text(value, color = POS_INK, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun OrderInfoRow(label: String, value: String, prominent: Boolean = false) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.Top) {
        Text(label, Modifier.weight(1f), color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
        Text(value, Modifier.weight(1.4f), color = POS_INK, style = if (prominent) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyMedium, fontWeight = if (prominent) FontWeight.Bold else FontWeight.Medium)
    }
}
