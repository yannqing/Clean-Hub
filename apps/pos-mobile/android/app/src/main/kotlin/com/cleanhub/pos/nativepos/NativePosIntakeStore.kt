package com.cleanhub.pos.nativepos

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.Instant
import org.json.JSONObject

internal val NATIVE_INTAKE_REPLAY_LOCK = Any()

internal data class NativeIntakeOperation(
    val id: String,
    val ticketId: String,
    val kind: String,
    val userId: String,
    val payload: String,
    val local: String,
    val status: String,
    val attempt: Int,
    val error: String?,
    val httpStatus: Int = 0,
)

/** Separate durable outbox: refreshing reference tables must never erase accepted intake work. */
internal class NativePosIntakeStore(context: Context) :
    SQLiteOpenHelper(context, "cleanhub_native_intake.db", null, 1) {
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """CREATE TABLE intake_operation (
            id TEXT PRIMARY KEY, ticket_id TEXT NOT NULL, kind TEXT NOT NULL,
            tenant_id TEXT NOT NULL, branch_id TEXT NOT NULL, terminal_id TEXT NOT NULL, user_id TEXT NOT NULL,
            payload TEXT NOT NULL, local TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
            attempt INTEGER NOT NULL DEFAULT 0, error TEXT, http_status INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)"""
        )
        db.execSQL(
            "CREATE INDEX intake_scope ON intake_operation(tenant_id, branch_id, terminal_id, status)"
        )
        db.execSQL(
            "CREATE TABLE detail_cache (scope TEXT NOT NULL, kind TEXT NOT NULL, id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(scope, kind, id))"
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit

    private fun scope(t: NativeTerminal) = "${t.tenantId}:${t.branchId}:${t.terminalId}"

    fun operations(t: NativeTerminal, ticketId: String? = null): List<NativeIntakeOperation> =
        readableDatabase
            .rawQuery(
                "SELECT id,ticket_id,kind,user_id,payload,local,status,attempt,error,http_status FROM intake_operation WHERE tenant_id=? AND branch_id=? AND terminal_id=?" +
                    (if (ticketId == null) "" else " AND ticket_id=?") +
                    " ORDER BY CASE kind WHEN 'ticket' THEN 0 ELSE 1 END, created_at, rowid",
                arrayOf(t.tenantId, t.branchId, t.terminalId) +
                    (ticketId?.let { arrayOf(it) } ?: emptyArray()),
            )
            .use { c ->
                buildList {
                    while (c.moveToNext()) add(
                        NativeIntakeOperation(
                            c.getString(0),
                            c.getString(1),
                            c.getString(2),
                            c.getString(3),
                            c.getString(4),
                            c.getString(5),
                            c.getString(6),
                            c.getInt(7),
                            if (c.isNull(8)) null else c.getString(8),
                            c.getInt(9),
                        )
                    )
                }
            }

    fun hasUnsentWork(): Boolean =
        readableDatabase
            .rawQuery("SELECT 1 FROM intake_operation WHERE status!='synced' LIMIT 1", null)
            .use { it.moveToFirst() }

    fun unsent(t: NativeTerminal, ticketId: String) =
        operations(t, ticketId).filter { it.status != "synced" }

    fun retry(t: NativeTerminal, ticketId: String) {
        writableDatabase.update(
            "intake_operation",
            ContentValues().apply {
                put("status", "pending")
                put("attempt", 0)
                putNull("error")
            },
            "tenant_id=? AND branch_id=? AND terminal_id=? AND user_id=? AND ticket_id=? AND status='failed'",
            arrayOf(t.tenantId, t.branchId, t.terminalId, t.userId, ticketId),
        )
    }

    fun attempt(id: String) {
        writableDatabase.execSQL(
            "UPDATE intake_operation SET attempt=attempt+1 WHERE id=?",
            arrayOf(id),
        )
    }

    fun failed(id: String, error: String, permanent: Boolean, httpStatus: Int = 0) {
        writableDatabase.update(
            "intake_operation",
            ContentValues().apply {
                put("error", error)
                put("http_status", httpStatus)
                put("status", if (permanent) "failed" else "pending")
            },
            "id=?",
            arrayOf(id),
        )
    }

    /** Only an explicit server rejection can be removed; a lost response may have committed. */
    fun discardRejected(t: NativeTerminal, id: String) =
        synchronized(NATIVE_INTAKE_REPLAY_LOCK) {
            writableDatabase.beginTransaction()
            try {
                val op = operations(t).firstOrNull { it.id == id } ?: return
                require(
                    op.userId == t.userId &&
                        op.status == "failed" &&
                        op.httpStatus in setOf(400, 404, 422)
                )
                if (op.kind == "ticket")
                    writableDatabase.delete(
                        "intake_operation",
                        "tenant_id=? AND branch_id=? AND terminal_id=? AND ticket_id=?",
                        arrayOf(t.tenantId, t.branchId, t.terminalId, op.ticketId),
                    )
                else writableDatabase.delete("intake_operation", "id=?", arrayOf(id))
                writableDatabase.setTransactionSuccessful()
            } finally {
                writableDatabase.endTransaction()
            }
        }

    fun acknowledge(id: String, response: JSONObject) {
        // Item DTOs omit currency. Preserve the original ticket currency across store
        // reconfiguration.
        if (!response.has("currency")) {
            val currency =
                readableDatabase
                    .rawQuery("SELECT local FROM intake_operation WHERE id=?", arrayOf(id))
                    .use {
                        if (it.moveToFirst()) JSONObject(it.getString(0)).nativeText("currency")
                        else null
                    }
            currency?.let { response.put("currency", it) }
        }
        writableDatabase.update(
            "intake_operation",
            ContentValues().apply {
                put("status", "synced")
                put("local", response.toString())
                putNull("error")
            },
            "id=?",
            arrayOf(id),
        )
    }

    fun cache(t: NativeTerminal, kind: String, id: String, body: JSONObject) {
        writableDatabase.insertWithOnConflict(
            "detail_cache",
            null,
            ContentValues().apply {
                put("scope", scope(t))
                put("kind", kind)
                put("id", id)
                put("body", body.toString())
            },
            SQLiteDatabase.CONFLICT_REPLACE,
        )
    }

    fun cached(t: NativeTerminal, kind: String, id: String): JSONObject? =
        readableDatabase
            .rawQuery(
                "SELECT body FROM detail_cache WHERE scope=? AND kind=? AND id=?",
                arrayOf(scope(t), kind, id),
            )
            .use { if (it.moveToFirst()) JSONObject(it.getString(0)) else null }

    fun ticketJson(t: NativeTerminal, id: String): JSONObject? =
        cached(t, "ticket", id)
            ?: operations(t, id).firstOrNull { it.kind == "ticket" }?.let { JSONObject(it.local) }

    fun mergeTickets(
        t: NativeTerminal,
        base: List<NativeServiceTicket>,
    ): List<NativeServiceTicket> {
        val result = base.associateBy { it.id }.toMutableMap()
        readableDatabase
            .rawQuery(
                "SELECT body FROM detail_cache WHERE scope=? AND kind='ticket'",
                arrayOf(scope(t)),
            )
            .use { c ->
                while (c.moveToNext()) {
                    val ticket = JSONObject(c.getString(0)).nativeTicket(t.currency)
                    if ((result[ticket.id]?.version ?: -1) <= ticket.version)
                        result[ticket.id] = ticket
                }
            }
        val ops = operations(t)
        ops.filter { it.kind == "ticket" }
            .forEach { op ->
                if (op.status != "synced" || op.id !in result)
                    result[op.id] = JSONObject(op.local).nativeTicket(t.currency)
            }
        // Pending item amounts are only estimates, never a substitute for server-confirmed pricing.
        ops.filter { it.kind == "item" && it.status != "synced" }
            .groupBy { it.ticketId }
            .forEach { (id, items) ->
                result[id]?.let { ticket ->
                    result[id] =
                        ticket.copy(
                            itemCount = ticket.itemCount + items.size,
                            totalMinor =
                                ticket.totalMinor +
                                    items.sumOf {
                                        JSONObject(it.local)
                                            .nativeItem(id, t.currency)
                                            .lineAmountMinor
                                    },
                        )
                }
            }
        return result.values.sortedByDescending { it.updatedAt }
    }

    fun mergeItems(
        t: NativeTerminal,
        ticketId: String,
        base: List<NativeTicketItem>,
    ): List<NativeTicketItem> {
        val result = base.associateBy { it.id }.toMutableMap()
        operations(t, ticketId)
            .filter { it.kind == "item" }
            .forEach { op ->
                if (op.status != "synced" || op.id !in result)
                    result[op.id] = JSONObject(op.local).nativeItem(ticketId, t.currency)
            }
        return result.values.toList()
    }

    /**
     * The canonical detail now owns acknowledged rows, including removals made on another terminal.
     */
    fun confirmItems(t: NativeTerminal, ticketId: String) {
        writableDatabase.delete(
            "intake_operation",
            "tenant_id=? AND branch_id=? AND terminal_id=? AND ticket_id=? AND kind='item' AND status='synced'",
            arrayOf(t.tenantId, t.branchId, t.terminalId, ticketId),
        )
    }

    private fun save(
        t: NativeTerminal,
        id: String,
        ticketId: String,
        kind: String,
        payload: JSONObject,
        local: JSONObject,
    ) {
        writableDatabase.insertOrThrow(
            "intake_operation",
            null,
            ContentValues().apply {
                put("id", id)
                put("ticket_id", ticketId)
                put("kind", kind)
                put("tenant_id", t.tenantId)
                put("branch_id", t.branchId)
                put("terminal_id", t.terminalId)
                put("user_id", t.userId)
                put("payload", payload.put("id", id).put("operatorUserId", t.userId).toString())
                put("local", local.toString())
                put("created_at", NativeServerClock.now())
            },
        )
    }

    fun createTicket(
        t: NativeTerminal,
        customer: NativeCustomer,
        type: String,
        priority: String,
        remark: String,
        pickup: String?,
    ): String {
        require(customer.status == "active")
        val id = NativeUlid.create()
        val payload =
            JSONObject()
                .put("customerId", customer.id)
                .put("branchId", t.branchId)
                .put("ticketType", type)
                .put("priority", priority)
                .put("sourceChannel", "pos")
        if (remark.isNotBlank()) payload.put("remark", remark.trim())
        pickup?.let { payload.put("expectedPickupAt", it) }
        val local =
            JSONObject(payload.toString())
                .put("id", id)
                .put("ticketNo", "LOCAL-${id.takeLast(8)}")
                .put("customerName", customer.fullName)
                .put("customerProfilePhone", customer.phone)
                .put("ticketStatus", "draft")
                .put("currency", t.currency)
                .put("itemCount", 0)
                .put("totalAmount", "0")
                .put("version", 0)
                .put("createdAt", Instant.ofEpochMilli(NativeServerClock.now()).toString())
                .put("updatedAt", Instant.ofEpochMilli(NativeServerClock.now()).toString())
        save(t, id, id, "ticket", payload, local)
        return id
    }

    fun createItem(
        t: NativeTerminal,
        ticket: NativeServiceTicket,
        draft: NativeTicketItemDraft,
    ): String {
        require(ticket.ticketStatus !in setOf("cancelled", "picked_up"))
        require(
            draft.service.currency == ticket.currency &&
                draft.service.businessLine == ticket.ticketType &&
                draft.itemType in draft.service.applicableItemTypes
        )
        require(draft.quantity in 1..9999)
        val unit = draft.chargedUnitAmountMinor ?: draft.service.amountMinor
        require(
            unit >= 0 &&
                (draft.chargedUnitAmountMinor == null || !draft.overrideReason.isNullOrBlank())
        )
        val amount =
            if (draft.service.pricingUnit == "per_kg") {
                val weight = BigDecimal(draft.weight ?: "0")
                require(weight.signum() > 0 && weight.scale() <= 3 && draft.bagCount in 1L..9999L)
                BigDecimal(unit).multiply(weight).setScale(0, RoundingMode.HALF_UP).longValueExact()
            } else Math.multiplyExact(unit, draft.quantity)
        val id = NativeUlid.create()
        val payload =
            JSONObject().put("serviceId", draft.service.id).put("itemType", draft.itemType)
        if (draft.service.pricingUnit == "per_kg")
            payload
                .put("weight", BigDecimal(draft.weight).stripTrailingZeros().toPlainString())
                .put("bagCount", draft.bagCount)
        else payload.put("quantity", draft.quantity)
        listOf(
                "catalogItemId" to draft.catalogItemId,
                "itemCategory" to draft.itemCategory,
                "itemColor" to draft.itemColor,
                "itemBrand" to draft.itemBrand,
                "itemMaterial" to draft.itemMaterial,
                "defectNotes" to draft.defectNotes,
                "specialRequest" to draft.specialRequest,
                "remark" to draft.remark,
            )
            .forEach { (key, value) ->
                value?.trim()?.takeIf { it.isNotEmpty() }?.let { payload.put(key, it) }
            }
        if (draft.chargedUnitAmountMinor != null)
            payload
                .put("chargedUnitAmount", BigDecimal(unit).movePointLeft(2).toPlainString())
                .put("overrideReason", draft.overrideReason)
        val local =
            JSONObject(payload.toString())
                .put("id", id)
                .put("itemName", draft.service.name)
                .put("itemTypeName", draft.itemTypeName)
                .put("currency", draft.service.currency)
                .put("itemStatus", "pending_wash")
                .put("pricingUnit", draft.service.pricingUnit)
                .put(
                    "standardUnitAmount",
                    BigDecimal(draft.service.amountMinor).movePointLeft(2).toPlainString(),
                )
                .put("chargedUnitAmount", BigDecimal(unit).movePointLeft(2).toPlainString())
                .put("lineAmount", BigDecimal(amount).movePointLeft(2).toPlainString())
        save(t, id, ticket.id, "item", payload, local)
        return id
    }
}

internal fun JSONObject.nativeText(key: String): String? =
    optString(key).takeIf { it.isNotBlank() && it != "null" }

internal fun JSONObject.nativeTicket(currency: String): NativeServiceTicket =
    NativeServiceTicket(
        id = getString("id"),
        ticketNo = nativeText("ticketNo"),
        customerId = getString("customerId"),
        customerName =
            nativeText("customerName")
                ?: nativeText("customerProfileName")
                ?: nativePosCopy(null).customerFallback,
        ticketType = optString("ticketType", "laundry"),
        ticketStatus = optString("ticketStatus", "draft"),
        priority = optString("priority", "normal"),
        itemCount = optLong("itemCount"),
        totalMinor = BigDecimal(optString("totalAmount", "0")).movePointRight(2).longValueExact(),
        currency = nativeText("currency") ?: currency,
        expectedPickupAt = nativeText("expectedPickupAt"),
        createdAt = optString("createdAt"),
        updatedAt = optString("updatedAt", optString("createdAt")),
        version = optLong("version", 1),
    )

internal fun JSONObject.nativeItem(ticketId: String, currency: String): NativeTicketItem =
    NativeTicketItem(
        id = getString("id"),
        ticketId = ticketId,
        serviceId = nativeText("serviceId"),
        itemName = optString("itemName"),
        itemType = nativeText("itemType"),
        catalogItemId = nativeText("catalogItemId"),
        itemTypeName = nativeText("itemTypeName"),
        itemCategory = nativeText("itemCategory"),
        itemColor = nativeText("itemColor"),
        itemBrand = nativeText("itemBrand"),
        itemMaterial = nativeText("itemMaterial"),
        itemStatus = optString("itemStatus", "pending_wash"),
        quantity = optLong("quantity", 1),
        pricingUnit = optString("pricingUnit", "per_item"),
        standardUnitAmountMinor =
            BigDecimal(optString("standardUnitAmount", optString("unitAmount", "0")))
                .movePointRight(2)
                .longValueExact(),
        chargedUnitAmountMinor =
            BigDecimal(optString("chargedUnitAmount", optString("unitAmount", "0")))
                .movePointRight(2)
                .longValueExact(),
        lineAmountMinor =
            BigDecimal(optString("lineAmount", "0")).movePointRight(2).longValueExact(),
        currency = nativeText("currency") ?: currency,
        weight = nativeText("weight"),
        bagCount = optLong("bagCount").takeIf { it > 0 },
        labelCode = nativeText("labelCode"),
        defectNotes = nativeText("defectNotes"),
        specialRequest = nativeText("specialRequest"),
        remark = nativeText("remark"),
    )
