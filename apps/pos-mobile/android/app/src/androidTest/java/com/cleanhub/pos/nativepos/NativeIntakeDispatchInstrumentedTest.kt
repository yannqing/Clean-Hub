package com.cleanhub.pos.nativepos

import android.content.Context
import android.content.ContextWrapper
import android.database.DatabaseErrorHandler
import android.database.sqlite.SQLiteDatabase
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class NativeIntakeDispatchInstrumentedTest {
    private lateinit var context: Context
    private lateinit var db: NativePosDatabase
    private lateinit var terminal: NativeTerminal
    private val files = listOf("cleanhub_native_pos.db", "cleanhub_native_intake.db")
    private val customer =
        NativeCustomer("customer", "account", "Amina", "Family", "123", null, "active")
    private val service =
        NativeService(
            "service",
            "Wash",
            "laundry",
            "per_item",
            150000,
            "XOF",
            "cloth",
            listOf("cloth"),
            null,
        )

    @Before
    fun setup() {
        val base = InstrumentationRegistry.getInstrumentation().targetContext
        val prefix = "intake-test-${NativeUlid.create()}-"
        context =
            object : ContextWrapper(base) {
                override fun getApplicationContext(): Context = this

                override fun getDatabasePath(name: String) = base.getDatabasePath(prefix + name)

                override fun openOrCreateDatabase(
                    name: String,
                    mode: Int,
                    factory: SQLiteDatabase.CursorFactory?,
                ) = base.openOrCreateDatabase(prefix + name, mode, factory)

                override fun openOrCreateDatabase(
                    name: String,
                    mode: Int,
                    factory: SQLiteDatabase.CursorFactory?,
                    handler: DatabaseErrorHandler?,
                ) = base.openOrCreateDatabase(prefix + name, mode, factory, handler)
            }
        db = NativePosDatabase(context)
        terminal =
            NativeTerminal(
                "tenant",
                "branch",
                "terminal",
                "cashier",
                "cashier",
                "Africa/Dakar",
                1,
                "XOF",
                "Merchant",
                "Store",
                System.currentTimeMillis(),
            )
        db.replaceSnapshot(
            terminal,
            emptyList(),
            null,
            services = listOf(service),
            customers = listOf(customer),
            tickets = emptyList(),
        )
    }

    @After
    fun cleanup() {
        db.intakeStore.close()
        db.close()
        files.forEach { SQLiteDatabase.deleteDatabase(context.getDatabasePath(it)) }
    }

    private fun ticket(): String =
        db.intakeStore.createTicket(
            terminal,
            customer,
            "laundry",
            "urgent",
            "Handle carefully",
            null,
        )

    private fun item(ticketId: String): String =
        db.intakeStore.createItem(
            terminal,
            db.snapshot().tickets.first { it.id == ticketId },
            NativeTicketItemDraft(
                service,
                "cloth",
                2,
                null,
                null,
                "Shirt",
                "Blue",
                "Brand",
                "Cotton",
                "Stain",
                "No starch",
                "Note",
                catalogItemId = "01M4D63YHY2FMC9WS6RFHRRCXM",
                itemTypeName = "Clothing",
            ),
        )

    private fun gateway(block: (String, JSONObject) -> JSONObject) =
        object : NativeIntakeGateway {
            override fun prepare(terminal: NativeTerminal) = true

            override fun submit(path: String, payload: JSONObject) = block(path, payload)
        }

    private fun confirmation(path: String, payload: JSONObject): JSONObject =
        if (path.endsWith("/items"))
            JSONObject(payload.toString())
                .put("ticketId", path.split('/')[3])
                .put("itemName", "Wash")
                .put("itemTypeName", "Clothing")
                .put("lineAmount", "3000.00")
                .put("standardUnitAmount", "1500.00")
                .put("chargedUnitAmount", "1500.00")
        else
            JSONObject(payload.toString())
                .put("currency", "XOF")
                .put("ticketStatus", "draft")
                .put("customerName", "Amina")
                .put("ticketNo", "TK-1")

    @Test
    fun locallyAcceptedTicketAndItemsSurviveRestartAndReferenceRefresh() {
        val id = ticket()
        val itemId = item(id)
        db.intakeStore.close()
        db.close()
        db = NativePosDatabase(context)
        db.replaceSnapshot(
            terminal,
            emptyList(),
            null,
            services = listOf(service),
            customers = listOf(customer),
            tickets = emptyList(),
        )
        val detail =
            db.decorateTicket(
                NativeTicketDetail(db.snapshot().tickets.single(), db.ticketItems(id))
            )
        assertEquals(id, detail.ticket.id)
        assertEquals(itemId, detail.items.single().id)
        assertEquals("01M4D63YHY2FMC9WS6RFHRRCXM", detail.items.single().catalogItemId)
        assertEquals("Clothing", detail.items.single().itemTypeName)
        assertEquals(300000L, detail.items.single().lineAmountMinor)
        assertEquals(setOf(id, itemId), detail.unsentIntakeIds)
        assertEquals(2, db.snapshot().pendingIntakes)
        assertTrue(db.intakeStore.hasUnsentWork())
    }

    @Test
    fun responseLossRetriesIdenticalPayloadAndParentPrecedesItems() {
        val id = ticket()
        item(id)
        val sent = mutableListOf<Pair<String, String>>()
        val engine =
            NativePosSyncEngine(
                context,
                gateway { path, payload ->
                    sent.add(path to payload.toString())
                    if (sent.size == 1)
                        throw NativePosApiException(0, "NETWORK_ERROR", "Lost response")
                    confirmation(path, payload)
                },
            )
        assertThrows(NativePosApiException::class.java) { engine.synchronizeIntakes(id) }
        assertEquals(2, db.intakeStore.unsent(terminal, id).size)
        engine.synchronizeIntakes(id)
        assertEquals(sent[0], sent[1])
        assertTrue(sent.last().first.endsWith("/items"))
        assertTrue(db.intakeStore.unsent(terminal, id).isEmpty())
        engine.synchronizeIntakes(id)
        assertEquals(3, sent.size)
    }

    @Test
    fun mismatchedConfirmationDoesNotAcknowledgeOrSendChildItems() {
        val id = ticket()
        item(id)
        var calls = 0
        val engine =
            NativePosSyncEngine(
                context,
                gateway { _, _ ->
                    calls++
                    JSONObject().put("id", "wrong")
                },
            )
        assertThrows(NativePosApiException::class.java) { engine.synchronizeIntakes(id) }
        assertEquals(1, calls)
        assertEquals(2, db.intakeStore.unsent(terminal, id).size)
    }

    @Test
    fun staffHandoverAndDifferentTenantNeverReplayAnotherOperatorsWork() {
        val id = ticket()
        item(id)
        db.replaceSnapshot(terminal.copy(userId = "other"), emptyList(), null)
        val engine =
            NativePosSyncEngine(
                context,
                gateway { _, _ -> throw AssertionError("Must not upload another operator's work") },
            )
        engine.synchronizeIntakes(id)
        assertEquals(2, db.intakeStore.unsent(terminal, id).size)
        val detail =
            db.decorateTicket(
                NativeTicketDetail(db.snapshot().tickets.single(), db.ticketItems(id))
            )
        assertTrue(detail.needsOriginalOperator)
        db.replaceSnapshot(
            terminal.copy(tenantId = "other-tenant"),
            emptyList(),
            null,
            tickets = emptyList(),
        )
        engine.synchronizeIntakes(id)
        assertTrue(db.snapshot().tickets.isEmpty())
        assertTrue(db.ticketItems(id).isEmpty())
    }

    @Test
    fun rejectedParentBlocksChildrenAndCanBeRetriedWithoutNewIds() {
        val id = ticket()
        item(id)
        var calls = 0
        val rejected =
            NativePosSyncEngine(
                context,
                gateway { _, _ ->
                    calls++
                    throw NativePosApiException(422, "CUSTOMER_DISABLED", "Disabled")
                },
            )
        rejected.synchronizeIntakes(id)
        assertEquals(1, calls)
        assertEquals("failed", db.intakeStore.operations(terminal, id).first().status)
        val resumed =
            NativePosSyncEngine(context, gateway { path, payload -> confirmation(path, payload) })
        resumed.synchronizeIntakes(id, true)
        assertTrue(db.intakeStore.unsent(terminal, id).isEmpty())
    }

    @Test
    fun targetedReplayDoesNotWaitForUnrelatedOlderTickets() {
        val first = ticket()
        val second = ticket()
        item(second)
        val sent = mutableListOf<String>()
        NativePosSyncEngine(
                context,
                gateway { path, payload ->
                    sent.add(payload.getString("id"))
                    confirmation(path, payload)
                },
            )
            .synchronizeIntakes(second)
        assertFalse(first in sent)
        assertEquals("pending", db.intakeStore.operations(terminal, first).single().status)
        assertEquals(2, sent.size)
    }

    @Test
    fun onlyExplicitlyRejectedCreationCanBeRemovedAndChildrenAreRemovedTogether() {
        val id = ticket()
        item(id)
        db.intakeStore.failed(id, "Lost reply", true, 0)
        assertThrows(IllegalArgumentException::class.java) {
            db.intakeStore.discardRejected(terminal, id)
        }
        assertEquals(2, db.intakeStore.unsent(terminal, id).size)
        db.intakeStore.failed(id, "Customer disabled", true, 422)
        assertThrows(IllegalArgumentException::class.java) {
            db.intakeStore.discardRejected(terminal.copy(userId = "other"), id)
        }
        db.intakeStore.discardRejected(terminal, id)
        assertTrue(db.intakeStore.operations(terminal, id).isEmpty())
        assertTrue(db.snapshot().tickets.isEmpty())
    }

    @Test
    fun staleOfflineSessionMaySynchronizeAfterAuthoritativeOnlineScopeCheck() {
        val id = ticket()
        db.replaceSnapshot(
            terminal.copy(lastSyncedAt = System.currentTimeMillis() - 9 * 60 * 60 * 1000L),
            emptyList(),
            null,
        )
        assertNull(db.snapshot().terminal)
        NativePosSyncEngine(context, gateway { path, payload -> confirmation(path, payload) })
            .synchronizeIntakes(id)
        assertTrue(db.intakeStore.unsent(terminal, id).isEmpty())
    }

    @Test
    fun oldServerCapabilityFailureRetainsWorkWithoutSendingAnyCreateRequest() {
        val id = ticket()
        item(id)
        val gateway =
            object : NativeIntakeGateway {
                override fun prepare(terminal: NativeTerminal): Boolean =
                    throw NativePosApiException(409, "INTAKE_SYNC_UNAVAILABLE", "Upgrade server")

                override fun submit(path: String, payload: JSONObject): JSONObject =
                    throw AssertionError("No creation on an incompatible server")
            }
        assertThrows(NativePosApiException::class.java) {
            NativePosSyncEngine(context, gateway).synchronizeIntakes(id)
        }
        assertEquals(2, db.intakeStore.unsent(terminal, id).size)
        assertEquals(0, db.intakeStore.operations(terminal, id).first().attempt)
        assertEquals("Upgrade server", db.intakeStore.operations(terminal, id).first().error)
    }

    @Test
    fun canonicalDetailRemovesAcknowledgedItemsDeletedOnAnotherTerminal() {
        val id = ticket()
        val itemId = item(id)
        NativePosSyncEngine(context, gateway { path, payload -> confirmation(path, payload) })
            .synchronizeIntakes(id)
        assertEquals(itemId, db.ticketItems(id).single().id)
        db.replaceTicketItems(id, emptyList())
        db.intakeStore.confirmItems(terminal, id)
        assertTrue(db.ticketItems(id).isEmpty())
    }

    @Test
    fun localItemCurrencyDoesNotChangeWhenTheStoreDefaultChanges() {
        val id = ticket()
        item(id)
        NativePosSyncEngine(context, gateway { path, payload -> confirmation(path, payload) })
            .synchronizeIntakes(id)
        db.replaceSnapshot(terminal.copy(currency = "GNF"), emptyList(), null)
        assertEquals("XOF", db.ticketItems(id).single().currency)
        assertEquals("XOF", db.snapshot().tickets.single().currency)
    }
}
