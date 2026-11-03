package com.cleanhub.pos.nativepos

import org.junit.Assert.*
import org.junit.Test

class NativeTicketListTest {
    private val ticket=NativeServiceTicket("id","T-020","customer","Amina","laundry","ready_to_pick","urgent",3,120000,"XOF","2026-10-13T12:00:00Z","2026-10-12T12:00:00Z","2026-10-12T12:00:00Z",1)
    @Test fun combinesTextPhoneAndExactFilters() {
        assertTrue(nativeTicketMatches(ticket,"amin","ready_to_pick","laundry","urgent"))
        assertTrue(nativeTicketMatches(ticket," t-020 ","","",""))
        assertTrue(nativeTicketMatches(ticket,"77123","","","","+221771234567"))
        assertFalse(nativeTicketMatches(ticket,"Amina","pending","laundry","urgent"))
        assertFalse(nativeTicketMatches(ticket,"Amina","","car_wash",""))
    }
    @Test fun overdueExcludesClosedTicketsAndInvalidDates() {
        val now=java.time.Instant.parse("2026-10-14T12:00:00Z").toEpochMilli()
        assertTrue(nativeTicketIsOverdue(ticket,now))
        assertFalse(nativeTicketIsOverdue(ticket.copy(ticketStatus="picked_up"),now))
        assertFalse(nativeTicketIsOverdue(ticket.copy(ticketStatus="cancelled"),now))
        assertFalse(nativeTicketIsOverdue(ticket.copy(expectedPickupAt="invalid"),now))
    }
    @Test fun pickupTimesUseTheBranchTimeZone() {
        assertEquals("13 Oct · 12:00",nativeTicketTime(ticket.expectedPickupAt,"Africa/Dakar","en"))
        assertEquals("13 Oct · 20:00",nativeTicketTime(ticket.expectedPickupAt,"Asia/Shanghai","en"))
    }
}
