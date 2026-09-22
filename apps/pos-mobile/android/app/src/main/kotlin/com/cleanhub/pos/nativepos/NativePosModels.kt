package com.cleanhub.pos.nativepos

import java.math.BigDecimal
import java.math.RoundingMode

/**
 * POS catalog inventory is an exact decimal string from the API (for example
 * "77.000"). The native retail cart currently accepts whole product units, so
 * reject fractional stock explicitly instead of silently treating a valid
 * decimal representation as zero.
 */
fun parseNativeWholeQuantity(value: String?): Long? {
    val normalized = value?.trim()?.takeIf { it.isNotEmpty() && it != "null" } ?: return null
    return runCatching {
        BigDecimal(normalized)
            .setScale(0, RoundingMode.UNNECESSARY)
            .longValueExact()
    }.getOrNull()
}

data class NativeTerminal(
    val tenantId: String,
    val branchId: String,
    val terminalId: String,
    val userId: String,
    val role: String,
    /** Tenant business timezone from AuthContext; used for POS-entered pickup times. */
    val timeZone: String,
    val credentialVersion: Int,
    val currency: String,
    val merchantName: String,
    val branchName: String,
    val lastSyncedAt: Long,
)

data class NativeProduct(
    val skuId: String,
    val productId: String,
    val priceId: String,
    val name: String,
    val sku: String,
    val amountMinor: Long,
    val currency: String,
    val trackInventory: Boolean,
    val availableQuantity: Long?,
    val allowNegativeStock: Boolean,
    val allowOfflineSale: Boolean,
    val offlineStockBuffer: Long,
    val reservedOfflineQuantity: Long,
)

data class NativeService(
    val id: String,
    val name: String,
    val businessLine: String,
    val pricingUnit: String,
    val amountMinor: Long,
    val currency: String,
    val defaultItemType: String,
    val applicableItemTypes: List<String>,
)

data class NativeCustomer(
    val id: String,
    val accountId: String,
    val fullName: String,
    val accountName: String,
    val phone: String?,
    val email: String?,
    val status: String,
)

data class NativeServiceTicket(
    val id: String,
    val ticketNo: String?,
    val customerId: String,
    val customerName: String,
    val ticketType: String,
    val ticketStatus: String,
    val priority: String,
    val itemCount: Long,
    val totalMinor: Long,
    val currency: String,
    val expectedPickupAt: String?,
    /** Kept locally so customer reception can list the newest handled work first. */
    val createdAt: String,
    val updatedAt: String,
    val version: Long,
)

/**
 * A cached service-ticket item. These rows are fetched when the operator opens
 * a ticket, so the ticket remains readable after a cold offline restart.
 */
data class NativeTicketItem(
    val id: String,
    val ticketId: String,
    val serviceId: String?,
    val itemName: String,
    val itemType: String?,
    val itemCategory: String?,
    val itemColor: String?,
    val itemBrand: String?,
    val itemMaterial: String?,
    val itemStatus: String,
    val quantity: Long,
    val pricingUnit: String,
    val standardUnitAmountMinor: Long,
    val chargedUnitAmountMinor: Long,
    val lineAmountMinor: Long,
    val currency: String,
    val weight: String?,
    val bagCount: Long?,
    val labelCode: String?,
    val defectNotes: String?,
    val specialRequest: String?,
    val remark: String?,
)

/** Mirrors the regular POS Web item-create request; the server remains the pricing authority. */
data class NativeTicketItemDraft(
    val service: NativeService,
    val itemType: String,
    val quantity: Long,
    val weight: String?,
    val bagCount: Long?,
    val itemCategory: String?,
    val itemColor: String?,
    val itemBrand: String?,
    val itemMaterial: String?,
    val defectNotes: String?,
    val specialRequest: String?,
    val remark: String?,
)

/** Editable item fields available to every operator; sensitive price changes stay server-authorized. */
data class NativeTicketItemUpdate(
    val itemType: String,
    val service: NativeService,
    val quantity: Long,
    val weight: String?,
    val bagCount: Long?,
    val itemCategory: String?,
    val itemColor: String?,
    val itemBrand: String?,
    val itemMaterial: String?,
    val defectNotes: String?,
    val specialRequest: String?,
    val remark: String?,
)

data class NativeTicketDetail(
    val ticket: NativeServiceTicket,
    val items: List<NativeTicketItem>,
    /** IDs already attached to a non-cancelled server order. */
    val billedTicketItemIds: Set<String> = emptySet(),
    /** IDs in a durable local cash command that has not yet replayed. */
    val pendingTicketItemIds: Set<String> = emptySet(),
    /** IDs already held by this cashier's active POS cart. */
    val cartTicketItemIds: Set<String> = emptySet(),
    val hasPendingCashCheckout: Boolean = false,
)

data class NativeCashState(
    val shiftId: String?,
    val registerSessionId: String?,
    val cashSessionId: String?,
    val cashHandlingMode: String,
    val updatedAt: Long,
)

/** A cash sale is only safe offline when its complete accountability context was cached online. */
fun NativeCashState.isOfflineCashReady(): Boolean =
    shiftId != null &&
        registerSessionId != null &&
        when (cashHandlingMode) {
            "untracked" -> true
            "shared_drawer", "cash_in_hand" -> cashSessionId != null
            else -> false
        }

fun NativeCashState.needsCashSession(): Boolean =
    cashHandlingMode == "shared_drawer" || cashHandlingMode == "cash_in_hand"

data class NativeCartLine(
    val skuId: String,
    val name: String,
    val amountMinor: Long,
    val quantity: Long,
)

/** Customer identity is mandatory as soon as a ticket item enters a POS cart. */
data class NativeCartCustomer(
    val id: String,
    val name: String,
)

/**
 * Mirrors POS Web's ticket-item cart line. The original ticket item id stays
 * intact so the API can atomically reject a duplicate or already billed item.
 */
data class NativeTicketCartLine(
    val ticketId: String,
    val ticketItemId: String,
    val ticketCode: String,
    val serviceId: String?,
    val name: String,
    val pricingUnit: String,
    val quantity: Long,
    val weight: String?,
    val bagCount: Long?,
    val unitAmountMinor: Long,
    val lineAmountMinor: Long,
    val currency: String,
    val customerId: String,
    val customerName: String,
)

/**
 * Native equivalent of the POS Web v2 cart snapshot. `checkoutId` remains
 * stable while the basket is edited, which makes offline cash replay safe.
 */
data class NativePosCart(
    val checkoutId: String,
    val currency: String,
    val customer: NativeCartCustomer?,
    val products: List<NativeCartLine>,
    val ticketItems: List<NativeTicketCartLine>,
) {
    val isEmpty: Boolean get() = products.isEmpty() && ticketItems.isEmpty()
    val itemCount: Long get() = products.sumOf { it.quantity } + ticketItems.sumOf { it.quantity }
    val totalMinor: Long get() =
        products.sumOf { it.amountMinor * it.quantity } + ticketItems.sumOf { it.lineAmountMinor }

    companion object {
        fun empty(currency: String): NativePosCart = NativePosCart(
            checkoutId = NativeUlid.create(),
            currency = currency,
            customer = null,
            products = emptyList(),
            ticketItems = emptyList(),
        )
    }
}

data class NativePosSnapshot(
    val terminal: NativeTerminal?,
    val cashState: NativeCashState?,
    val products: List<NativeProduct>,
    val services: List<NativeService>,
    val customers: List<NativeCustomer>,
    val tickets: List<NativeServiceTicket>,
    val pendingSales: Int,
    val failedSales: Int,
)

data class NativeCheckoutResult(
    val operationId: String,
    val orderId: String,
    val printJobId: String? = null,
)

/** Receipt data written together with the cash command before any printer pulse. */
data class NativeReceiptPrintDraft(
    val content: String,
    val copies: Int,
)

data class NativeReceiptPrintSettings(
    val autoPrintReceipt: Boolean,
    val printCopies: Int,
)

/** Financial and receipt rules cached from the same terminal settings used by POS Web. */
data class NativeCheckoutSettings(
    val roundingRule: String = "none",
    val cashRoundingStep: Int = 1,
    val taxEnabled: Boolean = false,
    val defaultTaxRate: String = "0.0000",
    val pricesIncludeTax: Boolean = true,
    val taxRegistrationNumber: String? = null,
    val emailReceiptEnabled: Boolean = false,
    val autoPrintReceipt: Boolean = true,
)

data class NativeCartPricingDiscount(
    val title: String,
    val amountMinor: Long,
)

/** A server preview is the authority while online; the same fields have a local fallback for offline cash. */
data class NativeCartPricing(
    val subtotalMinor: Long,
    val discounts: List<NativeCartPricingDiscount>,
    val discountMinor: Long,
    val taxableMinor: Long,
    val taxMinor: Long,
    val taxRate: String,
    val pricesIncludeTax: Boolean,
    val roundingAdjustmentMinor: Long,
    val totalMinor: Long,
)

enum class NativeReceiptDelivery(val wireValue: String) {
    Print("print"),
    Email("email"),
    Sms("sms"),
    None("none"),
}

/** The final cashier choices retained in the durable checkout command. */
data class NativeCashCheckoutRequest(
    val expectedTotalMinor: Long,
    val tenderedMinor: Long,
    val discountCode: String? = null,
    val discountReason: String? = null,
    val taxExemptionReason: String? = null,
    val cashRoundingStep: Int? = null,
    val receiptDelivery: NativeReceiptDelivery = NativeReceiptDelivery.None,
    val receiptDestination: String? = null,
)

data class NativePendingReceiptPrint(
    val jobId: String,
    val entityId: String,
    val content: String,
    val copies: Int,
    val status: String,
    val attempt: Int,
    val lastError: String?,
)

data class NativeReceiptPrintQueueState(
    val pending: Int,
    val failed: Int,
)

/** Immutable write-ahead checkout command. It is created before cash is accepted. */
data class NativePendingCheckout(
    val operationId: String,
    val sequence: Long,
    val orderId: String,
    val idempotencyKey: String,
    val payloadJson: String,
    /** Replays already made for this command; see NATIVE_REPLAY_MAX_ATTEMPTS. */
    val attempt: Int = 0,
)

class NativePosValidationException(message: String) : IllegalStateException(message)
