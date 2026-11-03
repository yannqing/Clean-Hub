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
    backLabel: String = copy.change,
) {
    val context = LocalContext.current
    val database = remember { NativePosDatabase(context.applicationContext) }
    val store = remember { database.intakeStore }
    val api = remember { NativePosApiClient(NativePosSession(context.applicationContext)) }
    val directory = remember { NativeCustomerDirectory(database, nativeCustomerDirectoryGateway(api)) }
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
    var confirmingAppPassword by remember(customer.id) { mutableStateOf(false) }
    var issuedAppPassword by remember(customer.id) { mutableStateOf<String?>(null) }
    var confirmingStatus by remember(customer.id) { mutableStateOf(false) }
    var recentTickets by remember(customer.id) { mutableStateOf<JSONObject?>(null) }
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
                recentTickets = store.cached(t, "customer-page", "${customer.id}:tickets:0")
            }
            if (internetAvailable) {
                val results =
                    withContext(Dispatchers.IO) {
                        listOf(
                                "customer" to "/pos/customers/${customer.id}",
                                "account" to "/pos/accounts/${customer.accountId}",
                                "customer-stats" to "/pos/customers/${customer.id}/order-stats",
                                "tickets" to "/pos/service-tickets?customerId=${customer.id}&limit=20&offset=0",
                                "orders" to "/pos/orders?customerId=${customer.id}&limit=20&offset=0",
                                "items" to "/pos/customers/${customer.id}/service-items?limit=20&offset=0",
                            )
                            .map { (kind, path) ->
                                kind to
                                    runCatching {
                                        api.get(path).also {
                                            directory.requireScope(t)
                                            it.put("cachedAt", System.currentTimeMillis())
                                            store.cache(
                                                t,
                                                if (kind in listOf("tickets", "orders", "items")) "customer-page" else kind,
                                                if (kind == "account") customer.accountId
                                                else if (kind in listOf("tickets", "orders", "items")) "${customer.id}:$kind:0"
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
                            "tickets" -> { ticketTotal = body.optInt("total"); recentTickets = body }
                        }
                    }
                    if (result.isFailure) failed = true
                }
                results.firstOrNull { it.first == "customer" }?.second?.getOrNull()?.let { value ->
                    val updated = withContext(Dispatchers.IO) { directory.rememberProfile(t, value, account?.nativeText("accountName") ?: customer.accountName) }
                    onUpdated(updated)
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
                        api.get(path).also { directory.requireScope(t); store.cache(t, "customer-page", key, it) }
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
                    (profile?.nativeText("fullName") ?: customer.fullName).ifBlank { copy.customerFallback },
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    color = POS_INK,
                )
                Text((account?.nativeText("accountName") ?: customer.accountName).ifBlank { copy.customerFallback }, color = POS_MUTED)
            }
            TextButton(onClick = onChange, enabled = !busy && !saving) { Text(backLabel) }
            TextButton(
                onClick = { retry++ },
                enabled = internetAvailable && !loading && !pageLoading && !saving,
            ) {
                Text(copy.detailRefresh)
            }
        }
        if (loading) LinearProgressIndicator(Modifier.fillMaxWidth())
        NativeCustomerStatusBadge(copy, profile?.nativeText("status") ?: customer.status)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = { editing = true; saveError = null }, enabled = !busy && !saving && internetAvailable && profile != null) { Text(copy.detailEditInformation) }
            OutlinedButton(onClick = { confirmingStatus = true; saveError = null }, enabled = !busy && !saving && internetAvailable && profile != null) {
                Text(if ((profile?.nativeText("status") ?: customer.status) == "active") copy.customerDirectoryDisable else copy.customerDirectoryEnable)
            }
        }
        if (account?.nativeText("status") == "disabled") Text(copy.customerDirectoryAccountDisabled, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
        Button(onClick = onNewTicket, enabled = !busy && !saving && account?.nativeText("status") != "disabled" && (profile?.nativeText("status") ?: customer.status) == "active",
            modifier = Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(12.dp)) { Text(copy.detailNewTicket) }
        account?.optJSONObject("appAccess")?.let { access ->
            Text(if (access.optBoolean("passwordEnabled")) copy.customerAppPasswordEnabled else copy.customerAppPasswordNotEnabled, style = MaterialTheme.typography.bodySmall, color = POS_MUTED)
            if (access.optBoolean("mustChangePassword")) Text(copy.customerAppPasswordChangeRequired, style = MaterialTheme.typography.bodySmall, color = POS_MUTED)
            Text(String.format(copy.customerAppLoginDetails, access.optString("tenantCode"), account?.nativeText("phone")?.ifBlank { account?.nativeText("email").orEmpty() }.orEmpty()), style = MaterialTheme.typography.bodySmall, color = POS_MUTED)
        }
        if (terminal?.role in listOf("owner", "manager")) {
            val hasAppIdentifier = !account?.nativeText("phone").isNullOrBlank() || !account?.nativeText("email").isNullOrBlank()
            if (account != null && !hasAppIdentifier) Text(copy.customerAppIdentifierRequired, style = MaterialTheme.typography.bodySmall, color = POS_MUTED)
            OutlinedButton(onClick = { confirmingAppPassword = true; saveError = null },
                enabled = internetAvailable && !busy && !saving && hasAppIdentifier && account?.nativeText("status") != "disabled",
                modifier = Modifier.fillMaxWidth().heightIn(min = 44.dp)) { Text(copy.customerAppAccess) }
        }
        saveError?.let { Text(nativeFeedbackText(it, copy), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
        if (!internetAvailable) Text(copy.detailCachedNotice, color = POS_MUTED)
        if (failed || pageFailed) {
            Text(copy.detailLoadFailed, color = MaterialTheme.colorScheme.error)
            TextButton(onClick = { retry++ }, enabled = internetAvailable && !loading && !pageLoading) {
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
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    CustomerDetailMetric(copy.detailOrderCount, stats?.optInt("orderCount")?.toString() ?: "—", Modifier.weight(1f))
                    CustomerDetailMetric(copy.detailTicketCount, (ticketTotal ?: recentTickets?.optInt("total"))?.toString() ?: "—", Modifier.weight(1f))
                }
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
                        copy.customerDirectoryActive
                    else copy.detailCustomerDisabled,
                )
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
                Text(copy.recentWork, fontWeight = FontWeight.SemiBold)
                val recentRows = recentTickets?.optJSONArray("data")
                val recent = if (recentRows != null) buildList {
                    for (i in 0 until recentRows.length()) recentRows.optJSONObject(i)?.let { add(it.nativeTicket(terminal?.currency.orEmpty())) }
                }.take(5) else cachedTickets
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
    }
    if (editing && profile != null)
        NativeCustomerEditDialog(copy, profile!!, saving, internetAvailable, saveError, { editing = false }) { payload
            ->
            if (!internetAvailable) saveError = copy.requiresNetwork
            else if (!saving) {
                saving = true
                saveError = null
                scope.launch {
                    try {
                        val updated =
                            withContext(Dispatchers.IO) {
                                api.patch("/pos/customers/${customer.id}", payload).also { body ->
                                    terminal?.let { directory.rememberProfile(it, body, customer.accountName) }
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
    if (confirmingAppPassword) AlertDialog(
        onDismissRequest = { if (!saving) confirmingAppPassword = false },
        title = { Text(copy.customerAppAccess) },
        text = { Text(copy.customerAppAccessHint) },
        confirmButton = { TextButton(enabled = !saving && internetAvailable, onClick = {
            saving = true
            scope.launch {
                try {
                    val response = withContext(Dispatchers.IO) { api.post("/pos/accounts/${customer.accountId}/app-password", JSONObject()) }
                    issuedAppPassword = response.getString("password")
                    retry++
                    confirmingAppPassword = false
                } catch (error: Exception) {
                    if (error is CancellationException) throw error
                    saveError = error.message
                    confirmingAppPassword = false
                } finally { saving = false }
            }
        }) { if (saving) CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp) else Text(copy.customerAppAccess) } },
        dismissButton = { TextButton(enabled = !saving, onClick = { confirmingAppPassword = false }) { Text(copy.cancel) } },
    )
    issuedAppPassword?.let { password -> AlertDialog(
        onDismissRequest = { issuedAppPassword = null },
        title = { Text(copy.customerAppAccess) },
        text = { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(String.format(copy.customerAppPasswordIssued, password))
            Text(String.format(copy.customerAppLoginDetails, account?.optJSONObject("appAccess")?.optString("tenantCode").orEmpty(), account?.nativeText("phone")?.ifBlank { account?.nativeText("email").orEmpty() }.orEmpty()))
        } },
        confirmButton = { TextButton(onClick = { issuedAppPassword = null }) { Text(copy.close) } },
    ) }
    if (confirmingStatus) AlertDialog(
        onDismissRequest = { if (!saving) confirmingStatus = false },
        title = { Text(if ((profile?.nativeText("status") ?: customer.status) == "active") copy.customerDirectoryDisable else copy.customerDirectoryEnable) },
        text = { Text(copy.customerDirectoryStatusHint) },
        dismissButton = { TextButton(onClick = { confirmingStatus = false }, enabled = !saving) { Text(copy.cancel) } },
        confirmButton = { Button(enabled = !saving && internetAvailable, onClick = {
            val t = terminal ?: return@Button
            saving = true; saveError = null
            scope.launch {
                try {
                    val updated = withContext(Dispatchers.IO) {
                        api.post("/pos/customers/${customer.id}/status-changes", JSONObject().put("status", if ((profile?.nativeText("status") ?: customer.status) == "active") "disabled" else "active"))
                            .also { directory.rememberProfile(t, it, customer.accountName) }
                    }
                    profile = updated
                    onUpdated(updated.directoryCustomer(customer.accountName))
                    confirmingStatus = false
                } catch (cancelled: CancellationException) { throw cancelled }
                catch (error: Exception) { saveError = error.message ?: copy.detailLoadFailed; confirmingStatus = false }
                finally { saving = false }
            }
        }) {
            if (saving) CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
            else Text(if ((profile?.nativeText("status") ?: customer.status) == "active") copy.customerDirectoryDisable else copy.customerDirectoryEnable)
        } },
    )
}

@Composable
private fun CustomerDetailMetric(label: String, value: String, modifier: Modifier) {
    Surface(modifier, shape = RoundedCornerShape(12.dp), color = POS_PAGE_BACKGROUND) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(label, color = POS_MUTED, style = MaterialTheme.typography.labelSmall)
            Text(value, color = POS_INK, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleLarge)
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
                copy.minorMoney(ticket.totalMinor, ticket.currency),
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
    internetAvailable: Boolean,
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
                    onValueChange = { name = it.take(200) },
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
                    onValueChange = { email = it.take(320) },
                    label = { Text(copy.detailEmail) },
                    enabled = !busy,
                    modifier = Modifier.fillMaxWidth(),
                )
                if (!nativeCustomerEmailValid(email)) Text(copy.customerDirectoryEmailError, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                NativePosInput(
                    value = address,
                    onValueChange = { address = it.take(1000) },
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
                error?.let { Text(nativeFeedbackText(it, copy), color = MaterialTheme.colorScheme.error) }
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
                    enabled = internetAvailable && !busy && name.isNotBlank() && nativeCustomerEmailValid(email),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    NativeBusyLabel(busy, copy.saving, copy.saveItem)
                }
                TextButton(onClick = onDismiss, enabled = !busy) { Text(copy.back) }
            }
        }
    }
}
