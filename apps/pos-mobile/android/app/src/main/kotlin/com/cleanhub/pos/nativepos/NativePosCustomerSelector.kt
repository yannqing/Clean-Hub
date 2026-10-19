package com.cleanhub.pos.nativepos

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay

internal fun nativeCustomerMatches(customer: NativeCustomer, query: String): Boolean =
    customer.status == "active" && (query.isBlank() || listOfNotNull(customer.fullName, customer.accountName, customer.phone, customer.email)
        .any { it.contains(query.trim(), ignoreCase = true) })

internal fun canChangeNativeCartCustomer(cart: NativePosCart, customer: NativeCustomer?): Boolean =
    cart.ticketItems.isEmpty() || cart.customer?.id == customer?.id

@Composable
internal fun NativeSaleCustomerSelector(
    copy: NativePosCopy,
    cart: NativePosCart,
    customers: List<NativeCustomer>,
    internetAvailable: Boolean,
    busy: Boolean,
    onSearch: suspend (String) -> List<NativeCustomer>,
    onSelect: (NativeCustomer?) -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    val locked = cart.ticketItems.isNotEmpty()
    OutlinedButton(
        onClick = { open = true }, enabled = !busy && !locked,
        modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), contentPadding = PaddingValues(12.dp),
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(copy.customerLabel, color = POS_MUTED, style = MaterialTheme.typography.labelSmall)
            Text(cart.customer?.name ?: copy.walkInCustomer, color = POS_INK, fontWeight = FontWeight.SemiBold)
        }
        Text(copy.customerSelect, style = MaterialTheme.typography.labelMedium)
    }
    if (locked) Text(copy.customerLockedHint, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
    if (!open || busy || locked) return
    var query by remember { mutableStateOf("") }
    var options by remember { mutableStateOf(customers.filter { nativeCustomerMatches(it, "") }.take(30)) }
    var loading by remember { mutableStateOf(internetAvailable) }
    var failed by remember { mutableStateOf(false) }
    var retry by remember { mutableStateOf(0) }
    LaunchedEffect(query, internetAvailable, customers, retry) {
        options = customers.filter { nativeCustomerMatches(it, query) }.take(30)
        failed = false
        loading = internetAvailable
        if (internetAvailable) {
            delay(250)
            try {
                options = onSearch(query.trim()).filter { it.status == "active" }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                failed = true
            } finally {
                loading = false
            }
        }
    }
    Dialog(onDismissRequest = { open = false }, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        BoxWithConstraints(Modifier.fillMaxSize().systemBarsPadding().imePadding().padding(16.dp), contentAlignment = Alignment.Center) {
        Surface(Modifier.widthIn(max = 520.dp).fillMaxWidth().heightIn(max = maxHeight), color = POS_PANEL_BACKGROUND, shape = RoundedCornerShape(24.dp)) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(copy.customerSelect, modifier = Modifier.weight(1f), color = POS_INK, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleLarge)
                    TextButton(onClick = { open = false }) { Text(copy.close) }
                }
                NativePosInput(query, { query = it }, placeholder = { Text(copy.customerSearchHint) }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedButton(onClick = { onSelect(null); open = false }, modifier = Modifier.fillMaxWidth()) {
                    Text(copy.walkInCustomer, Modifier.weight(1f))
                    if (cart.customer == null) Text("✓")
                }
                if (!internetAvailable) Text(copy.customerOfflineHint, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                if (loading) LinearProgressIndicator(Modifier.fillMaxWidth())
                if (failed) {
                    Text(copy.customerSearchFailed, color = POS_ERROR, style = MaterialTheme.typography.bodySmall)
                    TextButton(onClick = { retry++ }) { Text(copy.refreshOrders) }
                }
                LazyColumn(Modifier.fillMaxWidth().weight(1f, fill = false).heightIn(max = 320.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(options, key = { it.id }) { customer ->
                        Surface(Modifier.fillMaxWidth().clickable { onSelect(customer); open = false }, shape = RoundedCornerShape(12.dp), color = if (cart.customer?.id == customer.id) POS_PAGE_BACKGROUND else POS_PANEL_BACKGROUND) {
                            Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                                    Text(customer.fullName, color = POS_INK, fontWeight = FontWeight.SemiBold)
                                    Text(listOfNotNull(customer.accountName.takeIf { it != customer.fullName }, customer.phone, customer.email).joinToString(" · ").ifBlank { copy.noContactOnFile }, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                                }
                                if (cart.customer?.id == customer.id) Text("✓", color = POS_ACCENT)
                            }
                        }
                    }
                    if (!loading && options.isEmpty()) item { Text(copy.customerNoResults, color = POS_MUTED, modifier = Modifier.padding(12.dp)) }
                }
            }
        }
    }
}
}
