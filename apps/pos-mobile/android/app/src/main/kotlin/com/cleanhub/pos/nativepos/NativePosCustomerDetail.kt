package com.cleanhub.pos.nativepos

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

/**
 * Customer history is paged from the same endpoints as POS Web; cached pages remain readable
 * offline.
 */
@Composable
internal fun NativeCustomerDetailPanel(
    copy: NativePosCopy,
    customer: NativeCustomer,
    cachedTickets: List<NativeServiceTicket>,
    busy: Boolean,
    internetAvailable: Boolean,
    onChange: () -> Unit,
    onNewTicket: () -> Unit,
    onOpenTicket: (NativeServiceTicket) -> Unit,
    onOpenOrder: (String) -> Unit,
    onUpdated: (NativeCustomer) -> Unit,
) {
    val context = LocalContext.current
    val database = remember { NativePosDatabase(context.applicationContext) }
    val store = remember { NativePosIntakeStore(context.applicationContext) }
    val api = remember { NativePosApiClient(NativePosSession(context.applicationContext)) }
    val terminal = remember(customer.id) { database.snapshot().terminal }
    val scope = rememberCoroutineScope()
    var profile by remember(customer.id) { mutableStateOf<JSONObject?>(null) }
    var account by remember(customer.id) { mutableStateOf<JSONObject?>(null) }
    var stats by remember(customer.id) { mutableStateOf<JSONObject?>(null) }
    var ticketTotal by remember(customer.id) { mutableStateOf<Int?>(null) }
    var tab by remember(customer.id) { mutableStateOf("overview") }
    var offset by remember(customer.id, tab) { mutableIntStateOf(0) }
    var page by remember(customer.id, tab, offset) { mutableStateOf<JSONObject?>(null) }
    var loading by remember { mutableStateOf(false) }
    var pageLoading by remember { mutableStateOf(false) }
    var failed by remember(customer.id) { mutableStateOf(false) }
    var pageFailed by remember(customer.id, tab, offset) { mutableStateOf(false) }
    var retry by remember { mutableIntStateOf(0) }
    var editing by remember(customer.id) { mutableStateOf(false) }
    var saving by remember { mutableStateOf(false) }
    var saveError by remember { mutableStateOf<String?>(null) }
    DisposableEffect(Unit) {
        onDispose {
            store.close()
            database.close()
        }
    }
    LaunchedEffect(customer.id, internetAvailable, retry) {
        val t = terminal ?: return@LaunchedEffect
        loading = true
        failed = false
        try {
            withContext(Dispatchers.IO) {
                profile = store.cached(t, "customer", customer.id)
                account = store.cached(t, "account", customer.accountId)
                stats = store.cached(t, "customer-stats", customer.id)
                ticketTotal = store.cached(t, "customer-ticket-count", customer.id)?.optInt("total")
            }
            if (internetAvailable) {
                val results =
                    withContext(Dispatchers.IO) {
                        listOf(
                                "customer" to "/pos/customers/${customer.id}",
                                "account" to "/pos/accounts/${customer.accountId}",
                                "customer-stats" to "/pos/customers/${customer.id}/order-stats",
                                "customer-ticket-count" to
                                    "/pos/service-tickets?customerId=${customer.id}&limit=1&offset=0",
                            )
                            .map { (kind, path) ->
                                kind to
                                    runCatching {
                                        api.get(path).also {
                                            store.cache(
                                                t,
                                                kind,
                                                if (kind == "account") customer.accountId
                                                else customer.id,
                                                it,
                                            )
                                        }
                                    }
                            }
                    }
                for ((kind, result) in results) {
                    result.getOrNull()?.let { body ->
                        when (kind) {
                            "customer" -> profile = body
                            "account" -> account = body
                            "customer-stats" -> stats = body
                            "customer-ticket-count" -> ticketTotal = body.optInt("total")
                        }
                    }
                    if (result.isFailure) failed = true
                }
                profile?.let { value ->
                    onUpdated(
                        customer.copy(
                            fullName = value.optString("fullName", customer.fullName),
                            phone = value.nativeText("phone"),
                            email = value.nativeText("email"),
                            status = value.optString("status", customer.status),
                        )
                    )
                }
            }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            failed = true
        } finally {
            loading = false
        }
    }
    LaunchedEffect(customer.id, tab, offset, internetAvailable, retry) {
        if (tab !in listOf("tickets", "orders", "items")) return@LaunchedEffect
        val t = terminal ?: return@LaunchedEffect
        pageLoading = true
        pageFailed = false
        val key = "${customer.id}:$tab:$offset"
        try {
            page = withContext(Dispatchers.IO) { store.cached(t, "customer-page", key) }
            if (internetAvailable)
                page =
                    withContext(Dispatchers.IO) {
                        val path =
                            when (tab) {
                                "tickets" ->
                                    "/pos/service-tickets?customerId=${customer.id}&limit=20&offset=$offset"
                                "orders" ->
                                    "/pos/orders?customerId=${customer.id}&limit=20&offset=$offset"
                                else ->
                                    "/pos/customers/${customer.id}/service-items?limit=20&offset=$offset"
                            }
                        api.get(path).also { store.cache(t, "customer-page", key, it) }
                    }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            pageFailed = true
        } finally {
            pageLoading = false
        }
    }
    NativeDetailSection(copy.customerRecord) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Column(Modifier.weight(1f)) {
                Text(
                    profile?.nativeText("fullName") ?: customer.fullName,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    color = POS_INK,
                )
                Text(account?.nativeText("accountName") ?: customer.accountName, color = POS_MUTED)
            }
            TextButton(onClick = onChange, enabled = !busy && !saving) { Text(copy.change) }
            TextButton(
                onClick = { retry++ },
                enabled = internetAvailable && !loading && !pageLoading && !saving,
            ) {
                Text(copy.detailRefresh)
            }
        }
        if (loading) LinearProgressIndicator(Modifier.fillMaxWidth())
        if (!internetAvailable) Text(copy.detailCachedNotice, color = POS_MUTED)
        if (failed || pageFailed) {
            Text(copy.detailLoadFailed, color = MaterialTheme.colorScheme.error)
            TextButton(onClick = { retry++ }, enabled = !loading && !pageLoading) {
                Text(copy.detailRefresh)
            }
        }
        NativeDetailChoices(
            listOf("overview", "tickets", "orders", "items", "notes"),
            tab,
            !saving,
            {
                when (it) {
                    "overview" -> copy.detailOverview
                    "tickets" -> copy.detailCustomerTickets
                    "orders" -> copy.detailCustomerOrders
                    "items" -> copy.detailCustomerItems
                    else -> copy.detailCustomerNotes
                }
            },
            { tab = it },
        )
        when (tab) {
            "overview" -> {
                NativeDetailValue(
                    copy.detailPhone,
                    profile?.nativeText("phone") ?: account?.nativeText("phone") ?: customer.phone,
                )
                NativeDetailValue(
                    copy.detailEmail,
                    profile?.nativeText("email") ?: account?.nativeText("email") ?: customer.email,
                )
                NativeDetailValue(copy.detailAddress, profile?.nativeText("address"))
                NativeDetailValue(copy.detailRelationship, profile?.nativeText("relationship"))
                NativeDetailValue(
                    copy.detailAccount,
                    account?.nativeText("accountName") ?: customer.accountName,
                )
                NativeDetailValue(
                    copy.ticketsStatus,
                    if ((profile?.optString("status") ?: customer.status) == "active")
                        copy.customerStatusActive
                    else copy.detailCustomerDisabled,
                )
                NativeDetailValue(copy.detailOrderCount, stats?.optInt("orderCount")?.toString())
                NativeDetailValue(copy.detailTicketCount, ticketTotal?.toString())
                NativeDetailValue(
                    copy.orderCreatedAt,
                    nativeOrderTime(
                        profile?.nativeText("createdAt"),
                        terminal?.timeZone ?: "UTC",
                        copy.localeCode(),
                    ),
                )
                NativeDetailValue(
                    copy.orderUpdatedAt,
                    nativeOrderTime(
                        profile?.nativeText("updatedAt"),
                        terminal?.timeZone ?: "UTC",
                        copy.localeCode(),
                    ),
                )
                OutlinedButton(
                    onClick = {
                        editing = true
                        saveError = null
                    },
                    enabled = !busy && !saving && internetAvailable && profile != null,
                ) {
                    Text(copy.detailEditInformation)
                }
                Text(copy.recentWork, fontWeight = FontWeight.SemiBold)
                val recent =
                    cachedTickets
                        .filter { it.customerId == customer.id }
                        .sortedByDescending { it.updatedAt }
                        .take(5)
                if (recent.isEmpty()) Text(copy.noCachedTickets, color = POS_MUTED)
                recent.forEach { ticket -> NativeCustomerTicketRow(copy, ticket, onOpenTicket) }
            }
            "notes" -> {
                Text(profile?.nativeText("notes") ?: copy.detailNoRecords, color = POS_INK)
                OutlinedButton(
                    onClick = {
                        editing = true
                        saveError = null
                    },
                    enabled = internetAvailable && !busy && !saving && profile != null,
                ) {
                    Text(copy.detailEditInformation)
                }
            }
            else -> {
                if (pageLoading) LinearProgressIndicator(Modifier.fillMaxWidth())
                val rows = page?.optJSONArray("data") ?: JSONArray()
                if (!pageLoading && rows.length() == 0)
                    Text(
                        if (page == null && !internetAvailable) copy.detailNotCached
                        else copy.detailNoRecords,
                        color = POS_MUTED,
                    )
                for (i in 0 until rows.length()) rows.optJSONObject(i)?.let { row ->
                    when (tab) {
                        "tickets" ->
                            NativeCustomerTicketRow(
                                copy,
                                row.nativeTicket(terminal?.currency.orEmpty()),
                                onOpenTicket,
                            )
                        "orders" ->
                            NativeIntakeOrderRow(
                                copy,
                                row,
                                terminal?.timeZone ?: "UTC",
                                onOpenOrder,
                            )
                        else ->
                            OutlinedCard(
                                onClick = {
                                    val ticket =
                                        cachedTickets.firstOrNull {
                                            it.id == row.optString("ticketId")
                                        }
                                    if (ticket != null) onOpenTicket(ticket)
                                    else {
                                        scope.launch {
                                            pageLoading = true
                                            try {
                                                val detail =
                                                    withContext(Dispatchers.IO) {
                                                        api.get(
                                                            "/pos/service-tickets/${row.getString("ticketId")}"
                                                        )
                                                    }
                                                onOpenTicket(
                                                    detail.nativeTicket(
                                                        terminal?.currency.orEmpty()
                                                    )
                                                )
                                            } catch (_: Exception) {
                                                pageFailed = true
                                            } finally {
                                                pageLoading = false
                                            }
                                        }
                                    }
                                },
                                enabled =
                                    !busy &&
                                        (internetAvailable ||
                                            cachedTickets.any {
                                                it.id == row.optString("ticketId")
                                            }),
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp),
                            ) {
                                Column(
                                    Modifier.padding(14.dp),
                                    verticalArrangement = Arrangement.spacedBy(5.dp),
                                ) {
                                    Text(
                                        row.optString("itemName"),
                                        fontWeight = FontWeight.SemiBold,
                                    )
                                    Text(
                                        listOfNotNull(
                                                row.nativeText("ticketNo"),
                                                row.nativeText("labelCode"),
                                                ticketItemStatusLabel(
                                                    row.optString("itemStatus"),
                                                    copy,
                                                ),
                                            )
                                            .joinToString(" · "),
                                        color = POS_MUTED,
                                    )
                                    listOf(
                                            copy.detailItemColor to row.nativeText("itemColor"),
                                            copy.detailItemBrand to row.nativeText("itemBrand"),
                                            copy.detailItemMaterial to
                                                row.nativeText("itemMaterial"),
                                        )
                                        .filter { it.second != null }
                                        .forEach { NativeDetailValue(it.first, it.second) }
                                    NativeDetailValue(
                                        if (row.optString("pricingUnit") == "per_kg") copy.weightKg
                                        else copy.quantityPieces,
                                        if (row.optString("pricingUnit") == "per_kg")
                                            row.nativeText("weight")
                                        else row.optString("quantity"),
                                    )
                                }
                            }
                    }
                }
                page?.let { body ->
                    val total = body.optInt("total")
                    Text(copy.detailPage.format(offset / 20 + 1, total), color = POS_MUTED)
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        OutlinedButton(
                            onClick = { offset = (offset - 20).coerceAtLeast(0) },
                            enabled = !pageLoading && offset > 0,
                        ) {
                            Text(copy.detailPrevious)
                        }
                        OutlinedButton(
                            onClick = { offset += 20 },
                            enabled = !pageLoading && offset + 20 < total,
                        ) {
                            Text(copy.detailNext)
                        }
                    }
                }
            }
        }
        Button(
            onClick = onNewTicket,
            enabled =
                !busy && !saving && (profile?.optString("status") ?: customer.status) == "active",
            modifier = Modifier.fillMaxWidth().height(50.dp),
            shape = RoundedCornerShape(14.dp),
        ) {
            Text(copy.detailNewTicket)
        }
    }
    if (editing && profile != null)
        NativeCustomerEditDialog(copy, profile!!, saving, saveError, { editing = false }) { payload
            ->
            if (!saving) {
                saving = true
                saveError = null
                scope.launch {
                    try {
                        val updated =
                            withContext(Dispatchers.IO) {
                                api.patch("/pos/customers/${customer.id}", payload).also { body ->
                                    terminal?.let { store.cache(it, "customer", customer.id, body) }
                                }
                            }
                        profile = updated
                        onUpdated(
                            customer.copy(
                                fullName = updated.optString("fullName", customer.fullName),
                                phone = updated.nativeText("phone"),
                                email = updated.nativeText("email"),
                                status = updated.optString("status", customer.status),
                            )
                        )
                        editing = false
                    } catch (error: Exception) {
                        saveError = error.message ?: copy.detailLoadFailed
                    } finally {
                        saving = false
                    }
                }
            }
        }
}

@Composable
private fun NativeCustomerTicketRow(
    copy: NativePosCopy,
    ticket: NativeServiceTicket,
    onOpen: (NativeServiceTicket) -> Unit,
) {
    OutlinedCard(
        onClick = { onOpen(ticket) },
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(ticket.ticketNo ?: copy.serviceTicket, fontWeight = FontWeight.SemiBold)
            Text(
                "${ticketStatusLabel(ticket.ticketStatus,copy)} · ${ticket.priorityLabel(copy)}",
                color = POS_MUTED,
            )
            Text(
                nativeMinorMoney(ticket.totalMinor, ticket.currency),
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

@Composable
private fun NativeCustomerEditDialog(
    copy: NativePosCopy,
    profile: JSONObject,
    busy: Boolean,
    error: String?,
    onDismiss: () -> Unit,
    onSave: (JSONObject) -> Unit,
) {
    var name by remember { mutableStateOf(profile.optString("fullName")) }
    var phone by remember { mutableStateOf(profile.nativeText("phone").orEmpty()) }
    var email by remember { mutableStateOf(profile.nativeText("email").orEmpty()) }
    var address by remember { mutableStateOf(profile.nativeText("address").orEmpty()) }
    var relationship by remember { mutableStateOf(profile.nativeText("relationship").orEmpty()) }
    var notes by remember { mutableStateOf(profile.nativeText("notes").orEmpty()) }
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
                NativePosInput(
                    value = name,
                    onValueChange = { name = it.take(120) },
                    label = { Text(copy.customerName) },
                    enabled = !busy,
                    modifier = Modifier.fillMaxWidth(),
                )
                NativePosInput(
                    value = phone,
                    onValueChange = { phone = it.take(32) },
                    label = { Text(copy.detailPhone) },
                    enabled = !busy,
                    modifier = Modifier.fillMaxWidth(),
                )
                NativePosInput(
                    value = email,
                    onValueChange = { email = it.take(254) },
                    label = { Text(copy.detailEmail) },
                    enabled = !busy,
                    modifier = Modifier.fillMaxWidth(),
                )
                NativePosInput(
                    value = address,
                    onValueChange = { address = it.take(500) },
                    label = { Text(copy.detailAddress) },
                    enabled = !busy,
                    modifier = Modifier.fillMaxWidth(),
                )
                NativePosInput(
                    value = relationship,
                    onValueChange = { relationship = it.take(80) },
                    label = { Text(copy.detailRelationship) },
                    enabled = !busy,
                    modifier = Modifier.fillMaxWidth(),
                )
                NativePosInput(
                    value = notes,
                    onValueChange = { notes = it.take(2000) },
                    label = { Text(copy.detailCustomerNotes) },
                    enabled = !busy,
                    modifier = Modifier.fillMaxWidth(),
                )
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                Button(
                    onClick = {
                        onSave(
                            JSONObject().put("fullName", name.trim()).apply {
                                listOf(
                                        "phone" to phone,
                                        "email" to email,
                                        "address" to address,
                                        "relationship" to relationship,
                                        "notes" to notes,
                                    )
                                    .forEach { (key, value) ->
                                        put(
                                            key,
                                            value.trim().takeIf { it.isNotEmpty() }
                                                ?: JSONObject.NULL,
                                        )
                                    }
                            }
                        )
                    },
                    enabled = !busy && name.isNotBlank(),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    NativeBusyLabel(busy, copy.saving, copy.saveItem)
                }
                TextButton(onClick = onDismiss, enabled = !busy) { Text(copy.back) }
            }
        }
    }
}
