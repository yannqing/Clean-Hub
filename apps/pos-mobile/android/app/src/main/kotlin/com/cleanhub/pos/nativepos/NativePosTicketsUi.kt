package com.cleanhub.pos.nativepos

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

internal fun nativeTicketIsOverdue(ticket: NativeServiceTicket, now: Long): Boolean =
    ticket.ticketStatus !in setOf("picked_up", "cancelled") && ticket.expectedPickupAt?.let {
        runCatching { Instant.parse(it).toEpochMilli() < now }.getOrDefault(false)
    } == true

internal fun nativeTicketMatches(ticket: NativeServiceTicket, query: String, status: String, type: String, priority: String, phone: String? = null): Boolean =
    (status.isEmpty() || ticket.ticketStatus == status) && (type.isEmpty() || ticket.ticketType == type) &&
    (priority.isEmpty() || ticket.priority == priority) &&
    (query.isBlank() || listOfNotNull(ticket.ticketNo, ticket.customerName, phone).any { it.contains(query.trim(), ignoreCase = true) })

internal fun nativeTicketTime(value: String?, timeZone: String, language: String): String = value?.let {
    runCatching { DateTimeFormatter.ofPattern("dd MMM · HH:mm", Locale.forLanguageTag(language)).withZone(ZoneId.of(timeZone)).format(Instant.parse(it)) }.getOrNull()
} ?: "—"

@Composable
internal fun NativeTicketList(
    copy: NativePosCopy,
    tickets: List<NativeServiceTicket>,
    customers: List<NativeCustomer>,
    timeZone: String,
    language: String,
    busy: Boolean,
    internetAvailable: Boolean,
    message: String?,
    onOpen: (NativeServiceTicket) -> Unit,
    onCreate: () -> Unit,
    onRefresh: () -> Unit,
) {
    var query by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("") }
    var type by remember { mutableStateOf("") }
    var priority by remember { mutableStateOf("") }
    val phoneById = remember(customers) { customers.associate { it.id to it.phone } }
    val visible = remember(tickets, phoneById, query, status, type, priority) {
        tickets.filter { nativeTicketMatches(it, query, status, type, priority, phoneById[it.customerId]) }
            .sortedByDescending { it.createdAt }
    }
    val now = NativeServerClock.now()
    BoxWithConstraints(Modifier.fillMaxSize().padding(18.dp)) {
        val table = maxWidth >= 760.dp
        val compact = maxWidth < 500.dp
        LazyColumn(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(0.dp)) {
            item {
                if (compact) Column(Modifier.fillMaxWidth().padding(bottom = 18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(copy.ticketsTitle, color = POS_INK, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.headlineSmall)
                        Text(copy.ticketsCachedSummary.format(tickets.size), color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = onRefresh, enabled = !busy && internetAvailable, modifier = Modifier.weight(1f), shape = RoundedCornerShape(10.dp)) { Text(copy.refreshStatus) }
                        Button(onClick = onCreate, enabled = !busy && internetAvailable, modifier = Modifier.weight(1f), shape = RoundedCornerShape(10.dp)) { Text(copy.tabIntake) }
                    }
                } else Row(Modifier.fillMaxWidth().padding(bottom = 18.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(copy.ticketsTitle, color = POS_INK, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.headlineSmall)
                        Text(copy.ticketsCachedSummary.format(tickets.size), color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                    }
                    TextButton(onClick = onRefresh, enabled = !busy && internetAvailable) { Text(copy.refreshStatus) }
                    Button(onClick = onCreate, enabled = !busy && internetAvailable, shape = RoundedCornerShape(10.dp)) { Text(copy.tabIntake) }
                }
                if (maxWidth < 500.dp) Column(Modifier.fillMaxWidth().padding(bottom = 18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TicketMetric(copy.ticketPending, tickets.count { it.ticketStatus in listOf("draft","pending") }, Modifier.weight(1f))
                        TicketMetric(copy.ticketInProgress, tickets.count { it.ticketStatus == "in_progress" }, Modifier.weight(1f))
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TicketMetric(copy.ticketReadyToPick, tickets.count { it.ticketStatus == "ready_to_pick" }, Modifier.weight(1f))
                        TicketMetric(copy.ticketsOverdue, tickets.count { nativeTicketIsOverdue(it,now) }, Modifier.weight(1f), warning = true)
                    }
                } else Row(Modifier.fillMaxWidth().padding(bottom = 18.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TicketMetric(copy.ticketPending, tickets.count { it.ticketStatus in listOf("draft","pending") }, Modifier.weight(1f))
                    TicketMetric(copy.ticketInProgress, tickets.count { it.ticketStatus == "in_progress" }, Modifier.weight(1f))
                    TicketMetric(copy.ticketReadyToPick, tickets.count { it.ticketStatus == "ready_to_pick" }, Modifier.weight(1f))
                    TicketMetric(copy.ticketsOverdue, tickets.count { nativeTicketIsOverdue(it, now) }, Modifier.weight(1f), warning = true)
                }
                NativePosInput(query, { query = it }, label = { Text(copy.search) }, placeholder = { Text(copy.ticketsSearchHint) }, singleLine = true,
                    modifier = Modifier.fillMaxWidth(), trailingIcon = if (query.isNotEmpty()) ({ TextButton(onClick = { query = "" }) { Text(copy.ticketsClear) } }) else null)
                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("", "draft", "pending", "in_progress", "ready_to_pick", "picked_up", "exception", "cancelled").forEach { value ->
                        FilterChip(selected = status == value, onClick = { status = value }, label = { Text(if (value.isEmpty()) copy.ticketsAll else ticketStatusLabel(value, copy)) })
                    }
                }
                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    TicketFilter(copy.ticketType, type, listOf("" to copy.ticketsAll, "laundry" to copy.typeLaundry, "car_wash" to copy.typeCarWash)) { type = it }
                    TicketFilter(copy.ticketsPriority, priority, listOf("" to copy.ticketsAll, "normal" to copy.priorityNormal, "urgent" to copy.priorityUrgent, "critical" to copy.priorityCritical)) { priority = it }
                    if (query.isNotBlank() || status.isNotEmpty() || type.isNotEmpty() || priority.isNotEmpty()) TextButton(onClick = { query=""; status=""; type=""; priority="" }) { Text(copy.ticketsClear) }
                }
                Text(copy.ticketsResultsSummary.format(visible.size, tickets.size), color = POS_MUTED, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(vertical = 14.dp))
                message?.let { Text(it, color = POS_MUTED, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(bottom = 12.dp)) }
                if (table && visible.isNotEmpty()) Row(Modifier.fillMaxWidth().background(POS_BORDER.copy(alpha = 0.35f)).padding(14.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    TicketCell(copy.serviceTicket, Modifier.weight(1.2f), muted = true)
                    TicketCell(copy.customerName, Modifier.weight(1.3f), muted = true)
                    TicketCell(copy.ticketType, Modifier.weight(0.8f), muted = true)
                    TicketCell(copy.ticketsStatus, Modifier.weight(1f), muted = true)
                    TicketCell(copy.amountLabel, Modifier.weight(1f), muted = true)
                    TicketCell(copy.ticketsPickupLabel, Modifier.weight(1.15f), muted = true)
                }
            }
            if (visible.isEmpty()) item {
                Column(Modifier.fillMaxWidth().background(POS_PANEL_BACKGROUND, RoundedCornerShape(12.dp)).border(1.dp, POS_BORDER, RoundedCornerShape(12.dp)).padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    NativeNavigationGlyph(NativeNavigationDestination.Tickets)
                    Text(if (tickets.isEmpty()) copy.ticketsEmpty else copy.ticketsNoResults, color = POS_MUTED)
                }
            }
            items(visible, key = { it.id }) { ticket ->
                if (table) {
                    Row(Modifier.fillMaxWidth().background(POS_PANEL_BACKGROUND).clickable(enabled = !busy) { onOpen(ticket) }.padding(14.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        TicketCell(ticket.ticketNo ?: copy.serviceTicket, Modifier.weight(1.2f), strong = true)
                        Column(Modifier.weight(1.3f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            TicketCell(ticket.customerName, Modifier.fillMaxWidth(), strong = true)
                            phoneById[ticket.customerId]?.let { TicketCell(it, Modifier.fillMaxWidth(), muted = true) }
                        }
                        TicketCell(nativeTicketTypeTitle(ticket.ticketType, copy), Modifier.weight(0.8f))
                        Box(Modifier.weight(1f)) { NativeTicketStatusBadge(copy, ticket.ticketStatus) }
                        TicketCell(formatMoney(ticket.totalMinor, ticket.currency), Modifier.weight(1f))
                        Column(Modifier.weight(1.15f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(nativeTicketTime(ticket.expectedPickupAt,timeZone,language), color = if (nativeTicketIsOverdue(ticket,now)) POS_ERROR else POS_MUTED, style = MaterialTheme.typography.bodySmall)
                            if (ticket.priority != "normal") Text(ticket.priorityLabel(copy), color = POS_ERROR, style = MaterialTheme.typography.labelSmall)
                        }
                    }
                } else NativeTicketCompactRow(copy, ticket, phoneById[ticket.customerId], timeZone, language, busy) { onOpen(ticket) }
                HorizontalDivider(color = POS_BORDER)
            }
            item { Spacer(Modifier.height(24.dp)) }
        }
    }
}

@Composable
internal fun NativeTicketCompactRow(copy: NativePosCopy, ticket: NativeServiceTicket, phone: String?, timeZone: String, language: String, busy: Boolean, onOpen: () -> Unit) {
    Column(Modifier.fillMaxWidth().background(POS_PANEL_BACKGROUND).clickable(enabled = !busy, onClick = onOpen).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(ticket.ticketNo ?: copy.serviceTicket, color = POS_INK, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f))
            NativeTicketStatusBadge(copy, ticket.ticketStatus)
        }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(ticket.customerName, color = POS_INK, fontWeight = FontWeight.SemiBold)
                phone?.let { Text(it, color = POS_MUTED, style = MaterialTheme.typography.bodySmall) }
                Text("${nativeTicketTypeTitle(ticket.ticketType,copy)} · ${copy.itemsCountSuffix.format(ticket.itemCount)}", color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
            }
            Text(formatMoney(ticket.totalMinor,ticket.currency), color = POS_INK, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.bodySmall)
            Text("›", color = POS_MUTED, modifier = Modifier.padding(start = 12.dp))
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(copy.expectedPickup.format(nativeTicketTime(ticket.expectedPickupAt,timeZone,language)), modifier = Modifier.weight(1f),
                color = if (nativeTicketIsOverdue(ticket,NativeServerClock.now())) POS_ERROR else POS_MUTED, style = MaterialTheme.typography.labelSmall)
            if (ticket.priority != "normal") Text(ticket.priorityLabel(copy), color = POS_ERROR, style = MaterialTheme.typography.labelSmall)
        }
    }
}

@Composable
internal fun NativeTicketStatusBadge(copy: NativePosCopy, status: String) {
    val color = when(status) {
        "pending" -> androidx.compose.ui.graphics.Color(0xFFB45309)
        "in_progress" -> androidx.compose.ui.graphics.Color(0xFF1D4ED8)
        "ready_to_pick" -> androidx.compose.ui.graphics.Color(0xFF15803D)
        "exception", "cancelled" -> POS_ERROR
        else -> POS_MUTED
    }
    Text(ticketStatusLabel(status,copy), color = color, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Medium,
        modifier = Modifier.background(color.copy(alpha=0.08f),RoundedCornerShape(6.dp)).padding(horizontal=8.dp,vertical=5.dp))
}

@Composable
private fun TicketCell(value: String, modifier: Modifier, strong: Boolean = false, muted: Boolean = false) {
    Text(value, modifier = modifier, color = if(muted) POS_MUTED else POS_INK, style=MaterialTheme.typography.bodySmall,
        fontWeight=if(strong) FontWeight.SemiBold else FontWeight.Normal, maxLines=2, overflow=TextOverflow.Ellipsis)
}

@Composable
private fun TicketMetric(label: String, count: Int, modifier: Modifier, warning: Boolean = false) {
    Column(modifier.background(POS_PANEL_BACKGROUND,RoundedCornerShape(10.dp)).border(1.dp,POS_BORDER,RoundedCornerShape(10.dp)).padding(12.dp), verticalArrangement=Arrangement.spacedBy(6.dp)) {
        Text(label,color=POS_MUTED,style=MaterialTheme.typography.labelSmall)
        Text(count.toString(),color=if(warning && count>0) POS_ERROR else POS_INK,style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold)
    }
}

@Composable
private fun TicketFilter(title: String, value: String, options: List<Pair<String,String>>, onSelect: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        OutlinedButton(onClick={expanded=true},shape=RoundedCornerShape(8.dp)) { Text("$title · ${options.firstOrNull { it.first==value }?.second.orEmpty()} ▾",style=MaterialTheme.typography.labelMedium) }
        DropdownMenu(expanded=expanded,onDismissRequest={expanded=false}) {
            options.forEach { (key,label) -> DropdownMenuItem(text={Text(label)},onClick={onSelect(key);expanded=false}) }
        }
    }
}

private fun nativeTicketTypeTitle(value: String, copy: NativePosCopy) = when(value) {
    "laundry" -> copy.typeLaundry
    "car_wash" -> copy.typeCarWash
    else -> value
}
