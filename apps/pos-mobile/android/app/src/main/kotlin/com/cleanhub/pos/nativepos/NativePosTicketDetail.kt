package com.cleanhub.pos.nativepos

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import org.json.JSONObject

@Composable
internal fun NativeBusyLabel(busy: Boolean, loading: String, idle: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(9.dp),
    ) {
        if (busy)
            CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp, color = POS_INK)
        Text(if (busy) loading else idle, color = if (busy) POS_INK else LocalContentColor.current)
    }
}

@Composable
internal fun NativeDetailSection(title: String, content: @Composable ColumnScope.() -> Unit) {
    Card(
        Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = POS_PANEL_BACKGROUND),
    ) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(
                title,
                color = POS_INK,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
            content()
        }
    }
}

@Composable
internal fun NativeDetailValue(label: String, value: String?) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        Text(
            label,
            Modifier.weight(0.42f),
            color = POS_MUTED,
            style = MaterialTheme.typography.bodySmall,
        )
        Text(
            value?.takeIf { it.isNotBlank() } ?: "—",
            Modifier.weight(0.58f),
            color = POS_INK,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

@Composable
internal fun NativeDetailChoices(
    values: List<String>,
    selected: String,
    enabled: Boolean,
    label: (String) -> String,
    onSelect: (String) -> Unit,
) {
    Row(
        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        values.forEach { value ->
            FilterChip(
                selected = selected == value,
                onClick = { onSelect(value) },
                enabled = enabled,
                label = { Text(label(value)) },
            )
        }
    }
}

@Composable
internal fun NativeTicketDetailView(
    copy: NativePosCopy,
    detail: NativeTicketDetail,
    services: List<NativeService>,
    internetAvailable: Boolean,
    busy: Boolean,
    message: String?,
    onBack: () -> Unit,
    onChangeTicketStatus: (String, String?) -> Unit,
    onAddService: (NativeTicketItemDraft) -> Unit,
    onUpdateItem: (NativeTicketItem, NativeTicketItemUpdate) -> Unit,
    onDeleteItem: (NativeTicketItem, String) -> Unit,
    canManageSensitiveOperations: Boolean,
    onChangeItemStatus: (NativeTicketItem, String) -> Unit,
    onAddToCart: (List<NativeTicketItem>) -> Unit,
    onUpdateInformation: (JSONObject) -> Unit,
    onRetryIntake: () -> Unit,
    onViewOrder: (String) -> Unit,
    timeZone: String,
    onDiscardIntake: (String) -> Unit = {},
) {
    val ticket = detail.ticket
    val editable = ticket.ticketStatus !in setOf("cancelled", "picked_up")
    val unconfirmedTicket = ticket.id in detail.unsentIntakeIds
    var adding by remember(ticket.id) { mutableStateOf(false) }
    var editingItem by remember(ticket.id) { mutableStateOf<NativeTicketItem?>(null) }
    var editingInfo by remember(ticket.id) { mutableStateOf(false) }
    var statusOpen by remember(ticket.id) { mutableStateOf(false) }
    var target by remember(ticket.id) { mutableStateOf("") }
    var reason by remember(ticket.id) { mutableStateOf("") }
    var discardId by remember(ticket.id) { mutableStateOf<String?>(null) }
    var deleting by remember(ticket.id) { mutableStateOf<NativeTicketItem?>(null) }
    var deleteReason by remember(ticket.id) { mutableStateOf("") }
    val available =
        detail.items.filter {
            !unconfirmedTicket &&
                it.id !in detail.unsentIntakeIds &&
                it.id !in detail.billedTicketItemIds &&
                it.id !in detail.pendingTicketItemIds &&
                it.id !in detail.cartTicketItemIds
        }
    var chosen by
        remember(ticket.id, available.map { it.id }) {
            mutableStateOf<Set<String>>(available.mapTo(linkedSetOf()) { it.id })
        }
    // Close only after persisted rows / canonical detail change, never merely on tapping Save.
    LaunchedEffect(detail.items) {
        adding = false
        editingItem = null
    }
    LaunchedEffect(ticket.version) {
        editingInfo = false
        statusOpen = false
        deleting = null
    }
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        TextButton(onClick = onBack, enabled = !busy) { Text(copy.backToTickets) }
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Text(
                    ticket.ticketNo ?: copy.serviceTicket,
                    color = POS_INK,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    ticket.customerName,
                    color = POS_MUTED,
                    style = MaterialTheme.typography.bodyLarge,
                )
            }
            SuggestionChip(
                onClick = {},
                label = { Text(ticketStatusLabel(ticket.ticketStatus, copy)) },
            )
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Column(Modifier.weight(1f)) {
                Text(copy.serviceItems, color = POS_MUTED)
                Text(
                    ticket.itemCount.toString(),
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                )
            }
            Column(Modifier.weight(2f)) {
                Text(
                    if (detail.unsentIntakeIds.isEmpty()) copy.orderAmount
                    else copy.detailEstimatedAmount,
                    color = POS_MUTED,
                )
                Text(
                    nativeOrderMoney(
                        BigDecimal(ticket.totalMinor).movePointLeft(2).toPlainString(),
                        ticket.currency,
                    ),
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
        if (detail.unsentIntakeIds.isNotEmpty())
            NativeDetailSection(
                if (detail.intakeFailed) copy.intakeFailed else copy.intakePending
            ) {
                Text(
                    copy.intakeSyncBeforeCheckout,
                    color = POS_MUTED,
                    style = MaterialTheme.typography.bodyMedium,
                )
                detail.intakeError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                if (ticket.id in detail.discardableIntakeIds)
                    TextButton(onClick = { discardId = ticket.id }, enabled = !busy) {
                        Text(copy.intakeRemoveRejected)
                    }
                if (detail.needsOriginalOperator)
                    Text(copy.intakeOriginalOperator, color = POS_MUTED)
                OutlinedButton(
                    onClick = onRetryIntake,
                    enabled = internetAvailable && !busy && !detail.needsOriginalOperator,
                ) {
                    Text(copy.detailRetry)
                }
            }
        if (!internetAvailable)
            Text(
                copy.intakeOfflineHint,
                color = POS_MUTED,
                style = MaterialTheme.typography.bodySmall,
            )
        NativeDetailSection(copy.detailBasicInformation) {
            NativeDetailValue(copy.ticketCustomer, ticket.customerName)
            NativeDetailValue(
                copy.detailPhone,
                detail.information?.nativeText("customerProfilePhone")
                    ?: detail.information?.nativeText("customerAccountPhone"),
            )
            NativeDetailValue(
                copy.ticketType,
                if (ticket.ticketType == "car_wash") copy.typeCarWash else copy.typeLaundry,
            )
            NativeDetailValue(copy.priorityTitle, ticket.priorityLabel(copy))
            NativeDetailValue(copy.assistantLabel, detail.information?.nativeText("assistantName"))
            NativeDetailValue(
                copy.detailSource,
                nativeTicketSourceLabel(
                    detail.information?.optString("sourceChannel").orEmpty(),
                    copy,
                ),
            )
            NativeDetailValue(
                copy.orderCreatedAt,
                nativeOrderTime(ticket.createdAt, timeZone, copy.localeCode()),
            )
            NativeDetailValue(
                copy.orderUpdatedAt,
                nativeOrderTime(ticket.updatedAt, timeZone, copy.localeCode()),
            )
            NativeDetailValue(
                copy.ticketsPickupLabel,
                nativeOrderTime(ticket.expectedPickupAt, timeZone, copy.localeCode()),
            )
            detail.information?.nativeText("completedAt")?.let {
                NativeDetailValue(
                    copy.detailCompletedAt,
                    nativeOrderTime(it, timeZone, copy.localeCode()),
                )
            }
            detail.information?.nativeText("cancelledAt")?.let {
                NativeDetailValue(
                    copy.detailCancelledAt,
                    nativeOrderTime(it, timeZone, copy.localeCode()),
                )
            }
            NativeDetailValue(copy.orderNotes, detail.information?.nativeText("remark"))
            if (detail.information == null) Text(copy.detailNotCached, color = POS_MUTED)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(
                    onClick = { editingInfo = true },
                    enabled =
                        editable &&
                            internetAvailable &&
                            !busy &&
                            !unconfirmedTicket &&
                            detail.information != null,
                ) {
                    Text(copy.detailEditInformation)
                }
                if (TICKET_STATUS_TRANSITIONS[ticket.ticketStatus].orEmpty().isNotEmpty())
                    OutlinedButton(
                        onClick = { statusOpen = true },
                        enabled = internetAvailable && !busy && detail.unsentIntakeIds.isEmpty(),
                    ) {
                        Text(copy.ticketFlow)
                    }
            }
        }
        NativeDetailSection(copy.serviceItems) {
            if (editable)
                Button(
                    onClick = { adding = true },
                    enabled = !busy && services.any { it.businessLine == ticket.ticketType },
                ) {
                    Text(copy.appendServiceItem)
                }
            if (detail.items.isEmpty())
                Text(
                    if (ticket.itemCount > 0) copy.detailNotCached else copy.noServiceItems,
                    color = POS_MUTED,
                )
            detail.items.forEach { item ->
                Column(
                    Modifier.fillMaxWidth()
                        .background(POS_PAGE_BACKGROUND, RoundedCornerShape(14.dp))
                        .padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Text(
                            item.itemName,
                            Modifier.weight(1f),
                            color = POS_INK,
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(ticketItemStatusLabel(item.itemStatus, copy), color = POS_ACCENT)
                    }
                    val pending = unconfirmedTicket || item.id in detail.unsentIntakeIds
                    if (item.id in detail.discardableIntakeIds)
                        TextButton(onClick = { discardId = item.id }, enabled = !busy) {
                            Text(copy.intakeRemoveRejected)
                        }
                    Text(
                        when {
                            pending -> copy.intakePending
                            item.id in detail.billedTicketItemIds -> copy.alreadyBilled
                            item.id in detail.pendingTicketItemIds -> copy.pendingSyncNoBill
                            item.id in detail.cartTicketItemIds -> copy.inCart
                            else -> ticketItemTypeLabel(item.itemType.orEmpty(), copy)
                        },
                        color = POS_ACCENT,
                        style = MaterialTheme.typography.labelMedium,
                    )
                    listOf(
                            copy.detailItemCategory to item.itemCategory,
                            copy.detailItemColor to item.itemColor,
                            copy.detailItemBrand to item.itemBrand,
                            copy.detailItemMaterial to item.itemMaterial,
                        )
                        .filter { !it.second.isNullOrBlank() }
                        .forEach { NativeDetailValue(it.first, it.second) }
                    NativeDetailValue(
                        if (item.pricingUnit == "per_kg") copy.weightKg else copy.quantityPieces,
                        if (item.pricingUnit == "per_kg") item.weight else item.quantity.toString(),
                    )
                    if (item.pricingUnit == "per_kg")
                        NativeDetailValue(copy.bagCount, item.bagCount?.toString())
                    NativeDetailValue(
                        copy.detailStandardPrice,
                        nativeMinorMoney(item.standardUnitAmountMinor, item.currency),
                    )
                    NativeDetailValue(
                        copy.detailChargedPrice,
                        nativeMinorMoney(item.chargedUnitAmountMinor, item.currency),
                    )
                    NativeDetailValue(
                        if (pending) copy.detailEstimatedAmount else copy.orderAmount,
                        nativeMinorMoney(item.lineAmountMinor, item.currency),
                    )
                    NativeDetailValue(copy.detailLabelCode, item.labelCode)
                    item.defectNotes?.let { NativeDetailValue(copy.defectsOptional, it) }
                    item.specialRequest?.let { NativeDetailValue(copy.specialRequestOptional, it) }
                    item.remark?.let { NativeDetailValue(copy.orderNotes, it) }
                    val canMutate =
                        editable &&
                            !pending &&
                            item.id !in detail.billedTicketItemIds &&
                            item.id !in detail.pendingTicketItemIds &&
                            item.id !in detail.cartTicketItemIds
                    if (editable)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            TextButton(
                                onClick = { editingItem = item },
                                enabled = canMutate && internetAvailable && !busy,
                            ) {
                                Text(copy.editItem)
                            }
                            if (canManageSensitiveOperations)
                                TextButton(
                                    onClick = {
                                        deleting = item
                                        deleteReason = ""
                                    },
                                    enabled = canMutate && internetAvailable && !busy,
                                ) {
                                    Text(copy.deleteItem)
                                }
                        }
                    if (
                        !pending &&
                            ticket.ticketStatus in
                                setOf("pending", "in_progress", "ready_to_pick", "exception")
                    )
                        NativeDetailChoices(
                            TICKET_ITEM_STATUS_TRANSITIONS[item.itemStatus].orEmpty(),
                            "",
                            internetAvailable && !busy,
                            { ticketItemStatusLabel(it, copy) },
                            { onChangeItemStatus(item, it) },
                        )
                }
            }
        }
        NativeDetailSection(copy.addToCartTitle) {
            Text(copy.addToCartHint, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
            available.forEach { item ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(
                        checked = item.id in chosen,
                        onCheckedChange = {
                            chosen = if (it) chosen + item.id else chosen - item.id
                        },
                        enabled = !busy && editable,
                    )
                    Text(item.itemName, Modifier.weight(1f))
                    Text(nativeMinorMoney(item.lineAmountMinor, item.currency))
                }
            }
            if (available.isEmpty()) Text(copy.nothingToCharge, color = POS_MUTED)
            val selected = available.filter { it.id in chosen }
            Button(
                onClick = { onAddToCart(selected) },
                enabled = editable && !busy && selected.isNotEmpty(),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    "${copy.addToCartTitle} · ${nativeMinorMoney(selected.sumOf { it.lineAmountMinor },ticket.currency)}"
                )
            }
        }
        NativeDetailSection(copy.detailRelatedOrders) {
            val orders = detail.relatedOrders
            if (orders == null) Text(copy.detailNotCached, color = POS_MUTED)
            else if (orders.length() == 0) Text(copy.detailNoRelatedOrders, color = POS_MUTED)
            else
                for (i in 0 until orders.length()) orders.optJSONObject(i)?.let { order ->
                    NativeIntakeOrderRow(copy, order, timeZone, onViewOrder)
                }
        }
        message?.let { Text(it, color = POS_MUTED, style = MaterialTheme.typography.bodySmall) }
    }
    discardId?.let { id ->
        AlertDialog(
            onDismissRequest = { if (!busy) discardId = null },
            title = { Text(copy.intakeRemoveRejected) },
            text = { Text(copy.intakeRemoveRejectedHint) },
            confirmButton = {
                TextButton(
                    onClick = {
                        onDiscardIntake(id)
                        discardId = null
                    },
                    enabled = !busy,
                ) {
                    Text(copy.intakeRemoveRejected)
                }
            },
            dismissButton = {
                TextButton(onClick = { discardId = null }, enabled = !busy) { Text(copy.back) }
            },
        )
    }
    if (adding || editingItem != null)
        NativeTicketItemForm(
            copy,
            ticket,
            services,
            editingItem,
            busy,
            canManageSensitiveOperations,
            message,
            {
                if (!busy) {
                    adding = false
                    editingItem = null
                }
            },
        ) { draft ->
            val item = editingItem
            if (item == null) onAddService(draft)
            else
                onUpdateItem(
                    item,
                    NativeTicketItemUpdate(
                        draft.itemType,
                        draft.service,
                        draft.quantity,
                        draft.weight,
                        draft.bagCount,
                        draft.itemCategory,
                        draft.itemColor,
                        draft.itemBrand,
                        draft.itemMaterial,
                        draft.defectNotes,
                        draft.specialRequest,
                        draft.remark,
                        draft.chargedUnitAmountMinor,
                        draft.overrideReason,
                    ),
                )
        }
    if (editingInfo)
        NativeTicketInformationDialog(
            copy,
            detail,
            busy,
            message,
            timeZone,
            { editingInfo = false },
            onUpdateInformation,
        )
    if (statusOpen)
        AlertDialog(
            onDismissRequest = { if (!busy) statusOpen = false },
            title = { Text(copy.ticketFlow) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    NativeDetailChoices(
                        TICKET_STATUS_TRANSITIONS[ticket.ticketStatus].orEmpty().toList(),
                        target,
                        !busy,
                        { ticketStatusLabel(it, copy) },
                        { target = it },
                    )
                    if (target == "cancelled")
                        NativePosInput(
                            value = reason,
                            onValueChange = { reason = it.take(500) },
                            label = { Text(copy.cancelReasonRequired) },
                            modifier = Modifier.fillMaxWidth(),
                        )
                    message?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        onChangeTicketStatus(target, reason.takeIf { target == "cancelled" })
                    },
                    enabled =
                        !busy &&
                            target.isNotEmpty() &&
                            (target != "cancelled" || reason.isNotBlank()),
                ) {
                    NativeBusyLabel(busy, copy.saving, copy.saveItem)
                }
            },
            dismissButton = {
                TextButton(onClick = { statusOpen = false }, enabled = !busy) { Text(copy.back) }
            },
        )
    deleting?.let { item ->
        AlertDialog(
            onDismissRequest = { if (!busy) deleting = null },
            title = { Text(copy.deleteItem) },
            text = {
                Column {
                    Text(item.itemName)
                    NativePosInput(
                        value = deleteReason,
                        onValueChange = { deleteReason = it.take(500) },
                        label = { Text(copy.deleteReasonRequired) },
                    )
                    message?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                }
            },
            confirmButton = {
                TextButton(
                    onClick = { onDeleteItem(item, deleteReason) },
                    enabled = !busy && deleteReason.isNotBlank(),
                ) {
                    NativeBusyLabel(busy, copy.saving, copy.confirmDeleteItem)
                }
            },
            dismissButton = {
                TextButton(onClick = { deleting = null }, enabled = !busy) { Text(copy.back) }
            },
        )
    }
}

internal fun nativeMinorMoney(amount: Long, currency: String) =
    nativeOrderMoney(BigDecimal(amount).movePointLeft(2).toPlainString(), currency)

internal fun nativeTicketSourceLabel(source: String, copy: NativePosCopy) =
    when (source) {
        "pos" -> copy.detailSourcePos
        "app" -> copy.detailSourceApp
        "phone" -> copy.detailSourcePhone
        "whatsapp" -> copy.detailSourceWhatsapp
        else -> "—"
    }

@Composable
internal fun NativeIntakeOrderRow(
    copy: NativePosCopy,
    order: JSONObject,
    timeZone: String,
    onOpen: (String) -> Unit,
) {
    OutlinedCard(
        onClick = { onOpen(order.getString("id")) },
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(
                order.nativeText("orderNo") ?: order.getString("id").takeLast(8),
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                "${nativeOrderStatusLabel(order.optString("status"),copy)} · ${nativePaymentStatusLabel(order.optString("paymentStatus"),copy)}",
                color = POS_MUTED,
            )
            Text(
                nativeOrderMoney(order.optString("totalAmount", "0"), order.optString("currency")),
                fontWeight = FontWeight.Bold,
            )
            Text(
                nativeOrderTime(order.nativeText("createdAt"), timeZone, copy.localeCode()),
                color = POS_MUTED,
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

@Composable
private fun NativeTicketInformationDialog(
    copy: NativePosCopy,
    detail: NativeTicketDetail,
    busy: Boolean,
    message: String?,
    timeZone: String,
    onDismiss: () -> Unit,
    onSave: (JSONObject) -> Unit,
) {
    var type by remember { mutableStateOf(detail.ticket.ticketType) }
    var priority by remember { mutableStateOf(detail.ticket.priority) }
    var source by remember {
        mutableStateOf(detail.information?.optString("sourceChannel", "pos") ?: "pos")
    }
    var remark by remember { mutableStateOf(detail.information?.nativeText("remark").orEmpty()) }
    var pickup by remember {
        mutableStateOf(
            runCatching {
                    Instant.parse(detail.ticket.expectedPickupAt)
                        .atZone(ZoneId.of(timeZone))
                        .format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"))
                }
                .getOrDefault("")
        )
    }
    var invalid by remember { mutableStateOf(false) }
    Dialog(onDismissRequest = { if (!busy) onDismiss() }) {
        Surface(shape = RoundedCornerShape(20.dp)) {
            Column(
                Modifier.verticalScroll(rememberScrollState()).padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(
                    copy.detailEditInformation,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                )
                Text(copy.ticketType)
                NativeDetailChoices(
                    listOf("laundry", "car_wash"),
                    type,
                    !busy && detail.items.isEmpty(),
                    { if (it == "car_wash") copy.typeCarWash else copy.typeLaundry },
                    { type = it },
                )
                Text(copy.priorityTitle)
                NativeDetailChoices(
                    listOf("normal", "urgent", "critical"),
                    priority,
                    !busy,
                    {
                        when (it) {
                            "critical" -> copy.priorityCritical
                            "urgent" -> copy.priorityUrgent
                            else -> copy.priorityNormal
                        }
                    },
                    { priority = it },
                )
                Text(copy.detailSource)
                NativeDetailChoices(
                    listOf("pos", "app", "phone", "whatsapp"),
                    source,
                    !busy,
                    { nativeTicketSourceLabel(it, copy) },
                    { source = it },
                )
                NativePosInput(
                    value = pickup,
                    onValueChange = {
                        pickup = it
                        invalid = false
                    },
                    label = { Text(copy.expectedPickupField) },
                    placeholder = { Text(copy.detailPickupHint) },
                    enabled = !busy,
                    modifier = Modifier.fillMaxWidth(),
                )
                NativePosInput(
                    value = remark,
                    onValueChange = { remark = it.take(2000) },
                    label = { Text(copy.remarkOptional) },
                    enabled = !busy,
                    modifier = Modifier.fillMaxWidth(),
                )
                if (invalid) Text(copy.pickupTimeInvalid, color = MaterialTheme.colorScheme.error)
                message?.let { Text(it, color = POS_MUTED) }
                Button(
                    onClick = {
                        val instant =
                            pickup
                                .trim()
                                .takeIf { it.isNotEmpty() }
                                ?.let { localTicketDateTimeToIso(it, timeZone) }
                        if (pickup.isNotBlank() && instant == null) invalid = true
                        else
                            onSave(
                                JSONObject()
                                    .put("ticketType", type)
                                    .put("priority", priority)
                                    .put("sourceChannel", source)
                                    .put(
                                        "remark",
                                        remark.trim().ifEmpty { null } ?: JSONObject.NULL,
                                    )
                                    .put("expectedPickupAt", instant ?: JSONObject.NULL)
                            )
                    },
                    enabled = !busy,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    NativeBusyLabel(busy, copy.saving, copy.saveItem)
                }
                TextButton(onClick = onDismiss, enabled = !busy) { Text(copy.back) }
            }
        }
    }
}

@Composable
internal fun NativeTicketItemForm(
    copy: NativePosCopy,
    ticket: NativeServiceTicket,
    services: List<NativeService>,
    item: NativeTicketItem?,
    busy: Boolean,
    canOverride: Boolean,
    message: String?,
    onDismiss: () -> Unit,
    onSave: (NativeTicketItemDraft) -> Unit,
) {
    var type by remember { mutableStateOf(item?.itemType.orEmpty()) }
    var serviceId by remember { mutableStateOf(item?.serviceId.orEmpty()) }
    var query by remember { mutableStateOf("") }
    var quantity by remember { mutableStateOf((item?.quantity ?: 1).toString()) }
    var weight by remember { mutableStateOf(item?.weight.orEmpty()) }
    var bags by remember { mutableStateOf((item?.bagCount ?: 1).toString()) }
    var category by remember { mutableStateOf(item?.itemCategory.orEmpty()) }
    var colour by remember { mutableStateOf(item?.itemColor.orEmpty()) }
    var brand by remember { mutableStateOf(item?.itemBrand.orEmpty()) }
    var material by remember { mutableStateOf(item?.itemMaterial.orEmpty()) }
    var defects by remember { mutableStateOf(item?.defectNotes.orEmpty()) }
    var request by remember { mutableStateOf(item?.specialRequest.orEmpty()) }
    var remark by remember { mutableStateOf(item?.remark.orEmpty()) }
    var overridePrice by remember { mutableStateOf(false) }
    var price by remember {
        mutableStateOf(
            item
                ?.chargedUnitAmountMinor
                ?.let { BigDecimal(it).movePointLeft(2).toPlainString() }
                .orEmpty()
        )
    }
    var reason by remember { mutableStateOf("") }
    val ticketServices =
        services.filter { it.businessLine == ticket.ticketType && it.currency == ticket.currency }
    val service =
        ticketServices.firstOrNull { it.id == serviceId && type in it.applicableItemTypes }
    val standard =
        if (item?.serviceId == service?.id) item?.standardUnitAmountMinor else service?.amountMinor
    val retainedUnit =
        if (item?.serviceId == service?.id) item?.chargedUnitAmountMinor else service?.amountMinor
    val unit =
        if (overridePrice)
            runCatching {
                    BigDecimal(price)
                        .movePointRight(2)
                        .setScale(0, RoundingMode.UNNECESSARY)
                        .longValueExact()
                        .takeIf { it >= 0 }
                }
                .getOrNull()
        else retainedUnit
    val validMeasurement =
        service != null && nativeValidIntakeMeasurement(service.pricingUnit, quantity, weight, bags)
    val estimate =
        runCatching {
                if (service?.pricingUnit == "per_kg")
                    BigDecimal(unit!!)
                        .multiply(BigDecimal(weight))
                        .setScale(0, RoundingMode.HALF_UP)
                        .longValueExact()
                else Math.multiplyExact(unit!!, quantity.toLong())
            }
            .getOrNull()
    val dialogHeight = LocalConfiguration.current.screenHeightDp.dp * 0.86f
    Dialog(
        onDismissRequest = { if (!busy) onDismiss() },
        properties =
            DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = true),
    ) {
        BoxWithConstraints(
            Modifier.fillMaxSize().systemBarsPadding().imePadding().padding(16.dp),
            contentAlignment = Alignment.Center,
        ) {
            Surface(
                Modifier.widthIn(max = 720.dp)
                    .fillMaxWidth()
                    .heightIn(max = minOf(maxHeight, dialogHeight))
                    .fillMaxHeight(),
                shape = RoundedCornerShape(22.dp),
                color = POS_PAGE_BACKGROUND,
            ) {
                Column(Modifier.fillMaxSize().padding(bottom = 32.dp)) {
                    Column(
                        Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(22.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Text(
                                if (item == null) copy.appendServiceItem else copy.editServiceItem,
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold,
                            )
                            TextButton(onClick = onDismiss, enabled = !busy) { Text(copy.back) }
                        }
                        Text(copy.pickTypeThenService, color = POS_MUTED)
                        NativeDetailChoices(
                            ticketServices.flatMap { it.applicableItemTypes }.distinct(),
                            type,
                            !busy,
                            { ticketItemTypeLabel(it, copy) },
                            {
                                type = it
                                serviceId = ""
                                query = ""
                                overridePrice = false
                            },
                        )
                        if (type.isNotBlank()) {
                            NativePosInput(
                                value = query,
                                onValueChange = { query = it },
                                label = { Text(copy.detailServiceSearch) },
                                singleLine = true,
                                enabled = !busy,
                                modifier = Modifier.fillMaxWidth(),
                            )
                            ticketServices
                                .filter {
                                    type in it.applicableItemTypes && it.name.contains(query, true)
                                }
                                .forEach { candidate ->
                                    FilterChip(
                                        selected = candidate.id == serviceId,
                                        onClick = {
                                            serviceId = candidate.id
                                            overridePrice = false
                                            price =
                                                BigDecimal(candidate.amountMinor)
                                                    .movePointLeft(2)
                                                    .toPlainString()
                                        },
                                        enabled = !busy,
                                        label = {
                                            Text(
                                                "${candidate.name} · ${nativeMinorMoney(candidate.amountMinor,candidate.currency)}"
                                            )
                                        },
                                    )
                                }
                        }
                        service?.let {
                            if (it.pricingUnit == "per_kg") {
                                NativePosInput(
                                    value = weight,
                                    onValueChange = { weight = it },
                                    label = { Text(copy.weightKg) },
                                    enabled = !busy,
                                    modifier = Modifier.fillMaxWidth(),
                                    singleLine = true,
                                )
                                NativePosInput(
                                    value = bags,
                                    onValueChange = { bags = it },
                                    label = { Text(copy.bagCount) },
                                    enabled = !busy,
                                    modifier = Modifier.fillMaxWidth(),
                                    singleLine = true,
                                )
                            } else
                                NativePosInput(
                                    value = quantity,
                                    onValueChange = { quantity = it },
                                    label = { Text(copy.quantityPieces) },
                                    enabled = !busy,
                                    modifier = Modifier.fillMaxWidth(),
                                    singleLine = true,
                                )
                            if (!validMeasurement)
                                Text(
                                    copy.detailMeasurementInvalid,
                                    color = MaterialTheme.colorScheme.error,
                                    style = MaterialTheme.typography.bodySmall,
                                )
                            NativeDetailValue(
                                copy.detailStandardPrice,
                                standard?.let { amount -> nativeMinorMoney(amount, it.currency) },
                            )
                            if (canOverride) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Checkbox(
                                        checked = overridePrice,
                                        onCheckedChange = { overridePrice = it },
                                        enabled = !busy,
                                    )
                                    Text(copy.detailChargedPrice)
                                }
                                if (overridePrice) {
                                    NativePosInput(
                                        value = price,
                                        onValueChange = { price = it },
                                        label = { Text(copy.detailChargedPrice) },
                                        enabled = !busy,
                                        singleLine = true,
                                        modifier = Modifier.fillMaxWidth(),
                                    )
                                    NativePosInput(
                                        value = reason,
                                        onValueChange = { reason = it.take(500) },
                                        label = { Text(copy.detailPriceReason) },
                                        enabled = !busy,
                                        modifier = Modifier.fillMaxWidth(),
                                    )
                                }
                            }
                            NativeDetailValue(
                                copy.detailEstimatedAmount,
                                estimate?.let { amount ->
                                    nativeMinorMoney(amount, ticket.currency)
                                },
                            )
                        }
                        NativePosInput(
                            value = category,
                            onValueChange = { category = it.take(80) },
                            label = { Text(copy.categoryOptional) },
                            enabled = !busy,
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        NativePosInput(
                            value = colour,
                            onValueChange = { colour = it.take(40) },
                            label = { Text(copy.colorOptional) },
                            enabled = !busy,
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        NativePosInput(
                            value = brand,
                            onValueChange = { brand = it.take(80) },
                            label = { Text(copy.brandOptional) },
                            enabled = !busy,
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        NativePosInput(
                            value = material,
                            onValueChange = { material = it.take(80) },
                            label = { Text(copy.materialOptional) },
                            enabled = !busy,
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        NativePosInput(
                            value = defects,
                            onValueChange = { defects = it.take(2000) },
                            label = { Text(copy.defectsOptional) },
                            enabled = !busy,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        NativePosInput(
                            value = request,
                            onValueChange = { request = it.take(2000) },
                            label = { Text(copy.specialRequestOptional) },
                            enabled = !busy,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        NativePosInput(
                            value = remark,
                            onValueChange = { remark = it.take(2000) },
                            label = { Text(copy.itemNoteOptional) },
                            enabled = !busy,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        message?.let { Text(it, color = POS_MUTED) }
                    }
                    Button(
                        onClick = {
                            service?.let {
                                onSave(
                                    NativeTicketItemDraft(
                                        it,
                                        type,
                                        if (it.pricingUnit == "per_kg") 1 else quantity.toLong(),
                                        weight.takeIf { it.isNotBlank() },
                                        bags.toLongOrNull(),
                                        category,
                                        colour,
                                        brand,
                                        material,
                                        defects,
                                        request,
                                        remark,
                                        if (overridePrice) unit else null,
                                        reason.takeIf { overridePrice },
                                    )
                                )
                            }
                        },
                        enabled =
                            !busy &&
                                validMeasurement &&
                                unit != null &&
                                estimate != null &&
                                (!overridePrice || reason.isNotBlank()),
                        modifier =
                            Modifier.fillMaxWidth()
                                .padding(horizontal = 22.dp, vertical = 12.dp)
                                .height(50.dp),
                    ) {
                        NativeBusyLabel(
                            busy,
                            if (item == null) copy.intakeSaving else copy.saving,
                            if (item == null) copy.confirmAddItem else copy.saveItem,
                        )
                    }
                }
            }
        }
    }
}

internal fun nativeValidIntakeMeasurement(
    unit: String,
    quantity: String,
    weight: String,
    bags: String,
): Boolean =
    if (unit == "per_kg")
        runCatching {
                BigDecimal(weight).let { it.signum() > 0 && it.scale() <= 3 } &&
                    bags.toLongOrNull() in 1L..9999L
            }
            .getOrDefault(false)
    else quantity.toLongOrNull() in 1L..9999L
