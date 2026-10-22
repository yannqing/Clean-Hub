package com.cleanhub.pos.nativepos

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.math.BigDecimal
import java.math.RoundingMode
import java.util.concurrent.TimeUnit
import org.json.JSONArray
import org.json.JSONObject

data class NativeSyncResult(val replayedSales: Int, val failedSales: Int, val intakeSyncError: NativePosApiException? = null)

internal data class NativeCheckoutSubmission(
    val queueStatus: String?,
    val paymentStatus: String? = null,
    val error: NativePosApiException? = null,
    val order: JSONObject? = null,
)

internal interface NativeIntakeGateway {
    fun prepare(terminal: NativeTerminal): Boolean
    fun submit(path: String, payload: JSONObject): JSONObject
}

internal interface NativeCheckoutGateway {
    fun submit(payload: JSONObject): JSONObject
    fun reportException(payload: JSONObject)
}

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
    private val appContext = context.applicationContext
    private val brandingCache = NativeBrandLogoCache(context.applicationContext)
    private val database = NativePosDatabase(context.applicationContext)
    private val intakeStore = database.intakeStore
    private val session = NativePosSession(context.applicationContext)
    private val api = NativePosApiClient(session)
    private var checkoutGateway: NativeCheckoutGateway = object : NativeCheckoutGateway {
        override fun submit(payload: JSONObject): JSONObject = api.post("/pos/orders/checkout", payload)
        override fun reportException(payload: JSONObject) { api.post("/pos/offline-sale-exceptions", payload) }
    }

    internal constructor(context: Context, gateway: NativeCheckoutGateway) : this(context) {
        checkoutGateway = gateway
    }

    private var intakeGateway: NativeIntakeGateway =
        object : NativeIntakeGateway {
            override fun prepare(terminal: NativeTerminal): Boolean {
                val capability =
                    try {
                        api.get("/pos/service-tickets/intake-capabilities")
                    } catch (error: NativePosApiException) {
                        if (error.status in setOf(400, 404, 422))
                            throw NativePosApiException(
                                409,
                                "INTAKE_SYNC_UNAVAILABLE",
                                nativePosCopy(session.pinLanguageCode()).intakeServerUpgradeRequired,
                            )
                        throw error
                    }
                if (!capability.optBoolean("stableClientIds"))
                    throw NativePosApiException(
                        409,
                        "INTAKE_SYNC_UNAVAILABLE",
                        nativePosCopy(session.pinLanguageCode()).intakeServerUpgradeRequired,
                    )
                val auth = api.get("/auth/me")
                val branch = api.get("/pos/branches/me")
                return auth.optString("tenantId") == terminal.tenantId &&
                    auth.optString("terminalId") == terminal.terminalId &&
                    auth.optString("userId") == terminal.userId &&
                    branch.optString("id") == terminal.branchId
            }

            override fun submit(path: String, payload: JSONObject): JSONObject =
                api.post(path, payload)
        }

    internal constructor(context: Context, gateway: NativeIntakeGateway) : this(context) {
        intakeGateway = gateway
    }

    /** Refreshes store-owned checkout and receipt rules without replaying sales. */
    fun refreshCheckoutSettings(): JSONObject = refreshTerminalConfiguration().second

    fun refreshTerminalConfiguration(): Pair<JSONObject, JSONObject> {
        val branch = api.get("/pos/branches/me")
        val settings = api.get("/pos/terminal-settings")
        requireNativeTerminalDevice(settings.optString("deviceId"), session.deviceId(), nativePosCopy(session.pinLanguageCode()))
        cacheCheckoutSettings(branch, settings)
        database.intakeTerminal()?.let { terminal ->
            intakeStore.cache(terminal, "terminal-settings", "current", JSONObject().put("branch", branch).put("settings", settings))
        }
        return branch to settings
    }

    fun synchronize(includeIntakes: Boolean = true): NativeSyncResult {
        val intakeFailure =
            if (includeIntakes)
                try {
                    synchronizeIntakes()
                    null
                } catch (error: NativePosApiException) {
                    error
                }
            else null
        refreshSnapshot()
        var replayed = 0
        var failed = 0
        var deferred: NativePosApiException? = null
        for (command in database.listPendingCheckouts()) {
            // Once the connection or the session is gone, every remaining
            // command would fail the same way. Stop asking, but keep whatever
            // already replayed rather than discarding the run.
            if (deferred != null) break
            val result = submitCheckout(command.operationId)
            when (result.queueStatus) {
                null -> replayed += 1
                "failed" -> failed += 1
                else -> deferred = result.error
            }
        }
        // A successful replay updates stock on the server. A second refresh
        // clears only reservations whose commands have actually committed.
        if (replayed > 0) refreshSnapshot()
        // Surfaced after the successful work is recorded, so the caller still
        // sees the connection problem and WorkManager still retries.
        deferred?.let { throw it }
        NativePosOrderDetailWorker.schedule(appContext)
        return NativeSyncResult(replayed, failed, intakeFailure)
    }

    /** Interactive checkout submits only this durable command, never the catalogue or older sales. */
    internal fun submitCheckout(operationId: String): NativeCheckoutSubmission = synchronized(checkoutReplayLock) {
        val command = database.listPendingCheckouts().firstOrNull { it.operationId == operationId }
            ?: return@synchronized NativeCheckoutSubmission(database.checkoutStatus(operationId))
        val attempt = database.recordCheckoutAttempt(operationId)
        try {
            val response = checkoutGateway.submit(JSONObject(command.payloadJson))
            val order = response.optJSONObject("order")
            if (order == null || order.optString("id") != command.orderId || order.optString("paymentStatus") !in setOf("paid", "unpaid", "partial", "refunded")) {
                throw NativePosApiException(0, "INVALID_CHECKOUT_RESPONSE", nativePosCopy(session.pinLanguageCode()).checkoutConfirmationMissing)
            }
            database.markCheckoutSynced(operationId)
            markReplayedTicketItemsBilled(command.payloadJson)
            NativeCheckoutSubmission(null, order.optString("paymentStatus"), order = order)
        } catch (error: NativePosApiException) {
            if (isTransientReplayFailure(error) && attempt < NATIVE_REPLAY_MAX_ATTEMPTS) {
                NativeCheckoutSubmission("pending", error = error)
            } else {
                val reason = if (attempt >= NATIVE_REPLAY_MAX_ATTEMPTS) {
                    "Offline cash replay gave up after $attempt attempts: ${error.message.orEmpty()}".trim()
                } else error.message ?: "Offline cash replay failed."
                database.markCheckoutFailed(operationId, reason)
                // Losing the exception-report response must not make a rejected sale printable.
                runCatching { reportCashException(command, error) }
                NativeCheckoutSubmission("failed", error = error)
            }
        }
    }

    companion object {
        // WorkManager and the foreground can meet on the same command. Claim it once per process;
        // the stable server idempotency key also covers process death and response loss.
        private val checkoutReplayLock = Any()
    }



    /** Authenticate before replay: a PIN handover must never upload another employee's work. */
    fun synchronizeIntakes(ticketId: String? = null, retryFailed: Boolean = false) =
        synchronized(NATIVE_INTAKE_REPLAY_LOCK) {
            val t = database.intakeTerminal() ?: return@synchronized
            if (intakeStore.operations(t, ticketId).none { it.status != "synced" }) return@synchronized
            try {
                if (!intakeGateway.prepare(t)) return@synchronized
            } catch (error: NativePosApiException) {
                intakeStore
                    .operations(t, ticketId)
                    .filter { it.status == "pending" && it.userId == t.userId }
                    .forEach { intakeStore.failed(it.id, error.message.orEmpty(), false, error.status) }
                throw error
            }
            if (retryFailed && ticketId != null) intakeStore.retry(t, ticketId)
            for (op in
                intakeStore.operations(t, ticketId).filter {
                    it.status == "pending" && it.userId == t.userId
                }) {
                if (op.kind == "item" && intakeStore.unsent(t, op.ticketId).any { it.kind == "ticket" })
                    continue
                intakeStore.attempt(op.id)
                try {
                    val path =
                        if (op.kind == "ticket") "/pos/service-tickets"
                        else "/pos/service-tickets/${op.ticketId}/items"
                    val response = intakeGateway.submit(path, JSONObject(op.payload))
                    if (
                        response.optString("id") != op.id ||
                            (op.kind == "item" && response.optString("ticketId") != op.ticketId) ||
                            (op.kind == "ticket" &&
                                (response.optString("branchId") != t.branchId ||
                                    response.optString("customerId") !=
                                        JSONObject(op.payload).optString("customerId")))
                    ) {
                        throw NativePosApiException(
                            0,
                            "INVALID_INTAKE_RESPONSE",
                            nativePosCopy(session.pinLanguageCode()).intakeConfirmationMissing,
                        )
                    }
                    intakeStore.acknowledge(op.id, response)
                    if (op.kind == "ticket") intakeStore.cache(t, "ticket", op.ticketId, response)
                } catch (error: NativePosApiException) {
                    val transient = isTransientReplayFailure(error) || error.status == 429
                    intakeStore.failed(
                        op.id,
                        error.message.orEmpty(),
                        !transient || op.attempt + 1 >= NATIVE_REPLAY_MAX_ATTEMPTS,
                        error.status,
                    )
                    if (transient) throw error
                }
            }
        }

    /** Detail refresh owns metadata, item rows and related orders, independently of catalogue sync. */
    fun refreshTicketItems(ticketId: String, currency: String): List<NativeTicketItem> {
        val t = database.snapshot().terminal ?: return database.ticketItems(ticketId)
        if (intakeStore.unsent(t, ticketId).any { it.kind == "ticket" })
            return database.ticketItems(ticketId)
        val detail = api.get("/pos/service-tickets/$ticketId")
        val items = detail.optJSONArray("items").toNativeTicketItems(ticketId, currency)
        database.replaceTicketItems(ticketId, items)
        intakeStore.cache(t, "ticket", ticketId, detail)
        intakeStore.confirmItems(t, ticketId)
        val orders = api.get("/pos/service-tickets/$ticketId/orders")
        intakeStore.cache(t, "ticket-orders", ticketId, orders)
        database.replaceTicketBilledItems(ticketId, orders.optJSONArray("data").toBilledTicketItemIds())
        return database.ticketItems(ticketId)
    }

    private fun refreshSnapshot() {
        val stockRevision = database.stockRevision()
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
        val shift = runCatching {
            api.get("/pos/staff/current-shift").takeUnless { it.isNullObject() }
        }.getOrNull()
        var register = api.get("/pos/staff/current-register")
        if (shouldPrepareNativeCashRegister(
                mode = register.requiredString("cashHandlingMode"),
                registerOpen = register.optJSONObject("registerSession")?.optString("status") == "open",
                cashSessionOpen = register.optJSONObject("cashSession")?.optString("status") == "open",
                requireOpeningFloat = register.optBoolean("requireOpeningFloat", true),
            )) {
            register = api.post("/pos/staff/register-sessions/open", JSONObject())
        }
        val cashMode = register.requiredString("cashHandlingMode")
        // A successful sync must include financial readiness, not just the catalogue.
        val printSettings = api.get("/pos/terminal-settings")
        requireNativeTerminalDevice(printSettings.optString("deviceId"), session.deviceId(), nativePosCopy(session.pinLanguageCode()))
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
            posDisplayName = if (branch.has("posDisplayName") && !branch.isNull("posDisplayName")) branch.optString("posDisplayName").trim() else branch.optString("merchantName"),
            posLogoPath = brandingCache.synchronize(
                tenantId, branch.optString("posLogoObjectKey").takeIf { it.isNotBlank() && it != "null" },
                branch.optString("posLogoUrl").takeIf { it.isNotBlank() && it != "null" },
            ),
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
            expectedStockRevision = stockRevision,
            itemCatalogJson = catalog.optJSONObject("itemCatalog"),
        )
        intakeStore.cache(terminal, "terminal-settings", "current", JSONObject().put("branch", branch).put("settings", printSettings))
        // Orders are reference data. A failed order fetch must not prevent a
        // successful catalogue/checkout sync from making the till usable.
        runCatching {
            val orderPage = api.get("/pos/orders?branchId=$branchId&limit=100&offset=0")
            val rows = orderPage.optJSONArray("data") ?: error("Missing order list")
            database.replaceOrderSummaries(terminal, rows)
        }
        runCatching {
            intakeStore.cache(terminal, "statistics", "today",
                api.get("/pos/statistics/overview?period=today&branchId=$branchId"))
        }
        runCatching {
            intakeStore.cache(terminal, "notifications", terminal.userId,
                api.get("/pos/notifications?limit=50&offset=0"))
        }
        cacheCheckoutSettings(branch, printSettings)
        hardwareDevices?.let { devices ->
            database.replaceReceiptPrinterBinding(devices.defaultReceiptPrinterId())
        }
    }

    private fun cacheCheckoutSettings(branch: JSONObject, settings: JSONObject) {
        database.replaceReceiptPrintSettings(
            autoPrintReceipt = settings.optBoolean("autoPrintReceipt", true),
            printCopies = settings.optInt("printCopies", 1).coerceIn(1, 3),
        )
        database.replaceCheckoutSettings(
            NativeCheckoutSettings(
                roundingRule = settings.optString("roundingRule", "none"),
                cashRoundingStep = branch.optInt("cashRoundingStep", 1).coerceIn(1, 100),
                defaultPaymentMethod = settings.optString("defaultPaymentMethod", "cash"),
                paymentMethodsEnabled = settings.optJSONArray("paymentMethodsEnabled").toNativeStringList(),
                mobileMoneyProvidersEnabled = settings.optJSONArray("mobileMoneyProvidersEnabled").toNativeStringList(),
                receiptProfile = NativeReceiptProfile(
                    name = branch.optString("receiptName").takeIf { it.isNotBlank() && it != "null" },
                    phone = branch.optString("receiptPhone").takeIf { it.isNotBlank() && it != "null" }
                        ?: branch.optString("phone").takeIf { it.isNotBlank() && it != "null" },
                    address = branch.optString("receiptAddress").takeIf { it.isNotBlank() && it != "null" }
                        ?: branch.optString("address").takeIf { it.isNotBlank() && it != "null" },
                    thankYouMessage = branch.optString("receiptThankYouMessage").takeIf { it.isNotBlank() && it != "null" },
                    fields = branch.optJSONArray("receiptFields")?.toNativeStringList()?.toSet()
                        ?: NativeReceiptProfile().fields,
                ),
                taxEnabled = settings.optBoolean("taxEnabled"),
                taxVerifiedAt = System.currentTimeMillis(),
                taxReady = settings.optJSONObject("taxReadiness")?.optBoolean("ready") == true,
                taxReadinessCode = settings.optJSONObject("taxReadiness")?.optString("code")?.takeIf { it.isNotBlank() && it != "null" },
                defaultTaxRate = settings.optString("defaultTaxRate", "0.0000"),
                pricesIncludeTax = settings.optBoolean("pricesIncludeTax", true),
                taxRegistrationNumber = settings.optString("taxRegistrationNumber")
                    .takeIf { it.isNotBlank() && it != "null" },
                taxLabel = settings.optString("taxLabel").takeIf { it.isNotBlank() && it != "null" },
                taxComponents = settings.optJSONArray("taxComponents")?.let { components ->
                    (0 until components.length()).mapNotNull { index ->
                        components.optJSONObject(index)?.let { component ->
                            NativeTaxComponent(
                                name = component.optString("name"),
                                rate = component.optString("rate", "0.0000"),
                            )
                        }
                    }
                } ?: emptyList(),
                emailReceiptEnabled = settings.optBoolean("emailReceiptEnabled"),
                autoPrintReceipt = settings.optBoolean("autoPrintReceipt", true),
                lockTimeoutSeconds = settings.optInt("lockTimeoutSeconds", 0),
            ),
        )
    }

    private fun reportCashException(command: NativePendingCheckout, error: NativePosApiException) {
        checkoutGateway.reportException(JSONObject().apply {
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
                taxRate = product.optNativeTaxRate(),
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
                taxRate = service.optNativeTaxRate(),
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
                customerName = ticket.optString("customerName").ifBlank { nativePosCopy(null).customerFallback },
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
                itemName = item.optString("itemName").ifBlank { nativePosCopy(null).serviceItemFallback },
                itemType = item.optString("itemType").takeIf { it.isNotBlank() && it != "null" },
                catalogItemId = item.nativeText("catalogItemId"),
                itemTypeName = item.nativeText("itemTypeName"),
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

    private fun JSONArray?.toNativeStringList(): List<String> = buildList {
        val source = this@toNativeStringList ?: return@buildList
        for (index in 0 until source.length()) {
            source.optString(index).takeIf { it.isNotBlank() }?.let(::add)
        }
    }
}

class NativePosSyncWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result = try {
        val result=NativePosSyncEngine(applicationContext).synchronize()
        val intakeError=result.intakeSyncError
        if(intakeError!=null && intakeError.status!=401 && intakeError.status!=403) Result.retry() else Result.success()
    } catch (error: NativePosApiException) {
        // An expired staff session needs an explicit online PIN login. The
        // durable queue remains unchanged; a future login schedules it again.
        if (error.status == 401 || error.status == 403) Result.success() else Result.retry()
    } catch (_: Exception) {
        Result.retry()
    }

    companion object {
        internal const val UNIQUE_WORK = "cleanhub-native-pos-sync"
        internal const val PERIODIC_WORK = "cleanhub-native-pos-periodic-sync"

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
            val periodic = PeriodicWorkRequestBuilder<NativePosSyncWorker>(15, TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            WorkManager.getInstance(context.applicationContext).enqueueUniquePeriodicWork(
                PERIODIC_WORK,
                ExistingPeriodicWorkPolicy.KEEP,
                periodic,
            )
        }
    }
}

/** Progressive prefetch keeps opening Order Management fast while making each
 * visible order's complete detail available after the background pass. */
class NativePosOrderDetailWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        val database = NativePosDatabase(applicationContext)
        val terminal = database.intakeTerminal() ?: return Result.success()
        val api = NativePosApiClient(NativePosSession(applicationContext))
        for (id in database.orderDetailsNeedingRefresh(terminal)) {
            try {
                val order = api.get("/pos/orders/$id")
                val payments = api.get("/pos/orders/$id/payments").optJSONArray("data") ?: JSONArray()
                val adjustments = api.get("/pos/payment-adjustments?orderId=$id").optJSONArray("data") ?: JSONArray()
                if (!database.replaceOrderDetail(terminal, order, payments, adjustments)) return Result.success()
            } catch (error: NativePosApiException) {
                if (error.status == 401 || error.status == 403) return Result.success()
                if (error.status == 0 || error.status >= 500) return Result.retry()
                // A deleted or inaccessible order is removed by the next list refresh.
            } catch (_: Exception) {
                return Result.retry()
            }
        }
        return Result.success()
    }

    companion object {
        private const val UNIQUE_WORK = "cleanhub-native-pos-order-details"

        fun schedule(context: Context) {
            val request = OneTimeWorkRequestBuilder<NativePosOrderDetailWorker>()
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .setBackoffCriteria(androidx.work.BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS)
                .build()
            WorkManager.getInstance(context.applicationContext).enqueueUniqueWork(UNIQUE_WORK, ExistingWorkPolicy.KEEP, request)
        }
    }
}
