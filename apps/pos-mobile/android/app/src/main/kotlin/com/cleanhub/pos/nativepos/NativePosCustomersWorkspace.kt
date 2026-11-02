package com.cleanhub.pos.nativepos

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

@Composable
internal fun NativeCustomersWorkspace(
    copy: NativePosCopy,
    current: NativePosSnapshot,
    internetAvailable: Boolean,
    busy: Boolean,
    message: String?,
    onBack: () -> Unit,
    onOpenTicket: (NativeServiceTicket) -> Unit,
    onOpenOrder: (String) -> Unit,
    onCreateTicket: (NativeCustomer, String, String, String, String) -> Unit,
    onChanged: () -> Unit,
) {
    val terminal = current.terminal ?: return
    val context = LocalContext.current.applicationContext
    val scopeKey = "${terminal.tenantId}:${terminal.branchId}:${terminal.terminalId}:${terminal.userId}"
    key(scopeKey) {
        val database = remember { NativePosDatabase(context) }
        val repository = remember { NativeCustomerDirectory(database, nativeCustomerDirectoryGateway(NativePosApiClient(NativePosSession(context)))) }
        DisposableEffect(database) { onDispose { database.intakeStore.close(); database.close() } }
        var query by rememberSaveable { mutableStateOf("") }
        var status by rememberSaveable { mutableStateOf("all") }
        var offset by rememberSaveable { mutableIntStateOf(0) }
        var selected by remember { mutableStateOf<NativeCustomer?>(null) }
        var page by remember { mutableStateOf(NativeCustomerDirectoryPage(emptyList(), 0, null, true)) }
        var loading by remember { mutableStateOf(false) }
        var error by remember { mutableStateOf<String?>(null) }
        var retry by remember { mutableIntStateOf(0) }
        var creating by remember { mutableStateOf(false) }
        var ticketDialog by remember { mutableStateOf(false) }
        val scope = rememberCoroutineScope()

        if (selected == null) LaunchedEffect(query, status, offset, internetAvailable, retry, current.customers) {
            loading = true
            error = null
            try {
                page = withContext(Dispatchers.IO) { repository.cachedPage(terminal, query, status, offset, current.customers) }
                if (internetAvailable) {
                    delay(250)
                    page = withContext(Dispatchers.IO) { repository.refreshPage(terminal, query, status, offset) }
                }
                if (offset > 0 && page.entries.isEmpty()) offset = ((page.total - 1).coerceAtLeast(0) / 20) * 20
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (failure: Exception) { error = if (page.total > 0) copy.customerDirectoryFallback else failure.message ?: copy.detailLoadFailed }
            finally { loading = false }
        }

        val customer = selected
        if (customer == null) {
            NativeCustomerDirectoryList(copy, page, query, status, terminal.timeZone, internetAvailable, loading,
                error, onBack,
                onQuery = { query = it.take(200); offset = 0 },
                onStatus = { status = it; offset = 0 }, onRefresh = { retry++ },
                onCreate = { creating = true }, onOpen = { selected = it },
                offset = offset, onPage = { offset = it }, actionsBusy = busy)
        } else {
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                NativeCustomerDetailPanel(copy, customer, current.tickets, busy, internetAvailable,
                    onChange = { selected = null }, onNewTicket = { ticketDialog = true },
                    onOpenTicket = onOpenTicket, onOpenOrder = onOpenOrder,
                    onUpdated = { val changed = selected != it; selected = it; if (changed) onChanged() }, backLabel = copy.customerDirectoryBack)
                message?.let { Text(nativeFeedbackText(it, copy, preserveUnknown = true), color = POS_MUTED, style = MaterialTheme.typography.bodySmall) }
            }
            if (ticketDialog) NativeCreateTicketDialog(copy, customer, busy, internetAvailable, message,
                onDismiss = { ticketDialog = false },
                onCreate = { type, priority, remark, pickup -> onCreateTicket(customer, type, priority, remark, pickup) })
        }
        if (creating) NativeDirectoryCreateDialog(copy, internetAvailable, onDismiss = { creating = false }) { input, finish ->
            scope.launch {
                try {
                    val result = withContext(Dispatchers.IO) { repository.create(terminal, input) }
                    creating = false
                    selected = result
                    onChanged()
                    finish(null)
                } catch (cancelled: CancellationException) { throw cancelled }
                catch (failure: Exception) { finish(failure.message ?: copy.detailLoadFailed) }
            }
        }
    }
}

@Composable
internal fun NativeCustomerDirectoryList(
    copy: NativePosCopy,
    page: NativeCustomerDirectoryPage,
    query: String,
    status: String,
    timeZone: String,
    internetAvailable: Boolean,
    loading: Boolean,
    error: String?,
    onBack: () -> Unit,
    onQuery: (String) -> Unit,
    onStatus: (String) -> Unit,
    onRefresh: () -> Unit,
    onCreate: () -> Unit,
    onOpen: (NativeCustomer) -> Unit,
    offset: Int,
    onPage: (Int) -> Unit,
    actionsBusy: Boolean = false,
) {
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val wide = maxWidth >= 760.dp
        LazyColumn(Modifier.fillMaxSize().padding(horizontal = if (wide) 24.dp else 16.dp), contentPadding = PaddingValues(vertical = 18.dp)) {
            item {
                TextButton(onClick = onBack) { Text("‹ ${copy.tabWorkspace}") }
                Row(Modifier.fillMaxWidth().padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                        Text(copy.menuCustomers, color = POS_INK, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                        Text(copy.customerDirectoryDescription, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                    }
                    Button(onClick = onCreate, enabled = internetAvailable && !actionsBusy, shape = RoundedCornerShape(10.dp)) { Text(copy.newCustomer) }
                }
                Row(Modifier.fillMaxWidth().padding(bottom = 14.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    DirectoryMetric(copy.customerDirectoryResults, page.total.toString(), Modifier.weight(1f))
                    DirectoryMetric(copy.customerDirectoryPageActive, page.entries.count { it.customer.status == "active" }.toString(), Modifier.weight(1f))
                    DirectoryMetric(copy.customerDirectoryPageDisabled, page.entries.count { it.customer.status == "disabled" }.toString(), Modifier.weight(1f))
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                    NativePosInput(query, onQuery, placeholder = { Text(copy.customerDirectorySearch, maxLines = 1, overflow = TextOverflow.Ellipsis) }, singleLine = true, modifier = Modifier.weight(1f))
                    if (wide) OutlinedButton(onClick = onRefresh, enabled = internetAvailable && !loading && !actionsBusy) { Text(copy.customerDirectoryRefresh) }
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.weight(1f)) {
                        NativeDetailChoices(listOf("all", "active", "disabled"), status, true,
                            { if (it == "all") copy.customerDirectoryAll else if (it == "active") copy.customerDirectoryActive else copy.detailCustomerDisabled }, onStatus)
                    }
                    if (!wide) TextButton(onClick = onRefresh, enabled = internetAvailable && !loading && !actionsBusy) { Text(copy.customerDirectoryRefresh) }
                }
                val notice = if (!internetAvailable) copy.customerDirectoryOffline else if (loading) copy.loading else if (page.cached) copy.customerDirectoryFallback else copy.customerDirectoryOnline
                Text(notice, color = POS_MUTED, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(vertical = 6.dp))
                page.syncedAt?.let { time -> Text(copy.customerDirectorySynced.format(nativeOrderTime(java.time.Instant.ofEpochMilli(time).toString(), timeZone, copy.localeCode())),
                    color = POS_MUTED, style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(bottom = 10.dp)) }
                error?.let { Text(nativeFeedbackText(it, copy), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(bottom = 10.dp)) }
                if (loading) LinearProgressIndicator(Modifier.fillMaxWidth())
                if (wide && page.entries.isNotEmpty()) Row(Modifier.fillMaxWidth().background(POS_PAGE_BACKGROUND).padding(14.dp)) {
                    DirectoryCell(copy.customerLabel, 1.35f, true)
                    DirectoryCell(copy.customerDirectoryContact, 1.5f, true)
                    DirectoryCell(copy.detailAccount, 1.2f, true)
                    DirectoryCell(copy.customerDirectoryStatus, .8f, true)
                    DirectoryCell(copy.orderCreatedAt, 1.2f, true)
                    DirectoryCell(copy.customerDirectoryActions, .7f, true)
                }
            }
            if (!loading && page.entries.isEmpty()) item {
                Column(Modifier.fillMaxWidth().padding(vertical = 42.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(copy.customerDirectoryEmpty, color = POS_INK, fontWeight = FontWeight.SemiBold)
                    Text(if (!internetAvailable) copy.customerDirectoryOfflineEmpty else copy.customerDirectoryEmptyHint, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                    if (query.isNotBlank() || status != "all") TextButton(onClick = { onQuery(""); onStatus("all") }) { Text(copy.customerDirectoryReset) }
                }
            }
            items(page.entries, key = { it.customer.id }) { entry ->
                val customer = entry.customer
                if (wide) {
                    Row(Modifier.fillMaxWidth().background(POS_PANEL_BACKGROUND).clickable(enabled = !actionsBusy) { onOpen(customer) }.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1.35f).padding(end = 10.dp)) {
                            Text(customer.fullName.ifBlank { copy.customerFallback }, color = POS_INK, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            Text(copy.customerDirectoryProfile, color = POS_MUTED, style = MaterialTheme.typography.labelSmall)
                        }
                        Column(Modifier.weight(1.5f).padding(end = 10.dp)) {
                            Text(customer.phone ?: copy.noPhoneOnFile, color = POS_INK, style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(customer.email ?: "—", color = POS_MUTED, style = MaterialTheme.typography.labelSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                        DirectoryCell(customer.accountName.ifBlank { copy.customerFallback }, 1.2f)
                        Box(Modifier.weight(.8f)) { NativeCustomerStatusBadge(copy, customer.status) }
                        DirectoryCell(nativeOrderTime(entry.createdAt, timeZone, copy.localeCode()), 1.2f)
                        TextButton(onClick = { onOpen(customer) }, enabled = !actionsBusy, modifier = Modifier.weight(.7f), contentPadding = PaddingValues(0.dp)) { Text(copy.customerDirectoryDetails, maxLines = 1) }
                    }
                    HorizontalDivider(color = POS_BORDER)
                } else {
                    Card(onClick = { onOpen(customer) }, enabled = !actionsBusy, modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp), shape = RoundedCornerShape(14.dp), colors = CardDefaults.cardColors(containerColor = POS_PANEL_BACKGROUND)) {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                Text(customer.fullName.ifBlank { copy.customerFallback }, Modifier.weight(1f), color = POS_INK, fontWeight = FontWeight.SemiBold)
                                NativeCustomerStatusBadge(copy, customer.status)
                            }
                            Text(listOfNotNull(customer.phone, customer.email).joinToString(" · ").ifBlank { copy.noContactOnFile }, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                            Text("${copy.detailAccount} · ${customer.accountName.ifBlank { copy.customerFallback }}", color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                            Text(copy.customerDirectoryDetails, color = POS_ACCENT, style = MaterialTheme.typography.labelMedium)
                        }
                    }
                }
            }
            item {
                if (page.total > 0) Row(Modifier.fillMaxWidth().padding(vertical = 16.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    OutlinedButton(onClick = { onPage((offset - 20).coerceAtLeast(0)) }, enabled = !loading && offset > 0) { Text(copy.detailPrevious) }
                    Text(copy.detailPage.format(offset / 20 + 1, page.total), color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                    OutlinedButton(onClick = { onPage(offset + 20) }, enabled = !loading && offset + 20 < page.total) { Text(copy.detailNext) }
                }
            }
        }
    }
}

@Composable
private fun DirectoryMetric(label: String, value: String, modifier: Modifier) {
    Surface(modifier, color = POS_PANEL_BACKGROUND, shape = RoundedCornerShape(12.dp)) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(label, color = POS_MUTED, style = MaterialTheme.typography.labelSmall)
            Text(value, color = POS_INK, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun RowScope.DirectoryCell(text: String, weight: Float, heading: Boolean = false) {
    Text(text, Modifier.weight(weight).padding(end = 10.dp), color = if (heading) POS_MUTED else POS_INK,
        style = if (heading) MaterialTheme.typography.labelMedium else MaterialTheme.typography.bodySmall,
        maxLines = 2, overflow = TextOverflow.Ellipsis)
}

@Composable
internal fun NativeCustomerStatusBadge(copy: NativePosCopy, status: String) {
    Surface(color = if (status == "active") POS_ACCENT.copy(alpha = .08f) else POS_PAGE_BACKGROUND, shape = RoundedCornerShape(6.dp)) {
        Text(if (status == "active") copy.customerDirectoryActive else copy.detailCustomerDisabled,
            Modifier.padding(horizontal = 8.dp, vertical = 5.dp), color = if (status == "active") POS_ACCENT else POS_MUTED,
            style = MaterialTheme.typography.labelSmall)
    }
}

@Composable
private fun NativeDirectoryCreateDialog(copy: NativePosCopy, internetAvailable: Boolean, onDismiss: () -> Unit,
    onCreate: (JSONObject, (String?) -> Unit) -> Unit) {
    var name by rememberSaveable { mutableStateOf("") }
    var phone by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var address by rememberSaveable { mutableStateOf("") }
    var notes by rememberSaveable { mutableStateOf("") }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    Dialog(onDismissRequest = { if (!saving) onDismiss() }) {
        Surface(shape = RoundedCornerShape(20.dp)) {
            Column(Modifier.widthIn(max = 520.dp).verticalScroll(rememberScrollState()).padding(22.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Text(copy.newCustomer, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text(copy.customerDirectoryCreateHint, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                NativePosInput(name, { name = it.take(200) }, label = { Text(copy.customerName) }, enabled = !saving, singleLine = true, modifier = Modifier.fillMaxWidth())
                NativePosInput(phone, { phone = it.take(32) }, label = { Text(copy.detailPhone) }, enabled = !saving, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone), modifier = Modifier.fillMaxWidth())
                NativePosInput(email, { email = it.take(320) }, label = { Text(copy.detailEmail) }, enabled = !saving, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email), modifier = Modifier.fillMaxWidth())
                if (!nativeCustomerEmailValid(email)) Text(copy.customerDirectoryEmailError, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                NativePosInput(address, { address = it.take(1_000) }, label = { Text(copy.detailAddress) }, enabled = !saving, modifier = Modifier.fillMaxWidth())
                NativePosInput(notes, { notes = it.take(2_000) }, label = { Text(copy.detailCustomerNotes) }, enabled = !saving, modifier = Modifier.fillMaxWidth())
                if (!internetAvailable) Text(copy.createCustomerNeedsNetwork, color = POS_MUTED)
                error?.let { Text(nativeFeedbackText(it, copy), color = MaterialTheme.colorScheme.error) }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedButton(onClick = onDismiss, enabled = !saving, modifier = Modifier.weight(1f)) { Text(copy.cancel) }
                    Button(onClick = {
                        saving = true; error = null
                        val input = JSONObject().put("fullName", name.trim()).apply {
                            listOf("phone" to phone, "email" to email, "address" to address, "notes" to notes).forEach { (key, value) ->
                                value.trim().takeIf { it.isNotEmpty() }?.let { put(key, it) }
                            }
                        }
                        onCreate(input) { failure -> error = failure; saving = false }
                    }, enabled = internetAvailable && !saving && nativeCustomerFormValid(name, phone, email), modifier = Modifier.weight(1f)) {
                        if (saving) CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
                        Spacer(Modifier.width(6.dp))
                        Text(if (saving) copy.loading else copy.createCustomer)
                    }
                }
            }
        }
    }
}
