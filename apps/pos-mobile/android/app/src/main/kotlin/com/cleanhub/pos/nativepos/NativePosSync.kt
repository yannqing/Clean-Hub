package com.cleanhub.pos.nativepos

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.math.BigDecimal
import java.math.RoundingMode
import java.util.concurrent.TimeUnit
import org.json.JSONArray
import org.json.JSONObject

data class NativeSyncResult(val replayedSales: Int, val failedSales: Int)

/**
 * How many times one offline sale is replayed before it is parked.
 *
 * Deliberately generous, because a failing network is the *normal* offline
 * case and a sale must not be abandoned over a bad afternoon. The cap only
 * bounds a command the server will never accept, which would otherwise be
 * retried forever with nobody told. Matches OFFLINE_QUEUE_MAX_ATTEMPTS in
 * packages/offline, which the web terminal uses for the same purpose.
 */
internal const val NATIVE_REPLAY_MAX_ATTEMPTS = 25

/**
 * Whether a failed replay should be retried rather than parked.
 *
 * A lost connection (status 0), an expired session (401/403) or a server fault
 * (5xx) says nothing about the command itself, so it stays pending and is tried
 * again. Anything else is the server rejecting this particular sale -- a price
 * change, a deleted product -- and retrying it forever would only block the
 * queue behind it.
 */
internal fun isTransientReplayFailure(error: NativePosApiException): Boolean =
    error.status == 0 || error.status == 401 || error.status == 403 || error.status >= 500

/** Synchronizes immutable local cash commands before refreshing POS reference data. */
class NativePosSyncEngine(context: Context) {
    private val database = NativePosDatabase(context.applicationContext)
    private val api = NativePosApiClient(NativePosSession(context.applicationContext))

    fun synchronize(): NativeSyncResult {
        refreshSnapshot()
        var replayed = 0
        var failed = 0
        var deferred: NativePosApiException? = null
        for (command in database.listPendingCheckouts()) {
            // Once the connection or the session is gone, every remaining
            // command would fail the same way. Stop asking, but keep whatever
            // already replayed rather than discarding the run.
            if (deferred != null) break
            val attempt = database.recordCheckoutAttempt(command.operationId)
            try {
                api.post("/pos/orders/checkout", JSONObject(command.payloadJson))
                database.markCheckoutSynced(command.operationId)
                markReplayedTicketItemsBilled(command.payloadJson)
                replayed += 1
            } catch (error: NativePosApiException) {
                if (isTransientReplayFailure(error) && attempt < NATIVE_REPLAY_MAX_ATTEMPTS) {
                    // Transient: the command stays pending and is retried on the
                    // next run. Recorded rather than thrown immediately so the
                    // sales replayed before it are still committed locally.
                    deferred = error
                } else {
                    // Permanent for this command only -- a price change, a
                    // deleted product. Park it and carry on: one bad sale must
                    // not hold up every other sale in the queue, which is what
                    // aborting the loop used to do.
                    val reason = if (attempt >= NATIVE_REPLAY_MAX_ATTEMPTS) {
                        "Offline cash replay gave up after $attempt attempts: ${error.message.orEmpty()}".trim()
                    } else {
                        error.message ?: "Offline cash replay failed."
                    }
                    reportCashException(command, error)
                    database.markCheckoutFailed(command.operationId, reason)
                    failed += 1
                }
            }
        }
        // A successful replay updates stock on the server. A second refresh
        // clears only reservations whose commands have actually committed.
        if (replayed > 0) refreshSnapshot()
        // Surfaced after the successful work is recorded, so the caller still
        // sees the connection problem and WorkManager still retries.
        deferred?.let { throw it }
        return NativeSyncResult(replayed, failed)
    }



    /** Refreshes one ticket's operational items without downloading every ticket detail. */
    fun refreshTicketItems(ticketId: String, currency: String): List<NativeTicketItem> {
        val detail = api.get("/pos/service-tickets/$ticketId")
        val items = detail.optJSONArray("items").toNativeTicketItems(ticketId, currency)
        database.replaceTicketItems(ticketId, items)
        val billedItemIds = api.get("/pos/service-tickets/$ticketId/orders")
            .optJSONArray("data")
            .toBilledTicketItemIds()
        database.replaceTicketBilledItems(ticketId, billedItemIds)
        return items
    }

    private fun refreshSnapshot() {
        val auth = api.get("/auth/me")
        val tenantId = auth.requiredString("tenantId")
        val terminalId = auth.requiredString("terminalId")
        val branch = api.get("/pos/branches/me")
        val branchId = branch.requiredString("id")
        val catalog = api.get("/pos/catalog?branchId=$branchId")
        val customers = runCatching {
            api.get("/pos/customers?resultType=profile&status=active&limit=100&offset=0")
        }.getOrNull()
        val tickets = runCatching {
            api.get("/pos/service-tickets?branchId=$branchId&limit=100&offset=0")
        }.getOrNull()
        val shift = api.get("/pos/staff/current-shift").takeUnless { it.isNullObject() }
        val register = api.get("/pos/staff/current-register")
        val cashMode = register.requiredString("cashHandlingMode")
        // Receipt policy must be available after a cold offline restart. A
        // settings read is best-effort so a restricted/cached terminal can
        // still refresh its operational catalog and cash state.
        val printSettings = runCatching { api.get("/pos/terminal-settings") }.getOrNull()
        val hardwareDevices = runCatching {
            api.get("/pos/hardware-devices").optJSONArray("data")
        }.getOrNull()
        val now = System.currentTimeMillis()
        val terminal = NativeTerminal(
            tenantId = tenantId,
            branchId = branchId,
            terminalId = terminalId,
            userId = auth.requiredString("userId"),
            role = auth.optString("role", "cashier"),
            timeZone = auth.optString("timezone", "UTC"),
            credentialVersion = auth.optInt("terminalCredentialVersion", 0),
            currency = branch.requiredString("defaultCurrency"),
            merchantName = branch.optString("merchantName").ifBlank { "CleanHub" },
            branchName = branch.requiredString("name"),
            lastSyncedAt = now,
        )
        val cashState = if (cashMode == "none") null else NativeCashState(
            shiftId = shift?.optString("id")?.takeIf { it.isNotBlank() },
            registerSessionId = register.optJSONObject("registerSession")?.optString("id")?.takeIf { it.isNotBlank() },
            cashSessionId = register.optJSONObject("cashSession")?.optString("id")?.takeIf { it.isNotBlank() },
            cashHandlingMode = cashMode,
            updatedAt = now,
        )
        database.replaceSnapshot(
            terminal = terminal,
            products = catalog.optJSONArray("products").toNativeProducts(terminal.currency),
            cashState = cashState,
            services = catalog.optJSONArray("data").toNativeServices(terminal.currency),
            customers = customers?.optJSONArray("data")?.toNativeCustomers(),
            tickets = tickets?.optJSONArray("data")?.toNativeTickets(terminal.currency),
        )
        printSettings?.let { settings ->
            database.replaceReceiptPrintSettings(
                autoPrintReceipt = settings.optBoolean("autoPrintReceipt", true),
                printCopies = settings.optInt("printCopies", 1).coerceIn(1, 3),
            )
            database.replaceCheckoutSettings(
                NativeCheckoutSettings(
                    roundingRule = settings.optString("roundingRule", "none"),
                    cashRoundingStep = branch.optInt("cashRoundingStep", 1).coerceIn(1, 100),
                    taxEnabled = settings.optBoolean("taxEnabled"),
                    defaultTaxRate = settings.optString("defaultTaxRate", "0.0000"),
                    pricesIncludeTax = settings.optBoolean("pricesIncludeTax", true),
                    taxRegistrationNumber = settings.optString("taxRegistrationNumber")
                        .takeIf { it.isNotBlank() && it != "null" },
                    emailReceiptEnabled = settings.optBoolean("emailReceiptEnabled"),
                    autoPrintReceipt = settings.optBoolean("autoPrintReceipt", true),
                    lockTimeoutSeconds = settings.optInt("lockTimeoutSeconds", 0),
                ),
            )
        }
        hardwareDevices?.let { devices ->
            database.replaceReceiptPrinterBinding(devices.defaultReceiptPrinterId())
        }
    }

    private fun reportCashException(command: NativePendingCheckout, error: NativePosApiException) {
        api.post("/pos/offline-sale-exceptions", JSONObject().apply {
            put("commandId", command.idempotencyKey)
            put("orderId", command.orderId)
            put("command", JSONObject().put("type", "checkout").put("input", JSONObject(command.payloadJson)))
            error.code?.let { put("failureCode", it) }
            put("failureMessage", error.message ?: "Offline cash replay failed.")
        })
    }

    private fun markReplayedTicketItemsBilled(payloadJson: String) {
        val order = runCatching { JSONObject(payloadJson).optJSONObject("order") }.getOrNull() ?: return
        val directTicketId = order.optString("ticketId").takeIf { it.isNotBlank() }
        if (directTicketId != null) {
            val itemIds = order.optJSONArray("ticketItemIds") ?: return
            database.markTicketItemsBilled(directTicketId, buildSet {
                for (index in 0 until itemIds.length()) {
                    itemIds.optString(index).takeIf { it.isNotBlank() }?.let(::add)
                }
            })
            return
        }
        val ticketItems = order.optJSONArray("items") ?: return
        val itemIdsByTicket = buildMap<String, MutableSet<String>> {
            for (index in 0 until ticketItems.length()) {
                val item = ticketItems.optJSONObject(index) ?: continue
                val ticketId = item.optString("ticketId").takeIf { it.isNotBlank() } ?: continue
                val ticketItemId = item.optString("ticketItemId").takeIf { it.isNotBlank() } ?: continue
                getOrPut(ticketId) { linkedSetOf() }.add(ticketItemId)
            }
        }
        itemIdsByTicket.forEach { (ticketId, itemIds) ->
            database.markTicketItemsBilled(ticketId, itemIds)
        }
    }

    private fun JSONObject.requiredString(key: String): String = getString(key).trim().also {
        require(it.isNotEmpty() && it != "null") { "$key is required." }
    }

    private fun JSONArray?.defaultReceiptPrinterId(): String? {
        if (this == null) return null
        for (index in 0 until length()) {
            val device = optJSONObject(index) ?: continue
            if (device.optString("deviceType") != "printer" || device.optString("status") != "active") continue
            val config = device.optJSONObject("config") ?: continue
            if (config.optString("printerPurpose", "receipt") == "label") continue
            if (!config.optBoolean("printerIsDefault")) continue
            val printerId = config.optString("printerId").trim()
            if (printerId.isNotEmpty() && printerId != "null") return printerId
        }
        return null
    }

    /** Hono serializes null as a JSON literal. org.json exposes it as JSONObject.NULL. */
    private fun JSONObject.isNullObject(): Boolean = has("_null") || length() == 0

    private fun JSONArray?.toNativeProducts(currency: String): List<NativeProduct> = buildList {
        if (this@toNativeProducts == null) return@buildList
        for (index in 0 until this@toNativeProducts.length()) {
            val product = this@toNativeProducts.optJSONObject(index) ?: continue
            if (product.optString("currency") != currency) continue
            val amountMinor = product.optString("amount").toMinorUnits() ?: continue
            add(NativeProduct(
                skuId = product.requiredString("productSkuId"),
                productId = product.requiredString("productId"),
                priceId = product.requiredString("productPriceId"),
                name = product.requiredString("name"),
                sku = product.requiredString("sku"),
                amountMinor = amountMinor,
                currency = currency,
                trackInventory = product.optBoolean("trackInventory"),
                availableQuantity = parseNativeWholeQuantity(product.optString("availableQuantity")),
                allowNegativeStock = product.optBoolean("allowNegativeStock"),
                allowOfflineSale = product.optBoolean("allowOfflineSale"),
                offlineStockBuffer = parseNativeWholeQuantity(product.optString("offlineStockBuffer", "0")) ?: 0,
                reservedOfflineQuantity = 0,
            ))
        }
    }

    private fun JSONArray?.toNativeServices(currency: String): List<NativeService> = buildList {
        if (this@toNativeServices == null) return@buildList
        for (index in 0 until this@toNativeServices.length()) {
            val service = this@toNativeServices.optJSONObject(index) ?: continue
            if (service.optString("currency") != currency) continue
            val amountMinor = service.optString("amount").toMinorUnits() ?: continue
            val itemTypes = service.optJSONArray("applicableItemTypes")
            val defaultItemType = itemTypes?.optString(0)?.takeIf { it.isNotBlank() }
                ?: if (service.optString("businessLine") == "car_wash") "car" else "cloth"
            add(NativeService(
                id = service.requiredString("id"),
                name = service.requiredString("name"),
                businessLine = service.optString("businessLine", "laundry"),
                pricingUnit = service.optString("pricingUnit", "per_item"),
                amountMinor = amountMinor,
                currency = currency,
                defaultItemType = defaultItemType,
                applicableItemTypes = buildList {
                    if (itemTypes != null) {
                        for (itemTypeIndex in 0 until itemTypes.length()) {
                            itemTypes.optString(itemTypeIndex).takeIf { it.isNotBlank() }?.let(::add)
                        }
                    }
                    if (isEmpty()) add(defaultItemType)
                },
            ))
        }
    }

    private fun JSONArray?.toNativeCustomers(): List<NativeCustomer> = buildList {
        if (this@toNativeCustomers == null) return@buildList
        for (index in 0 until this@toNativeCustomers.length()) {
            val entry = this@toNativeCustomers.optJSONObject(index) ?: continue
            if (entry.optString("kind") != "profile") continue
            val profile = entry.optJSONObject("profile") ?: continue
            if (profile.optString("status") != "active") continue
            add(NativeCustomer(
                id = profile.requiredString("id"),
                accountId = profile.requiredString("customerAccountId"),
                fullName = profile.requiredString("fullName"),
                accountName = profile.optString("accountName").ifBlank { profile.optString("fullName") },
                phone = profile.optString("phone").takeIf { it.isNotBlank() && it != "null" },
                email = profile.optString("email").takeIf { it.isNotBlank() && it != "null" },
                status = profile.optString("status", "active"),
            ))
        }
    }

    private fun JSONArray?.toNativeTickets(currency: String): List<NativeServiceTicket> = buildList {
        if (this@toNativeTickets == null) return@buildList
        for (index in 0 until this@toNativeTickets.length()) {
            val ticket = this@toNativeTickets.optJSONObject(index) ?: continue
            val amountMinor = ticket.optString("totalAmount", "0").toMinorUnits() ?: 0
            add(NativeServiceTicket(
                id = ticket.requiredString("id"),
                ticketNo = ticket.optString("ticketNo").takeIf { it.isNotBlank() && it != "null" },
                customerId = ticket.requiredString("customerId"),
                customerName = ticket.optString("customerName").ifBlank { "客户" },
                ticketType = ticket.optString("ticketType", "laundry"),
                ticketStatus = ticket.optString("ticketStatus", "pending"),
                priority = ticket.optString("priority", "normal"),
                itemCount = ticket.optLong("itemCount", 0),
                totalMinor = amountMinor,
                currency = ticket.optString("currency").ifBlank { currency },
                expectedPickupAt = ticket.optString("expectedPickupAt").takeIf { it.isNotBlank() && it != "null" },
                createdAt = ticket.optString("createdAt", ""),
                updatedAt = ticket.optString("updatedAt", ticket.optString("createdAt", "")),
                version = ticket.optLong("version", 1),
            ))
        }
    }

    private fun JSONArray?.toNativeTicketItems(ticketId: String, currency: String): List<NativeTicketItem> = buildList {
        if (this@toNativeTicketItems == null) return@buildList
        for (index in 0 until this@toNativeTicketItems.length()) {
            val item = this@toNativeTicketItems.optJSONObject(index) ?: continue
            val lineAmountMinor = item.optString("lineAmount", "0").toMinorUnits() ?: continue
            val standardUnitAmountMinor = item.optString("standardUnitAmount", item.optString("unitAmount", "0"))
                .toMinorUnits() ?: 0
            val chargedUnitAmountMinor = item.optString("chargedUnitAmount", item.optString("unitAmount", "0"))
                .toMinorUnits() ?: standardUnitAmountMinor
            add(NativeTicketItem(
                id = item.requiredString("id"),
                ticketId = ticketId,
                serviceId = item.optString("serviceId").takeIf { it.isNotBlank() && it != "null" },
                itemName = item.optString("itemName").ifBlank { "服务项目" },
                itemType = item.optString("itemType").takeIf { it.isNotBlank() && it != "null" },
                itemCategory = item.optString("itemCategory").takeIf { it.isNotBlank() && it != "null" },
                itemColor = item.optString("itemColor").takeIf { it.isNotBlank() && it != "null" },
                itemBrand = item.optString("itemBrand").takeIf { it.isNotBlank() && it != "null" },
                itemMaterial = item.optString("itemMaterial").takeIf { it.isNotBlank() && it != "null" },
                itemStatus = item.optString("itemStatus", "pending_wash"),
                quantity = item.optLong("quantity", 1).coerceAtLeast(1),
                pricingUnit = item.optString("pricingUnit", "per_item"),
                standardUnitAmountMinor = standardUnitAmountMinor,
                chargedUnitAmountMinor = chargedUnitAmountMinor,
                lineAmountMinor = lineAmountMinor,
                currency = currency,
                weight = item.optString("weight").takeIf { it.isNotBlank() && it != "null" },
                bagCount = item.optLong("bagCount", 0).takeIf { it > 0 },
                labelCode = item.optString("labelCode").takeIf { it.isNotBlank() && it != "null" },
                defectNotes = item.optString("defectNotes").takeIf { it.isNotBlank() && it != "null" },
                specialRequest = item.optString("specialRequest").takeIf { it.isNotBlank() && it != "null" },
                remark = item.optString("remark").takeIf { it.isNotBlank() && it != "null" },
            ))
        }
    }

    /** Same availability definition as POS Web: cancelled orders release their ticket items. */
    private fun JSONArray?.toBilledTicketItemIds(): Set<String> = buildSet {
        if (this@toBilledTicketItemIds == null) return@buildSet
        for (index in 0 until this@toBilledTicketItemIds.length()) {
            val order = this@toBilledTicketItemIds.optJSONObject(index) ?: continue
            if (order.optString("status") == "cancelled") continue
            val itemIds = order.optJSONArray("ticketItemIds") ?: continue
            for (itemIndex in 0 until itemIds.length()) {
                itemIds.optString(itemIndex).takeIf { it.isNotBlank() }?.let(::add)
            }
        }
    }

    private fun String.toMinorUnits(): Long? = runCatching {
        BigDecimal(this).movePointRight(2).setScale(0, RoundingMode.UNNECESSARY).longValueExact()
    }.getOrNull()
}

class NativePosSyncWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result = try {
        NativePosSyncEngine(applicationContext).synchronize()
        Result.success()
    } catch (error: NativePosApiException) {
        // An expired staff session needs an explicit online PIN login. The
        // durable queue remains unchanged; a future login schedules it again.
        if (error.status == 401 || error.status == 403) Result.success() else Result.retry()
    } catch (_: Exception) {
        Result.retry()
    }

    companion object {
        private const val UNIQUE_WORK = "cleanhub-native-pos-sync"

        fun schedule(context: Context) {
            val request = OneTimeWorkRequestBuilder<NativePosSyncWorker>()
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .setBackoffCriteria(androidx.work.BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS)
                .build()
            WorkManager.getInstance(context.applicationContext).enqueueUniqueWork(
                UNIQUE_WORK,
                ExistingWorkPolicy.KEEP,
                request,
            )
        }
    }
}
