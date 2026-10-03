package com.cleanhub.pos.nativepos

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import java.time.Instant
import org.json.JSONArray
import org.json.JSONObject

private const val DATABASE_NAME = "cleanhub_native_pos.db"
private const val DATABASE_VERSION = 22
private const val MAX_RUNTIME_AGE_MS = 8 * 60 * 60 * 1_000L
private const val MAX_CATALOG_AGE_MS = 24 * 60 * 60 * 1_000L
private const val MAX_CASH_STATE_AGE_MS = 2 * 60 * 60 * 1_000L

private data class NativePosCartState(
    val checkoutId: String,
    val currency: String,
    val customerId: String?,
    val customerName: String?,
)

private data class NativeOfflineStockState(
    val trackInventory: Boolean,
    val availableQuantity: Long?,
    val allowNegativeStock: Boolean,
    val offlineStockBuffer: Long,
    val reservedOfflineQuantity: Long,
)

/**
 * Native SQLite source of truth for the APK. Cached server data, offline stock
 * reservations and immutable checkout commands are stored separately so a
 * process death cannot turn a completed cash collection into a lost sale.
 */
class NativePosDatabase(
    context: Context,
    /** Read per call so a language change reaches these refusals without a restart. */
    private val languageCode: () -> String? = { null },
) : SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {
    private val copy: NativePosCopy get() = nativePosCopy(languageCode())

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE terminal_state (
              singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
              tenant_id TEXT NOT NULL,
              branch_id TEXT NOT NULL,
              terminal_id TEXT NOT NULL,
              user_id TEXT NOT NULL,
              role TEXT NOT NULL,
              time_zone TEXT NOT NULL,
              credential_version INTEGER NOT NULL,
              currency TEXT NOT NULL,
              merchant_name TEXT NOT NULL,
              branch_name TEXT NOT NULL,
              synced_at INTEGER NOT NULL
            )
            """.trimIndent(),
        )
        db.execSQL(
            """
            CREATE TABLE catalog_state (
              singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
              synced_at INTEGER NOT NULL
            )
            """.trimIndent(),
        )
        db.execSQL(
            """
            CREATE TABLE catalog_product (
              sku_id TEXT PRIMARY KEY NOT NULL,
              product_id TEXT NOT NULL,
              price_id TEXT NOT NULL,
              name TEXT NOT NULL,
              sku TEXT NOT NULL,
              amount_minor INTEGER NOT NULL,
              currency TEXT NOT NULL,
              track_inventory INTEGER NOT NULL,
              available_quantity INTEGER,
              allow_negative_stock INTEGER NOT NULL,
              allow_offline_sale INTEGER NOT NULL,
              offline_stock_buffer INTEGER NOT NULL,
              reserved_offline_quantity INTEGER NOT NULL DEFAULT 0,
              tax_rate TEXT
            )
            """.trimIndent(),
        )
        db.execSQL(
            """
            CREATE TABLE cash_state (
              singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
              shift_id TEXT,
              register_session_id TEXT,
              cash_session_id TEXT,
              cash_handling_mode TEXT NOT NULL,
              synced_at INTEGER NOT NULL
            )
            """.trimIndent(),
        )
        db.execSQL(
            """
            CREATE TABLE pending_operation (
              operation_id TEXT PRIMARY KEY NOT NULL,
              sequence INTEGER NOT NULL UNIQUE,
              entity_id TEXT NOT NULL,
              idempotency_key TEXT NOT NULL UNIQUE,
              payload_json TEXT NOT NULL,
              created_at INTEGER NOT NULL,
              status TEXT NOT NULL CHECK (status IN ('pending', 'failed')),
              attempt INTEGER NOT NULL DEFAULT 0,
              last_error TEXT
            )
            """.trimIndent(),
        )
        createReferenceTables(db)
        createTicketBillingTable(db)
        createProductCartTable(db)
        createCartStateTable(db)
        createTicketCartTable(db)
        createReceiptPrintTables(db)
        createReceiptPrinterBindingTable(db)
        createCheckoutSettingsTable(db)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (oldVersion < 2) {
            db.execSQL("CREATE TABLE catalog_state (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), synced_at INTEGER NOT NULL)")
            db.execSQL("ALTER TABLE cash_state RENAME TO cash_state_legacy")
            db.execSQL("CREATE TABLE cash_state (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), shift_id TEXT, register_session_id TEXT, cash_session_id TEXT, cash_handling_mode TEXT NOT NULL, synced_at INTEGER NOT NULL)")
            db.execSQL("INSERT INTO cash_state (singleton, shift_id, register_session_id, cash_session_id, cash_handling_mode, synced_at) SELECT singleton, shift_id, register_session_id, cash_session_id, cash_handling_mode, synced_at FROM cash_state_legacy")
            db.execSQL("DROP TABLE cash_state_legacy")
        }
        if (oldVersion < 3) createReferenceTables(db)
        if (oldVersion < 4) createTicketItemTable(db)
        if (oldVersion in 3..4) {
            db.execSQL("ALTER TABLE catalog_service ADD COLUMN applicable_item_types TEXT NOT NULL DEFAULT '[]'")
        }
        if (oldVersion == 4) {
            db.execSQL("ALTER TABLE service_ticket_item ADD COLUMN bag_count INTEGER")
        }
        // Versions before 4 build the current table directly. Versions 4 and 5
        // already have rows to preserve, so extend them in place.
        if (oldVersion in 4..5) {
            db.execSQL("ALTER TABLE service_ticket_item ADD COLUMN item_category TEXT")
            db.execSQL("ALTER TABLE service_ticket_item ADD COLUMN item_color TEXT")
            db.execSQL("ALTER TABLE service_ticket_item ADD COLUMN item_brand TEXT")
            db.execSQL("ALTER TABLE service_ticket_item ADD COLUMN item_material TEXT")
            db.execSQL("ALTER TABLE service_ticket_item ADD COLUMN standard_unit_amount_minor INTEGER NOT NULL DEFAULT 0")
            db.execSQL("ALTER TABLE service_ticket_item ADD COLUMN charged_unit_amount_minor INTEGER NOT NULL DEFAULT 0")
            db.execSQL("ALTER TABLE service_ticket_item ADD COLUMN defect_notes TEXT")
            db.execSQL("ALTER TABLE service_ticket_item ADD COLUMN special_request TEXT")
            db.execSQL("ALTER TABLE service_ticket_item ADD COLUMN remark TEXT")
        }
        if (oldVersion < 7) {
            db.execSQL("ALTER TABLE terminal_state ADD COLUMN role TEXT NOT NULL DEFAULT 'cashier'")
        }
        if (oldVersion < 8) createTicketBillingTable(db)
        if (oldVersion < 9) {
            db.execSQL("ALTER TABLE terminal_state ADD COLUMN time_zone TEXT NOT NULL DEFAULT 'UTC'")
        }
        if (oldVersion < 10) createProductCartTable(db)
        if (oldVersion < 11) {
            createCartStateTable(db)
            createTicketCartTable(db)
        }
        if (oldVersion < 12) createReceiptPrintTables(db)
        if (oldVersion < 13) createReceiptPrinterBindingTable(db)
        if (oldVersion < 14) {
            createCheckoutSettingsTable(db)
        } else if (oldVersion < 15) {
            db.execSQL("ALTER TABLE checkout_settings ADD COLUMN auto_print_receipt INTEGER NOT NULL DEFAULT 1")
        }
        if (oldVersion in 14..17) {
            // The idle lock needs its timeout on a terminal that has been
            // offline for days, so it is cached with the checkout settings
            // rather than read from the online-only terminal settings call.
            db.execSQL("ALTER TABLE checkout_settings ADD COLUMN lock_timeout_seconds INTEGER NOT NULL DEFAULT 0")
        }
        if (oldVersion < 17) {
            // Replays had no attempt counter, so a command the server will
            // never accept could be retried forever and hold the queue.
            db.execSQL("ALTER TABLE pending_operation ADD COLUMN attempt INTEGER NOT NULL DEFAULT 0")
        }
        // Per-item tax: each product and service may carry its own rate (null
        // is the tenant default). Tables created above at this version already
        // have the column, so only extend those that existed before: the
        // catalogue since version 1, services since 3, cart lines since 10.
        if (oldVersion < 19) {
            db.execSQL("ALTER TABLE catalog_product ADD COLUMN tax_rate TEXT")
        }
        if (oldVersion in 3..18) {
            db.execSQL("ALTER TABLE catalog_service ADD COLUMN tax_rate TEXT")
        }
        if (oldVersion in 10..18) {
            db.execSQL("ALTER TABLE pos_cart_line ADD COLUMN tax_rate TEXT")
        }
        if (oldVersion in 3..15) {
            // Keep server timestamps with the offline ticket cache. Row order
            // is not a reliable proxy after a full snapshot is replaced.
            db.execSQL("ALTER TABLE service_ticket ADD COLUMN created_at TEXT NOT NULL DEFAULT ''")
            db.execSQL("ALTER TABLE service_ticket ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''")
        }
        if (oldVersion in 14..19) {
            db.execSQL("ALTER TABLE checkout_settings ADD COLUMN default_payment_method TEXT NOT NULL DEFAULT 'cash'")
            db.execSQL("ALTER TABLE checkout_settings ADD COLUMN payment_methods_enabled TEXT NOT NULL DEFAULT '[\"cash\"]'")
            db.execSQL("ALTER TABLE checkout_settings ADD COLUMN mobile_money_providers_enabled TEXT NOT NULL DEFAULT '[]'")
            db.execSQL("ALTER TABLE checkout_settings ADD COLUMN receipt_profile_json TEXT NOT NULL DEFAULT '{}'")
        }
        if (oldVersion in 14..20) {
            db.execSQL("ALTER TABLE checkout_settings ADD COLUMN tax_label TEXT")
            db.execSQL("ALTER TABLE checkout_settings ADD COLUMN tax_components_json TEXT NOT NULL DEFAULT '[]'")
        }
        if (oldVersion in 14..21) {
            db.execSQL("ALTER TABLE checkout_settings ADD COLUMN tax_ready INTEGER NOT NULL DEFAULT 0")
            db.execSQL("ALTER TABLE checkout_settings ADD COLUMN tax_readiness_code TEXT")
        }
    }

    fun snapshot(now: Long = System.currentTimeMillis()): NativePosSnapshot {
        val terminal = readTerminal()?.takeIf { now - it.lastSyncedAt in 0..MAX_RUNTIME_AGE_MS }
        val cashState = readCashState()?.takeIf { now - it.updatedAt in 0..MAX_CASH_STATE_AGE_MS }
        return NativePosSnapshot(
            terminal = terminal,
            cashState = cashState,
            products = if (terminal == null || !hasFreshCatalog(now)) emptyList() else readProducts(),
            services = if (terminal == null || !hasFreshCatalog(now)) emptyList() else readServices(),
            customers = if (terminal == null) emptyList() else readCustomers(),
            tickets = if (terminal == null) emptyList() else readTickets(),
            pendingSales = countPendingSales(),
            failedSales = countFailedSales(),
        )
    }

    /** Terminal settings are copied locally so a cold-started offline APK keeps its print policy. */
    fun replaceReceiptPrintSettings(autoPrintReceipt: Boolean, printCopies: Int) {
        require(printCopies in 1..10) { copy.printCopiesRangeTen }
        writableDatabase.insertWithOnConflict("receipt_print_settings", null, ContentValues().apply {
            put("singleton", 1)
            put("auto_print_receipt", if (autoPrintReceipt) 1 else 0)
            put("print_copies", printCopies)
            put("updated_at", System.currentTimeMillis())
        }, SQLiteDatabase.CONFLICT_REPLACE)
    }

    fun receiptPrintSettings(): NativeReceiptPrintSettings = readableDatabase.rawQuery(
        "SELECT auto_print_receipt, print_copies FROM receipt_print_settings WHERE singleton = 1",
        null,
    ).use { cursor ->
        if (cursor.moveToFirst()) {
            NativeReceiptPrintSettings(
                autoPrintReceipt = cursor.getInt(0) == 1,
                printCopies = cursor.getInt(1).coerceIn(1, 10),
            )
        } else {
            // This matches the server-side terminal default while the first
            // online settings sync has not happened yet.
            NativeReceiptPrintSettings(autoPrintReceipt = true, printCopies = 1)
        }
    }

    /** Checkout rules are retained with the catalog so a cold offline start still prices cash consistently. */
    fun replaceCheckoutSettings(settings: NativeCheckoutSettings) {
        writableDatabase.insertWithOnConflict("checkout_settings", null, ContentValues().apply {
            put("singleton", 1)
            put("rounding_rule", settings.roundingRule)
            put("cash_rounding_step", settings.cashRoundingStep.coerceIn(1, 100))
            put("default_payment_method", settings.defaultPaymentMethod)
            put("payment_methods_enabled", JSONArray(settings.paymentMethodsEnabled).toString())
            put("mobile_money_providers_enabled", JSONArray(settings.mobileMoneyProvidersEnabled).toString())
            put("receipt_profile_json", JSONObject().apply {
                put("name", settings.receiptProfile.name)
                put("phone", settings.receiptProfile.phone)
                put("address", settings.receiptProfile.address)
                put("thankYouMessage", settings.receiptProfile.thankYouMessage)
                put("fields", JSONArray(settings.receiptProfile.fields.toList()))
            }.toString())
            put("tax_enabled", if (settings.taxEnabled) 1 else 0)
            put("tax_ready", if (settings.taxReady) 1 else 0)
            if (settings.taxReadinessCode == null) putNull("tax_readiness_code") else put("tax_readiness_code", settings.taxReadinessCode)
            put("default_tax_rate", settings.defaultTaxRate)
            put("prices_include_tax", if (settings.pricesIncludeTax) 1 else 0)
            if (settings.taxRegistrationNumber.isNullOrBlank()) putNull("tax_registration_number") else put("tax_registration_number", settings.taxRegistrationNumber)
            if (settings.taxLabel.isNullOrBlank()) putNull("tax_label") else put("tax_label", settings.taxLabel)
            put("tax_components_json", JSONArray().apply {
                settings.taxComponents.forEach { component ->
                    put(JSONObject().put("name", component.name).put("rate", component.rate))
                }
            }.toString())
            put("email_receipt_enabled", if (settings.emailReceiptEnabled) 1 else 0)
            put("auto_print_receipt", if (settings.autoPrintReceipt) 1 else 0)
            put("lock_timeout_seconds", settings.lockTimeoutSeconds.coerceAtLeast(0))
            put("updated_at", System.currentTimeMillis())
        }, SQLiteDatabase.CONFLICT_REPLACE)
    }

    fun checkoutSettings(): NativeCheckoutSettings = readableDatabase.rawQuery(
        "SELECT rounding_rule, cash_rounding_step, tax_enabled, default_tax_rate, prices_include_tax, tax_registration_number, email_receipt_enabled, auto_print_receipt, lock_timeout_seconds, default_payment_method, payment_methods_enabled, mobile_money_providers_enabled, receipt_profile_json, tax_label, tax_components_json, tax_ready, tax_readiness_code FROM checkout_settings WHERE singleton = 1",
        null,
    ).use { cursor ->
        if (!cursor.moveToFirst()) return@use NativeCheckoutSettings()
        NativeCheckoutSettings(
            roundingRule = cursor.getString(0),
            cashRoundingStep = cursor.getInt(1).coerceIn(1, 100),
            taxEnabled = cursor.getInt(2) == 1,
            taxReady = cursor.getInt(15) == 1,
            taxReadinessCode = cursor.getStringOrNull(16),
            defaultTaxRate = cursor.getString(3),
            pricesIncludeTax = cursor.getInt(4) == 1,
            taxRegistrationNumber = cursor.getStringOrNull(5),
            taxLabel = cursor.getStringOrNull(13),
            taxComponents = runCatching {
                val components = JSONArray(cursor.getString(14))
                (0 until components.length()).mapNotNull { index ->
                    components.optJSONObject(index)?.let { component ->
                        NativeTaxComponent(component.optString("name"), component.optString("rate", "0.0000"))
                    }
                }
            }.getOrDefault(emptyList()),
            emailReceiptEnabled = cursor.getInt(6) == 1,
            autoPrintReceipt = cursor.getInt(7) == 1,
            lockTimeoutSeconds = cursor.getInt(8).coerceAtLeast(0),
            defaultPaymentMethod = cursor.getString(9),
            paymentMethodsEnabled = jsonStringList(cursor.getString(10)),
            mobileMoneyProvidersEnabled = jsonStringList(cursor.getString(11)),
            receiptProfile = runCatching {
                val profile = JSONObject(cursor.getString(12))
                NativeReceiptProfile(
                    name = profile.optString("name").takeIf { it.isNotBlank() && it != "null" },
                    phone = profile.optString("phone").takeIf { it.isNotBlank() && it != "null" },
                    address = profile.optString("address").takeIf { it.isNotBlank() && it != "null" },
                    thankYouMessage = profile.optString("thankYouMessage").takeIf { it.isNotBlank() && it != "null" },
                    fields = profile.optJSONArray("fields")?.let { array ->
                        (0 until array.length()).map { array.optString(it) }.filter(String::isNotBlank).toSet()
                    } ?: NativeReceiptProfile().fields,
                )
            }.getOrDefault(NativeReceiptProfile()),
        )
    }

    private fun jsonStringList(value: String): List<String> = runCatching {
        val array = JSONArray(value)
        (0 until array.length()).mapNotNull { index ->
            array.optString(index).takeIf { it.isNotBlank() }
        }
    }.getOrDefault(emptyList())

    fun replaceReceiptPrinterBinding(printerId: String?) {
        if (printerId.isNullOrBlank()) {
            writableDatabase.delete("receipt_printer_binding", null, null)
            return
        }
        writableDatabase.insertWithOnConflict("receipt_printer_binding", null, ContentValues().apply {
            put("singleton", 1)
            put("printer_id", printerId)
            put("updated_at", System.currentTimeMillis())
        }, SQLiteDatabase.CONFLICT_REPLACE)
    }

    fun receiptPrinterId(): String? = readableDatabase.rawQuery(
        "SELECT printer_id FROM receipt_printer_binding WHERE singleton = 1",
        null,
    ).use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null }

    fun receiptPrintQueueState(): NativeReceiptPrintQueueState = readableDatabase.rawQuery(
        "SELECT status, COUNT(*) FROM pending_receipt_print GROUP BY status",
        null,
    ).use { cursor ->
        var pending = 0
        var failed = 0
        while (cursor.moveToNext()) {
            when (cursor.getString(0)) {
                "pending" -> pending = cursor.getInt(1)
                "failed" -> failed = cursor.getInt(1)
            }
        }
        NativeReceiptPrintQueueState(pending, failed)
    }

    fun receiptPrintStatus(jobId: String): String? = readableDatabase.rawQuery(
        "SELECT status FROM pending_receipt_print WHERE job_id = ?",
        arrayOf(jobId),
    ).use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null }

    /** A missing row means the server accepted the stable checkout command. */
    fun checkoutStatus(operationId: String): String? = readableDatabase.rawQuery(
        "SELECT status FROM pending_operation WHERE operation_id = ?",
        arrayOf(operationId),
    ).use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null }

    /**
     * Claims a physical print before calling the vendor service. A process
     * death during that call becomes a failed job, never an automatic retry
     * that could create a duplicate paper receipt.
     */
    fun claimReceiptPrint(jobId: String? = null, includeFailed: Boolean = false): NativePendingReceiptPrint? {
        val acceptedStatuses = if (includeFailed) "('pending', 'failed')" else "('pending')"
        val jobSelection = if (jobId == null) {
            "status IN $acceptedStatuses"
        } else {
            "job_id = ? AND status IN $acceptedStatuses"
        }
        // A permanently rejected checkout must never produce a sale receipt.
        // Pending offline cash remains printable as an accepted local command.
        val selection = "$jobSelection AND entity_id NOT IN (SELECT entity_id FROM pending_operation WHERE status = 'failed')"
        val selectionArgs = jobId?.let { arrayOf(it) }
        writableDatabase.beginTransaction()
        try {
            val job = writableDatabase.rawQuery(
                "SELECT job_id, entity_id, content, copies, status, attempt, last_error FROM pending_receipt_print WHERE $selection ORDER BY created_at ASC LIMIT 1",
                selectionArgs,
            ).use { cursor ->
                if (!cursor.moveToFirst()) return@use null
                NativePendingReceiptPrint(
                    jobId = cursor.getString(0),
                    entityId = cursor.getString(1),
                    content = cursor.getString(2),
                    copies = cursor.getInt(3),
                    status = cursor.getString(4),
                    attempt = cursor.getInt(5),
                    lastError = cursor.getString(6),
                )
            } ?: return null
            val nextAttempt = job.attempt + 1
            val claimed = writableDatabase.update(
                "pending_receipt_print",
                ContentValues().apply {
                    put("status", "printing")
                    put("attempt", nextAttempt)
                    putNull("last_error")
                },
                "job_id = ? AND status = ?",
                arrayOf(job.jobId, job.status),
            ) == 1
            if (!claimed) return null
            writableDatabase.setTransactionSuccessful()
            return job.copy(status = "printing", attempt = nextAttempt, lastError = null)
        } finally {
            writableDatabase.endTransaction()
        }
    }

    fun markReceiptPrintCompleted(jobId: String) {
        writableDatabase.update(
            "pending_receipt_print",
            ContentValues().apply {
                put("status", "printed")
                putNull("last_error")
            },
            "job_id = ?",
            arrayOf(jobId),
        )
    }

    fun markReceiptPrintFailed(jobId: String, message: String) {
        writableDatabase.update(
            "pending_receipt_print",
            ContentValues().apply {
                put("status", "failed")
                put("last_error", message.take(500))
            },
            "job_id = ?",
            arrayOf(jobId),
        )
    }

    fun recoverInterruptedReceiptPrints() {
        writableDatabase.update(
            "pending_receipt_print",
            ContentValues().apply {
                put("status", "failed")
                put("last_error", copy.closedWhilePrinting)
            },
            "status = 'printing'",
            null,
        )
    }

    /**
     * Preserves data already collected by the Capacitor POS during the native
     * upgrade. The old shell and the native app use the same Android sandbox,
     * but different SQLite databases, so importing is explicit and one-way.
     */
    fun importLegacySnapshotIfNeeded(context: Context): Boolean {
        if (readTerminal() != null) return false
        val legacyName = context.databaseList().firstOrNull {
            it.startsWith("cleanhub_pos_offline") && it != DATABASE_NAME
        } ?: return false
        val legacyPath = context.getDatabasePath(legacyName)
        if (!legacyPath.isFile) return false
        return runCatching {
            SQLiteDatabase.openDatabase(legacyPath.absolutePath, null, SQLiteDatabase.OPEN_READONLY).use { legacy ->
                val runtimeJson = legacy.readLegacyValue("cleanhub:pos-runtime:v1") ?: return@use false
                val runtimeSnapshot = JSONObject(runtimeJson)
                val runtime = runtimeSnapshot.getJSONObject("runtime")
                val syncedAt = runtimeSnapshot.getLongInstant("updatedAt") ?: return@use false
                val terminal = NativeTerminal(
                    tenantId = runtime.requiredString("tenantId"),
                    branchId = runtime.requiredString("branchId"),
                    terminalId = runtime.requiredString("terminalId"),
                    userId = runtime.requiredString("userId"),
                    role = runtime.optString("role", "cashier"),
                    timeZone = runtime.optString("timeZone", "UTC"),
                    credentialVersion = runtime.getInt("terminalCredentialVersion"),
                    currency = runtime.requiredString("currency"),
                    merchantName = runtime.optString("merchantName", "CleanHub"),
                    branchName = runtime.optString("branchName", ""),
                    lastSyncedAt = syncedAt,
                )
                val catalogKey = "cleanhub:pos-catalog:v1:${terminal.tenantId}:${terminal.branchId}:${terminal.terminalId}"
                val catalogJson = legacy.readLegacyValue(catalogKey) ?: return@use false
                val catalogSnapshot = JSONObject(catalogJson)
                val products = catalogSnapshot.getJSONArray("products").toNativeProducts(terminal.currency)
                val cashKey = "cleanhub:pos-cash-state:v1:${terminal.tenantId}:${terminal.branchId}:${terminal.terminalId}:${terminal.userId}:${terminal.credentialVersion}"
                val cashState = legacy.readLegacyValue(cashKey)?.let { parseLegacyCashState(it, terminal) }
                replaceSnapshot(terminal, products, cashState)
                true
            }
        }.getOrDefault(false)
    }

    fun replaceSnapshot(
        terminal: NativeTerminal,
        products: List<NativeProduct>,
        cashState: NativeCashState?,
        services: List<NativeService>? = null,
        customers: List<NativeCustomer>? = null,
        tickets: List<NativeServiceTicket>? = null,
    ) {
        writableDatabase.beginTransaction()
        try {
            val reservedBySku = reservedQuantitiesBySku()
            writableDatabase.insertWithOnConflict("terminal_state", null, ContentValues().apply {
                put("singleton", 1)
                put("tenant_id", terminal.tenantId)
                put("branch_id", terminal.branchId)
                put("terminal_id", terminal.terminalId)
                put("user_id", terminal.userId)
                put("role", terminal.role)
                put("time_zone", terminal.timeZone)
                put("credential_version", terminal.credentialVersion)
                put("currency", terminal.currency)
                put("merchant_name", terminal.merchantName)
                put("branch_name", terminal.branchName)
                put("synced_at", terminal.lastSyncedAt)
            }, SQLiteDatabase.CONFLICT_REPLACE)
            writableDatabase.delete("catalog_product", null, null)
            products.forEach { product ->
                insertProduct(product.copy(
                    reservedOfflineQuantity = reservedBySku[product.skuId] ?: product.reservedOfflineQuantity,
                ))
            }
            services?.let { rows ->
                writableDatabase.delete("catalog_service", null, null)
                rows.forEach(::insertService)
            }
            customers?.let { rows ->
                writableDatabase.delete("customer_profile", null, null)
                rows.forEach(::insertCustomer)
            }
            tickets?.let { rows ->
                writableDatabase.delete("service_ticket", null, null)
                rows.forEach(::insertTicket)
            }
            writableDatabase.insertWithOnConflict("catalog_state", null, ContentValues().apply {
                put("singleton", 1)
                put("synced_at", terminal.lastSyncedAt)
            }, SQLiteDatabase.CONFLICT_REPLACE)
            if (cashState == null) {
                writableDatabase.delete("cash_state", null, null)
            } else {
                writableDatabase.insertWithOnConflict("cash_state", null, ContentValues().apply {
                    put("singleton", 1)
                    if (cashState.shiftId == null) putNull("shift_id") else put("shift_id", cashState.shiftId)
                    if (cashState.registerSessionId == null) putNull("register_session_id") else put("register_session_id", cashState.registerSessionId)
                    put("cash_session_id", cashState.cashSessionId)
                    put("cash_handling_mode", cashState.cashHandlingMode)
                    put("synced_at", cashState.updatedAt)
                }, SQLiteDatabase.CONFLICT_REPLACE)
            }
            writableDatabase.setTransactionSuccessful()
        } finally {
            writableDatabase.endTransaction()
        }
    }

    /**
     * Online cash orders still use the durable command before the API request,
     * but only an offline order consumes the branch's offline-sale allowance
     * and local stock buffer. A product marked online-only must remain sellable
     * while the device has a live connection.
     */
    fun enqueueCheckout(
        cart: NativePosCart,
        checkoutRequest: NativeCheckoutRequest,
        reserveOfflineStock: Boolean,
        receiptPrintDraft: NativeReceiptPrintDraft? = null,
    ): NativeCheckoutResult {
        require(!cart.isEmpty) { copy.cartIsEmpty }
        val now = System.currentTimeMillis()
        val terminal = snapshot(now).terminal ?: throw NativePosValidationException(copy.localDataExpired)
        val taxSettings = checkoutSettings()
        if (!taxSettings.taxReady) throw NativePosValidationException(copy.taxReadinessMessage(taxSettings.taxReadinessCode))
        val paymentMethod = checkoutRequest.paymentMethod
        require(paymentMethod in setOf("cash", "wave", "orange_money", "later")) { "Unsupported payment method" }
        val cashState = if (paymentMethod == "cash") {
            snapshot(now).cashState?.takeIf { it.isOfflineCashReady() }
                ?: throw NativePosValidationException(copy.shiftAndDrawerRequired)
        } else null
        val totalMinor = checkoutRequest.expectedTotalMinor
        require(totalMinor > 0) { copy.totalMustBePositive }
        if (paymentMethod == "cash" && checkoutRequest.tenderedMinor < totalMinor) {
            throw NativePosValidationException(copy.tenderBelowTotalShort)
        }
        if (paymentMethod in setOf("wave", "orange_money") && checkoutRequest.externalReference.orEmpty().trim().length < 3) {
            throw NativePosValidationException(copy.paymentReferenceRequired)
        }
        if (paymentMethod == "later" && (cart.customer == null || checkoutRequest.unpaidReason.orEmpty().trim().length < 3 || checkoutRequest.balanceDueAt.isNullOrBlank())) {
            throw NativePosValidationException(copy.payLaterDetailsRequired)
        }
        val discountCode = checkoutRequest.discountCode?.trim()?.takeIf { it.isNotEmpty() }
        val discountReason = checkoutRequest.discountReason?.trim()?.takeIf { it.isNotEmpty() }
        if (discountCode != null && (discountReason == null || discountReason.length < 3)) {
            throw NativePosValidationException(copy.discountReasonRequired)
        }

        writableDatabase.beginTransaction()
        try {
            if (reserveOfflineStock) {
                cart.products.forEach { line -> reserveOfflineStock(line) }
            }
            val orderId = cart.checkoutId
            val operationId = NativeUlid.create(now + 1)
            val paymentIdempotencyKey = "$orderId:$paymentMethod"
            val payload = JSONObject().apply {
                put("expectedTotalAmount", minorToMoney(totalMinor))
                put("settlementIntent", if (paymentMethod == "later") "pay_later" else "pay_now")
                if (paymentMethod == "later") {
                    put("balanceDueAt", checkoutRequest.balanceDueAt)
                    put("unpaidReason", checkoutRequest.unpaidReason?.trim())
                }
                put("order", JSONObject().apply {
                    put("id", orderId)
                    put("orderType", "manual")
                    put("branchId", terminal.branchId)
                    cart.customer?.let { put("customerId", it.id) }
                    discountCode?.let { code ->
                        put("discountCode", code)
                        put("discountReason", discountReason)
                        put("discountIdempotencyKey", NativeUlid.create(now + 2))
                    }
                    put("items", JSONArray().apply {
                        cart.products.forEach { line ->
                            put(JSONObject().apply {
                                put("productSkuId", line.skuId)
                                put("quantity", line.quantity.toString())
                            })
                        }
                        cart.ticketItems.forEach { line ->
                            put(JSONObject().apply {
                                put("ticketId", line.ticketId)
                                put("ticketItemId", line.ticketItemId)
                            })
                        }
                    })
                })
                checkoutRequest.taxExemptionReason?.trim()?.takeIf { it.isNotEmpty() }
                    ?.let { put("taxExemptionReason", it) }
                checkoutRequest.cashRoundingStep?.takeIf { paymentMethod == "cash" && it > 1 }?.let { step ->
                    put("cashRoundingApplied", true)
                    put("cashRoundingStep", step)
                }
                if (paymentMethod != "later") put("payment", JSONObject().apply {
                    put("paymentMethod", if (paymentMethod == "cash") "cash" else "app")
                    put("amount", minorToMoney(totalMinor))
                    if (paymentMethod == "cash") {
                        put("tenderedAmount", minorToMoney(checkoutRequest.tenderedMinor))
                        cashState?.shiftId?.let { put("shiftId", it) }
                        cashState?.registerSessionId?.let { put("registerSessionId", it) }
                        cashState?.cashSessionId?.let { put("cashDrawerSessionId", it) }
                        put("occurredAt", java.time.Instant.ofEpochMilli(NativeServerClock.now(now)).toString())
                    } else {
                        put("provider", paymentMethod)
                        put("externalReference", checkoutRequest.externalReference?.trim())
                    }
                    put("idempotencyKey", paymentIdempotencyKey)
                })
            }.toString()
            val sequence = nextSequence()
            writableDatabase.insertOrThrow("pending_operation", null, ContentValues().apply {
                put("operation_id", operationId)
                put("sequence", sequence)
                put("entity_id", orderId)
                put("idempotency_key", orderId)
                put("payload_json", payload)
                put("created_at", now)
                put("status", "pending")
            })
            val printJobId = receiptPrintDraft?.let { draft ->
                require(draft.content.isNotBlank()) { copy.receiptContentEmpty }
                require(draft.copies in 1..10) { copy.printCopiesRangeTen }
                NativeUlid.create(now + 2).also { jobId ->
                    writableDatabase.insertOrThrow("pending_receipt_print", null, ContentValues().apply {
                        put("job_id", jobId)
                        put("entity_id", orderId)
                        put("content", draft.content)
                        put("copies", draft.copies)
                        put("created_at", now)
                        put("status", "pending")
                        put("attempt", 0)
                    })
                }
            }
            // The accepted cash command and removing the active cart must be
            // atomic. Otherwise a process death after taking cash could reopen
            // the same basket and allow the cashier to charge it twice.
            clearActiveCart(terminal)
            writableDatabase.setTransactionSuccessful()
            return NativeCheckoutResult(operationId, orderId, printJobId)
        } finally {
            writableDatabase.endTransaction()
        }
    }

    /**
     * Writes a ticket settlement before cash changes hands. Ticket item ids are
     * part of the durable command, so a later server-side ticket edit cannot
     * silently add work to a sale that was already accepted by the cashier.
     */
    fun enqueueTicketCheckout(
        ticket: NativeServiceTicket,
        items: List<NativeTicketItem>,
        tenderedMinor: Long,
    ): NativeCheckoutResult {
        require(items.isNotEmpty()) { copy.ticketHasNoBillableItems }
        if (ticket.ticketStatus == "cancelled" || ticket.ticketStatus == "picked_up") {
            throw NativePosValidationException(copy.ticketAlreadyClosed)
        }
        val now = System.currentTimeMillis()
        snapshot(now).terminal
            ?: throw NativePosValidationException(copy.localDataExpired)
        val cashState = snapshot(now).cashState
            ?: throw NativePosValidationException(copy.noValidShiftOrDrawer)
        if (!cashState.isOfflineCashReady()) {
            throw NativePosValidationException(copy.shiftAndDrawerRequired)
        }
        val totalMinor = items.sumOf { it.lineAmountMinor }
        if (tenderedMinor < totalMinor) {
            throw NativePosValidationException(copy.tenderBelowTotalShort)
        }

        writableDatabase.beginTransaction()
        try {
            val orderId = NativeUlid.create(now)
            val operationId = NativeUlid.create(now + 1)
            val payload = JSONObject().apply {
                put("expectedTotalAmount", minorToMoney(totalMinor))
                put("settlementIntent", "pay_now")
                put("order", JSONObject().apply {
                    put("id", orderId)
                    put("orderType", "ticket")
                    put("ticketId", ticket.id)
                    put("ticketItemIds", JSONArray().apply {
                        items.forEach { put(it.id) }
                    })
                })
                put("payment", JSONObject().apply {
                    put("paymentMethod", "cash")
                    put("amount", minorToMoney(totalMinor))
                    put("tenderedAmount", minorToMoney(tenderedMinor))
                    put("shiftId", cashState.shiftId)
                    put("registerSessionId", cashState.registerSessionId)
                    cashState.cashSessionId?.let { put("cashDrawerSessionId", it) }
                    put("occurredAt", Instant.ofEpochMilli(NativeServerClock.now(now)).toString())
                    put("idempotencyKey", "$orderId:cash")
                })
            }.toString()
            writableDatabase.insertOrThrow("pending_operation", null, ContentValues().apply {
                put("operation_id", operationId)
                put("sequence", nextSequence())
                put("entity_id", orderId)
                put("idempotency_key", orderId)
                put("payload_json", payload)
                put("created_at", now)
                put("status", "pending")
            })
            writableDatabase.setTransactionSuccessful()
            return NativeCheckoutResult(operationId, orderId)
        } finally {
            writableDatabase.endTransaction()
        }
    }

    /**
     * The active cart has the same scope as POS Web's offline cart: tenant,
     * branch, terminal and staff member. A different employee using the same
     * device can therefore never inherit another cashier's basket.
     */
    fun cart(terminal: NativeTerminal): NativePosCart {
        val state = readableDatabase.rawQuery(
            "SELECT checkout_id, currency, customer_id, customer_name FROM pos_cart_state WHERE tenant_id = ? AND branch_id = ? AND terminal_id = ? AND user_id = ?",
            cartScopeArgs(terminal),
        ).use { cursor ->
            if (!cursor.moveToFirst()) null else NativePosCartState(
                checkoutId = cursor.getString(0),
                currency = cursor.getString(1),
                customerId = cursor.getStringOrNull(2),
                customerName = cursor.getStringOrNull(3),
            )
        }
        return NativePosCart(
            checkoutId = state?.checkoutId ?: NativeUlid.create(),
            currency = state?.currency ?: terminal.currency,
            customer = state?.customerId?.let { customerId ->
                NativeCartCustomer(customerId, state.customerName.orEmpty())
            },
            products = cartProductLines(terminal),
            ticketItems = cartTicketItems(terminal),
        )
    }

    private fun cartProductLines(terminal: NativeTerminal): List<NativeCartLine> = readableDatabase.rawQuery(
        "SELECT sku_id, name, amount_minor, quantity, tax_rate FROM pos_cart_line WHERE tenant_id = ? AND branch_id = ? AND terminal_id = ? AND user_id = ? ORDER BY rowid ASC",
        cartScopeArgs(terminal),
    ).use { cursor ->
        buildList {
            while (cursor.moveToNext()) {
                add(NativeCartLine(
                    skuId = cursor.getString(0),
                    name = cursor.getString(1),
                    amountMinor = cursor.getLong(2),
                    quantity = cursor.getLong(3),
                    taxRate = cursor.getStringOrNull(4),
                ))
            }
        }
    }

    private fun cartTicketItems(terminal: NativeTerminal): List<NativeTicketCartLine> = readableDatabase.rawQuery(
        "SELECT ticket_id, ticket_item_id, ticket_code, service_id, name, pricing_unit, quantity, weight, bag_count, unit_amount_minor, line_amount_minor, currency, customer_id, customer_name FROM pos_cart_ticket_item WHERE tenant_id = ? AND branch_id = ? AND terminal_id = ? AND user_id = ? ORDER BY rowid ASC",
        cartScopeArgs(terminal),
    ).use { cursor ->
        buildList {
            while (cursor.moveToNext()) {
                add(NativeTicketCartLine(
                    ticketId = cursor.getString(0),
                    ticketItemId = cursor.getString(1),
                    ticketCode = cursor.getString(2),
                    serviceId = cursor.getStringOrNull(3),
                    name = cursor.getString(4),
                    pricingUnit = cursor.getString(5),
                    quantity = cursor.getLong(6),
                    weight = cursor.getStringOrNull(7),
                    bagCount = if (cursor.isNull(8)) null else cursor.getLong(8),
                    unitAmountMinor = cursor.getLong(9),
                    lineAmountMinor = cursor.getLong(10),
                    currency = cursor.getString(11),
                    customerId = cursor.getString(12),
                    customerName = cursor.getString(13),
                ))
            }
        }
    }

    /** Replaces one scoped cart; callers serialize writes before invoking it. */
    fun replaceCart(terminal: NativeTerminal, cart: NativePosCart) {
        require(cart.currency == terminal.currency) { copy.cartCurrencyMismatch }
        writableDatabase.beginTransaction()
        try {
            writableDatabase.insertWithOnConflict("pos_cart_state", null, ContentValues().apply {
                put("tenant_id", terminal.tenantId)
                put("branch_id", terminal.branchId)
                put("terminal_id", terminal.terminalId)
                put("user_id", terminal.userId)
                put("checkout_id", cart.checkoutId)
                put("currency", cart.currency)
                cart.customer?.let {
                    put("customer_id", it.id)
                    put("customer_name", it.name)
                } ?: run {
                    putNull("customer_id")
                    putNull("customer_name")
                }
            }, SQLiteDatabase.CONFLICT_REPLACE)
            replaceProductCartLines(terminal, cart.products)
            replaceTicketCartLines(terminal, cart.ticketItems)
            writableDatabase.setTransactionSuccessful()
        } finally {
            writableDatabase.endTransaction()
        }
    }

    fun replaceTicketItems(ticketId: String, items: List<NativeTicketItem>) {
        writableDatabase.beginTransaction()
        try {
            writableDatabase.delete("service_ticket_item", "ticket_id = ?", arrayOf(ticketId))
            items.forEach(::insertTicketItem)
            writableDatabase.setTransactionSuccessful()
        } finally {
            writableDatabase.endTransaction()
        }
    }

    /** Cache the server's order references so offline checkout cannot re-bill an item after a cold restart. */
    fun replaceTicketBilledItems(ticketId: String, itemIds: Set<String>) {
        writableDatabase.beginTransaction()
        try {
            writableDatabase.delete("service_ticket_billed_item", "ticket_id = ?", arrayOf(ticketId))
            itemIds.forEach { itemId ->
                writableDatabase.insertOrThrow("service_ticket_billed_item", null, ContentValues().apply {
                    put("ticket_id", ticketId)
                    put("item_id", itemId)
                })
            }
            writableDatabase.setTransactionSuccessful()
        } finally {
            writableDatabase.endTransaction()
        }
    }

    fun ticketBilledItemIds(ticketId: String): Set<String> = readableDatabase.rawQuery(
        "SELECT item_id FROM service_ticket_billed_item WHERE ticket_id = ?",
        arrayOf(ticketId),
    ).use { cursor -> buildSet { while (cursor.moveToNext()) add(cursor.getString(0)) } }

    /** A successfully replayed cash checkout is now a server order, even before the next ticket refresh. */
    fun markTicketItemsBilled(ticketId: String, itemIds: Set<String>) {
        if (itemIds.isEmpty()) return
        writableDatabase.beginTransaction()
        try {
            itemIds.forEach { itemId ->
                writableDatabase.insertWithOnConflict("service_ticket_billed_item", null, ContentValues().apply {
                    put("ticket_id", ticketId)
                    put("item_id", itemId)
                }, SQLiteDatabase.CONFLICT_IGNORE)
            }
            writableDatabase.setTransactionSuccessful()
        } finally {
            writableDatabase.endTransaction()
        }
    }

    /** Failed commands deliberately remain unavailable until a manager resolves or replays them. */
    fun pendingTicketItemIds(ticketId: String): Set<String> = readableDatabase.rawQuery(
        "SELECT payload_json FROM pending_operation WHERE status IN ('pending', 'failed')",
        null,
    ).use { cursor ->
        buildSet {
            while (cursor.moveToNext()) {
                val order = runCatching {
                    JSONObject(cursor.getString(0)).optJSONObject("order")
                }.getOrNull() ?: continue
                if (order.optString("ticketId") == ticketId) {
                    val ids = order.optJSONArray("ticketItemIds") ?: continue
                    for (index in 0 until ids.length()) ids.optString(index).takeIf { it.isNotBlank() }?.let(::add)
                } else {
                    val items = order.optJSONArray("items") ?: continue
                    for (index in 0 until items.length()) {
                        val item = items.optJSONObject(index) ?: continue
                        if (item.optString("ticketId") == ticketId) {
                            item.optString("ticketItemId").takeIf { it.isNotBlank() }?.let(::add)
                        }
                    }
                }
            }
        }
    }

    fun ticketItems(ticketId: String): List<NativeTicketItem> = readableDatabase.rawQuery(
        "SELECT id, ticket_id, service_id, item_name, item_type, item_category, item_color, item_brand, item_material, item_status, quantity, pricing_unit, standard_unit_amount_minor, charged_unit_amount_minor, line_amount_minor, currency, weight, bag_count, label_code, defect_notes, special_request, remark FROM service_ticket_item WHERE ticket_id = ? ORDER BY rowid ASC",
        arrayOf(ticketId),
    ).use { cursor ->
        buildList {
            while (cursor.moveToNext()) add(NativeTicketItem(
                id = cursor.getString(0),
                ticketId = cursor.getString(1),
                serviceId = cursor.getStringOrNull(2),
                itemName = cursor.getString(3),
                itemType = cursor.getStringOrNull(4),
                itemCategory = cursor.getStringOrNull(5),
                itemColor = cursor.getStringOrNull(6),
                itemBrand = cursor.getStringOrNull(7),
                itemMaterial = cursor.getStringOrNull(8),
                itemStatus = cursor.getString(9),
                quantity = cursor.getLong(10),
                pricingUnit = cursor.getString(11),
                standardUnitAmountMinor = cursor.getLong(12),
                chargedUnitAmountMinor = cursor.getLong(13),
                lineAmountMinor = cursor.getLong(14),
                currency = cursor.getString(15),
                weight = cursor.getStringOrNull(16),
                bagCount = if (cursor.isNull(17)) null else cursor.getLong(17),
                labelCode = cursor.getStringOrNull(18),
                defectNotes = cursor.getStringOrNull(19),
                specialRequest = cursor.getStringOrNull(20),
                remark = cursor.getStringOrNull(21),
            ))
        }
    }

    fun hasPendingTicketCheckout(ticketId: String): Boolean = readableDatabase.rawQuery(
        "SELECT 1 FROM pending_operation WHERE status IN ('pending', 'failed') AND payload_json LIKE ? LIMIT 1",
        arrayOf("""%"ticketId":"$ticketId"%"""),
    ).use { cursor -> cursor.moveToFirst() }

    fun listPendingCheckouts(): List<NativePendingCheckout> = readableDatabase.rawQuery(
        "SELECT operation_id, sequence, entity_id, idempotency_key, payload_json, attempt FROM pending_operation WHERE status = 'pending' ORDER BY sequence ASC",
        null,
    ).use { cursor ->
        buildList {
            while (cursor.moveToNext()) {
                add(NativePendingCheckout(
                    operationId = cursor.getString(0),
                    sequence = cursor.getLong(1),
                    orderId = cursor.getString(2),
                    idempotencyKey = cursor.getString(3),
                    payloadJson = cursor.getString(4),
                    attempt = cursor.getInt(5),
                ))
            }
        }
    }

    fun markCheckoutSynced(operationId: String) {
        writableDatabase.beginTransaction()
        try {
            val payload = readableDatabase.rawQuery(
                "SELECT payload_json FROM pending_operation WHERE operation_id = ?",
                arrayOf(operationId),
            ).use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null }
            payload?.let(::releaseOfflineStock)
            writableDatabase.delete("pending_operation", "operation_id = ?", arrayOf(operationId))
            writableDatabase.setTransactionSuccessful()
        } finally {
            writableDatabase.endTransaction()
        }
    }

    fun markCheckoutFailed(operationId: String, message: String) {
        writableDatabase.beginTransaction()
        try {
            val orderId = writableDatabase.rawQuery(
                "SELECT entity_id FROM pending_operation WHERE operation_id = ?",
                arrayOf(operationId),
            ).use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null }
            writableDatabase.update(
                "pending_operation",
                ContentValues().apply {
                    put("status", "failed")
                    put("last_error", message.take(500))
                },
                "operation_id = ?",
                arrayOf(operationId),
            )
            orderId?.let {
                writableDatabase.update(
                    "pending_receipt_print",
                    ContentValues().apply {
                        put("status", "failed")
                        put("last_error", message.take(500))
                    },
                    "entity_id = ? AND status = 'pending'",
                    arrayOf(it),
                )
            }
            writableDatabase.setTransactionSuccessful()
        } finally {
            writableDatabase.endTransaction()
        }
    }

    /**
     * Count one replay attempt and report how many this command has now had.
     *
     * Transient failures are counted too. A server that is unreachable for a
     * week is indistinguishable from one that will never accept the command,
     * and an uncounted retry loop would keep the sale pending forever with
     * nobody told.
     */
    fun recordCheckoutAttempt(operationId: String): Int {
        writableDatabase.execSQL(
            "UPDATE pending_operation SET attempt = attempt + 1 WHERE operation_id = ?",
            arrayOf(operationId),
        )
        return readableDatabase.rawQuery(
            "SELECT attempt FROM pending_operation WHERE operation_id = ?",
            arrayOf(operationId),
        ).use { cursor -> if (cursor.moveToFirst()) cursor.getInt(0) else 0 }
    }

    private fun createReferenceTables(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS catalog_service (
              id TEXT PRIMARY KEY NOT NULL,
              name TEXT NOT NULL,
              business_line TEXT NOT NULL,
              pricing_unit TEXT NOT NULL,
              amount_minor INTEGER NOT NULL,
              currency TEXT NOT NULL,
              default_item_type TEXT NOT NULL,
              applicable_item_types TEXT NOT NULL DEFAULT '[]',
              tax_rate TEXT
            )
            """.trimIndent(),
        )
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS customer_profile (
              id TEXT PRIMARY KEY NOT NULL,
              account_id TEXT NOT NULL,
              full_name TEXT NOT NULL,
              account_name TEXT NOT NULL,
              phone TEXT,
              email TEXT,
              status TEXT NOT NULL
            )
            """.trimIndent(),
        )
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS service_ticket (
              id TEXT PRIMARY KEY NOT NULL,
              ticket_no TEXT,
              customer_id TEXT NOT NULL,
              customer_name TEXT NOT NULL,
              ticket_type TEXT NOT NULL,
              ticket_status TEXT NOT NULL,
              priority TEXT NOT NULL,
              item_count INTEGER NOT NULL,
              total_minor INTEGER NOT NULL,
              currency TEXT NOT NULL,
              expected_pickup_at TEXT,
              created_at TEXT NOT NULL DEFAULT '',
              updated_at TEXT NOT NULL DEFAULT '',
              version INTEGER NOT NULL
            )
            """.trimIndent(),
        )
        createTicketItemTable(db)
    }

    private fun createTicketItemTable(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS service_ticket_item (
              id TEXT PRIMARY KEY NOT NULL,
              ticket_id TEXT NOT NULL,
              service_id TEXT,
              item_name TEXT NOT NULL,
              item_type TEXT,
              item_category TEXT,
              item_color TEXT,
              item_brand TEXT,
              item_material TEXT,
              item_status TEXT NOT NULL,
              quantity INTEGER NOT NULL,
              pricing_unit TEXT NOT NULL,
              standard_unit_amount_minor INTEGER NOT NULL DEFAULT 0,
              charged_unit_amount_minor INTEGER NOT NULL DEFAULT 0,
              line_amount_minor INTEGER NOT NULL,
              currency TEXT NOT NULL,
              weight TEXT,
              bag_count INTEGER,
              label_code TEXT,
              defect_notes TEXT,
              special_request TEXT,
              remark TEXT
            )
            """.trimIndent(),
        )
    }

    private fun createTicketBillingTable(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS service_ticket_billed_item (
              ticket_id TEXT NOT NULL,
              item_id TEXT NOT NULL,
              PRIMARY KEY (ticket_id, item_id)
            )
            """.trimIndent(),
        )
    }

    private fun createProductCartTable(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS pos_cart_line (
              tenant_id TEXT NOT NULL,
              branch_id TEXT NOT NULL,
              terminal_id TEXT NOT NULL,
              user_id TEXT NOT NULL,
              sku_id TEXT NOT NULL,
              name TEXT NOT NULL,
              amount_minor INTEGER NOT NULL,
              quantity INTEGER NOT NULL CHECK (quantity > 0),
              tax_rate TEXT,
              PRIMARY KEY (tenant_id, branch_id, terminal_id, user_id, sku_id)
            )
            """.trimIndent(),
        )
    }

    private fun createCartStateTable(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS pos_cart_state (
              tenant_id TEXT NOT NULL,
              branch_id TEXT NOT NULL,
              terminal_id TEXT NOT NULL,
              user_id TEXT NOT NULL,
              checkout_id TEXT NOT NULL,
              currency TEXT NOT NULL,
              customer_id TEXT,
              customer_name TEXT,
              PRIMARY KEY (tenant_id, branch_id, terminal_id, user_id)
            )
            """.trimIndent(),
        )
    }

    private fun createTicketCartTable(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS pos_cart_ticket_item (
              tenant_id TEXT NOT NULL,
              branch_id TEXT NOT NULL,
              terminal_id TEXT NOT NULL,
              user_id TEXT NOT NULL,
              ticket_id TEXT NOT NULL,
              ticket_item_id TEXT NOT NULL,
              ticket_code TEXT NOT NULL,
              service_id TEXT,
              name TEXT NOT NULL,
              pricing_unit TEXT NOT NULL,
              quantity INTEGER NOT NULL,
              weight TEXT,
              bag_count INTEGER,
              unit_amount_minor INTEGER NOT NULL,
              line_amount_minor INTEGER NOT NULL,
              currency TEXT NOT NULL,
              customer_id TEXT NOT NULL,
              customer_name TEXT NOT NULL,
              PRIMARY KEY (tenant_id, branch_id, terminal_id, user_id, ticket_item_id)
            )
            """.trimIndent(),
        )
    }

    private fun createReceiptPrintTables(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS receipt_print_settings (
              singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
              auto_print_receipt INTEGER NOT NULL,
              print_copies INTEGER NOT NULL CHECK (print_copies BETWEEN 1 AND 10),
              updated_at INTEGER NOT NULL
            )
            """.trimIndent(),
        )
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS pending_receipt_print (
              job_id TEXT PRIMARY KEY NOT NULL,
              entity_id TEXT NOT NULL,
              content TEXT NOT NULL,
              copies INTEGER NOT NULL CHECK (copies BETWEEN 1 AND 10),
              created_at INTEGER NOT NULL,
              status TEXT NOT NULL CHECK (status IN ('pending', 'printing', 'failed', 'printed')),
              attempt INTEGER NOT NULL DEFAULT 0,
              last_error TEXT
            )
            """.trimIndent(),
        )
    }

    private fun createReceiptPrinterBindingTable(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS receipt_printer_binding (
              singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
              printer_id TEXT NOT NULL,
              updated_at INTEGER NOT NULL
            )
            """.trimIndent(),
        )
    }

    private fun createCheckoutSettingsTable(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS checkout_settings (
              singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
              rounding_rule TEXT NOT NULL DEFAULT 'none',
              cash_rounding_step INTEGER NOT NULL DEFAULT 1,
              tax_enabled INTEGER NOT NULL DEFAULT 0,
              tax_ready INTEGER NOT NULL DEFAULT 0,
              tax_readiness_code TEXT,
              default_tax_rate TEXT NOT NULL DEFAULT '0.0000',
              prices_include_tax INTEGER NOT NULL DEFAULT 1,
              tax_registration_number TEXT,
              tax_label TEXT,
              tax_components_json TEXT NOT NULL DEFAULT '[]',
              email_receipt_enabled INTEGER NOT NULL DEFAULT 0,
              auto_print_receipt INTEGER NOT NULL DEFAULT 1,
              lock_timeout_seconds INTEGER NOT NULL DEFAULT 0,
              default_payment_method TEXT NOT NULL DEFAULT 'cash',
              payment_methods_enabled TEXT NOT NULL DEFAULT '["cash"]',
              mobile_money_providers_enabled TEXT NOT NULL DEFAULT '[]',
              receipt_profile_json TEXT NOT NULL DEFAULT '{}',
              updated_at INTEGER NOT NULL
            )
            """.trimIndent(),
        )
    }

    private fun clearCartLines(terminal: NativeTerminal) {
        writableDatabase.delete(
            "pos_cart_line",
            "tenant_id = ? AND branch_id = ? AND terminal_id = ? AND user_id = ?",
            cartScopeArgs(terminal),
        )
    }

    private fun replaceProductCartLines(terminal: NativeTerminal, lines: List<NativeCartLine>) {
        clearCartLines(terminal)
        lines.filter { it.quantity > 0 }.forEach { line ->
            writableDatabase.insertOrThrow("pos_cart_line", null, ContentValues().apply {
                put("tenant_id", terminal.tenantId)
                put("branch_id", terminal.branchId)
                put("terminal_id", terminal.terminalId)
                put("user_id", terminal.userId)
                put("sku_id", line.skuId)
                put("name", line.name)
                put("amount_minor", line.amountMinor)
                put("quantity", line.quantity)
                if (line.taxRate == null) putNull("tax_rate") else put("tax_rate", line.taxRate)
            })
        }
    }

    private fun replaceTicketCartLines(terminal: NativeTerminal, lines: List<NativeTicketCartLine>) {
        writableDatabase.delete(
            "pos_cart_ticket_item",
            "tenant_id = ? AND branch_id = ? AND terminal_id = ? AND user_id = ?",
            cartScopeArgs(terminal),
        )
        lines.forEach { line ->
            writableDatabase.insertOrThrow("pos_cart_ticket_item", null, ContentValues().apply {
                put("tenant_id", terminal.tenantId)
                put("branch_id", terminal.branchId)
                put("terminal_id", terminal.terminalId)
                put("user_id", terminal.userId)
                put("ticket_id", line.ticketId)
                put("ticket_item_id", line.ticketItemId)
                put("ticket_code", line.ticketCode)
                if (line.serviceId == null) putNull("service_id") else put("service_id", line.serviceId)
                put("name", line.name)
                put("pricing_unit", line.pricingUnit)
                put("quantity", line.quantity)
                if (line.weight == null) putNull("weight") else put("weight", line.weight)
                if (line.bagCount == null) putNull("bag_count") else put("bag_count", line.bagCount)
                put("unit_amount_minor", line.unitAmountMinor)
                put("line_amount_minor", line.lineAmountMinor)
                put("currency", line.currency)
                put("customer_id", line.customerId)
                put("customer_name", line.customerName)
            })
        }
    }

    private fun clearActiveCart(terminal: NativeTerminal) {
        clearCartLines(terminal)
        writableDatabase.delete(
            "pos_cart_ticket_item",
            "tenant_id = ? AND branch_id = ? AND terminal_id = ? AND user_id = ?",
            cartScopeArgs(terminal),
        )
        writableDatabase.delete(
            "pos_cart_state",
            "tenant_id = ? AND branch_id = ? AND terminal_id = ? AND user_id = ?",
            cartScopeArgs(terminal),
        )
    }

    private fun cartScopeArgs(terminal: NativeTerminal): Array<String> = arrayOf(
        terminal.tenantId,
        terminal.branchId,
        terminal.terminalId,
        terminal.userId,
    )

    private fun reserveOfflineStock(line: NativeCartLine) {
        val stock = readableDatabase.rawQuery(
            "SELECT track_inventory, available_quantity, allow_negative_stock, offline_stock_buffer, reserved_offline_quantity FROM catalog_product WHERE sku_id = ?",
            arrayOf(line.skuId),
        ).use { cursor ->
            if (!cursor.moveToFirst()) throw NativePosValidationException(copy.catalogChanged)
            NativeOfflineStockState(
                trackInventory = cursor.getInt(0) == 1,
                availableQuantity = if (cursor.isNull(1)) null else cursor.getLong(1),
                allowNegativeStock = cursor.getInt(2) == 1,
                offlineStockBuffer = cursor.getLong(3),
                reservedOfflineQuantity = cursor.getLong(4),
            )
        }
        // Every product that has been synchronised to this terminal can be
        // sold offline. The cached stock balance, branch buffer, and local
        // queued sales still prevent an untracked over-sale.
        if (stock.trackInventory && !stock.allowNegativeStock && (
                stock.availableQuantity == null ||
                    stock.availableQuantity - stock.offlineStockBuffer - stock.reservedOfflineQuantity < line.quantity
            )
        ) {
            throw NativePosValidationException(copy.offlineBufferExhausted)
        }
        writableDatabase.execSQL(
            "UPDATE catalog_product SET reserved_offline_quantity = reserved_offline_quantity + ? WHERE sku_id = ?",
            arrayOf(line.quantity, line.skuId),
        )
    }

    /**
     * A replayed checkout has reached the server, so its local stock hold must
     * be released before the next catalog refresh. Failed commands intentionally
     * keep their hold until an administrator resolves the exception.
     */
    private fun releaseOfflineStock(payloadJson: String) {
        val items = runCatching {
            JSONObject(payloadJson).optJSONObject("order")?.optJSONArray("items")
        }.getOrNull() ?: return
        for (index in 0 until items.length()) {
            val item = items.optJSONObject(index) ?: continue
            val skuId = item.optString("productSkuId").takeIf { it.isNotBlank() } ?: continue
            val quantity = item.optString("quantity").toLongOrNull()?.takeIf { it > 0 } ?: continue
            writableDatabase.execSQL(
                "UPDATE catalog_product SET reserved_offline_quantity = CASE WHEN reserved_offline_quantity > ? THEN reserved_offline_quantity - ? ELSE 0 END WHERE sku_id = ?",
                arrayOf(quantity, quantity, skuId),
            )
        }
    }

    private fun insertProduct(product: NativeProduct) {
        writableDatabase.insertOrThrow("catalog_product", null, ContentValues().apply {
            put("sku_id", product.skuId)
            put("product_id", product.productId)
            put("price_id", product.priceId)
            put("name", product.name)
            put("sku", product.sku)
            put("amount_minor", product.amountMinor)
            put("currency", product.currency)
            put("track_inventory", if (product.trackInventory) 1 else 0)
            if (product.availableQuantity == null) putNull("available_quantity") else put("available_quantity", product.availableQuantity)
            put("allow_negative_stock", if (product.allowNegativeStock) 1 else 0)
            put("allow_offline_sale", if (product.allowOfflineSale) 1 else 0)
            put("offline_stock_buffer", product.offlineStockBuffer)
            put("reserved_offline_quantity", product.reservedOfflineQuantity)
            if (product.taxRate == null) putNull("tax_rate") else put("tax_rate", product.taxRate)
        })
    }

    private fun insertService(service: NativeService) {
        writableDatabase.insertOrThrow("catalog_service", null, ContentValues().apply {
            put("id", service.id)
            put("name", service.name)
            put("business_line", service.businessLine)
            put("pricing_unit", service.pricingUnit)
            put("amount_minor", service.amountMinor)
            put("currency", service.currency)
            put("default_item_type", service.defaultItemType)
            put("applicable_item_types", JSONArray().apply {
                service.applicableItemTypes.forEach(::put)
            }.toString())
            if (service.taxRate == null) putNull("tax_rate") else put("tax_rate", service.taxRate)
        })
    }

    private fun insertCustomer(customer: NativeCustomer) {
        writableDatabase.insertOrThrow("customer_profile", null, ContentValues().apply {
            put("id", customer.id)
            put("account_id", customer.accountId)
            put("full_name", customer.fullName)
            put("account_name", customer.accountName)
            if (customer.phone == null) putNull("phone") else put("phone", customer.phone)
            if (customer.email == null) putNull("email") else put("email", customer.email)
            put("status", customer.status)
        })
    }

    private fun insertTicket(ticket: NativeServiceTicket) {
        writableDatabase.insertOrThrow("service_ticket", null, ContentValues().apply {
            put("id", ticket.id)
            if (ticket.ticketNo == null) putNull("ticket_no") else put("ticket_no", ticket.ticketNo)
            put("customer_id", ticket.customerId)
            put("customer_name", ticket.customerName)
            put("ticket_type", ticket.ticketType)
            put("ticket_status", ticket.ticketStatus)
            put("priority", ticket.priority)
            put("item_count", ticket.itemCount)
            put("total_minor", ticket.totalMinor)
            put("currency", ticket.currency)
            if (ticket.expectedPickupAt == null) putNull("expected_pickup_at") else put("expected_pickup_at", ticket.expectedPickupAt)
            put("created_at", ticket.createdAt)
            put("updated_at", ticket.updatedAt)
            put("version", ticket.version)
        })
    }

    private fun insertTicketItem(item: NativeTicketItem) {
        writableDatabase.insertOrThrow("service_ticket_item", null, ContentValues().apply {
            put("id", item.id)
            put("ticket_id", item.ticketId)
            if (item.serviceId == null) putNull("service_id") else put("service_id", item.serviceId)
            put("item_name", item.itemName)
            if (item.itemType == null) putNull("item_type") else put("item_type", item.itemType)
            if (item.itemCategory == null) putNull("item_category") else put("item_category", item.itemCategory)
            if (item.itemColor == null) putNull("item_color") else put("item_color", item.itemColor)
            if (item.itemBrand == null) putNull("item_brand") else put("item_brand", item.itemBrand)
            if (item.itemMaterial == null) putNull("item_material") else put("item_material", item.itemMaterial)
            put("item_status", item.itemStatus)
            put("quantity", item.quantity)
            put("pricing_unit", item.pricingUnit)
            put("standard_unit_amount_minor", item.standardUnitAmountMinor)
            put("charged_unit_amount_minor", item.chargedUnitAmountMinor)
            put("line_amount_minor", item.lineAmountMinor)
            put("currency", item.currency)
            if (item.weight == null) putNull("weight") else put("weight", item.weight)
            if (item.bagCount == null) putNull("bag_count") else put("bag_count", item.bagCount)
            if (item.labelCode == null) putNull("label_code") else put("label_code", item.labelCode)
            if (item.defectNotes == null) putNull("defect_notes") else put("defect_notes", item.defectNotes)
            if (item.specialRequest == null) putNull("special_request") else put("special_request", item.specialRequest)
            if (item.remark == null) putNull("remark") else put("remark", item.remark)
        })
    }

    private fun readTerminal(): NativeTerminal? = readableDatabase.rawQuery(
        "SELECT tenant_id, branch_id, terminal_id, user_id, role, time_zone, credential_version, currency, merchant_name, branch_name, synced_at FROM terminal_state WHERE singleton = 1", null,
    ).use { cursor ->
        if (!cursor.moveToFirst()) return null
        NativeTerminal(cursor.getString(0), cursor.getString(1), cursor.getString(2), cursor.getString(3), cursor.getString(4), cursor.getString(5), cursor.getInt(6), cursor.getString(7), cursor.getString(8), cursor.getString(9), cursor.getLong(10))
    }

    private fun readCashState(): NativeCashState? = readableDatabase.rawQuery(
        "SELECT shift_id, register_session_id, cash_session_id, cash_handling_mode, synced_at FROM cash_state WHERE singleton = 1", null,
    ).use { cursor ->
        if (!cursor.moveToFirst()) return null
        NativeCashState(cursor.getStringOrNull(0), cursor.getStringOrNull(1), cursor.getStringOrNull(2), cursor.getString(3), cursor.getLong(4))
    }

    private fun readProducts(): List<NativeProduct> = readableDatabase.rawQuery(
        "SELECT sku_id, product_id, price_id, name, sku, amount_minor, currency, track_inventory, available_quantity, allow_negative_stock, allow_offline_sale, offline_stock_buffer, reserved_offline_quantity, tax_rate FROM catalog_product ORDER BY name COLLATE NOCASE", null,
    ).use { cursor ->
        buildList {
            while (cursor.moveToNext()) add(NativeProduct(cursor.getString(0), cursor.getString(1), cursor.getString(2), cursor.getString(3), cursor.getString(4), cursor.getLong(5), cursor.getString(6), cursor.getInt(7) == 1, if (cursor.isNull(8)) null else cursor.getLong(8), cursor.getInt(9) == 1, cursor.getInt(10) == 1, cursor.getLong(11), cursor.getLong(12), cursor.getStringOrNull(13)))
        }
    }

    private fun readServices(): List<NativeService> = readableDatabase.rawQuery(
        "SELECT id, name, business_line, pricing_unit, amount_minor, currency, default_item_type, applicable_item_types, tax_rate FROM catalog_service ORDER BY name COLLATE NOCASE", null,
    ).use { cursor ->
        buildList {
            while (cursor.moveToNext()) add(NativeService(
                cursor.getString(0), cursor.getString(1), cursor.getString(2), cursor.getString(3), cursor.getLong(4), cursor.getString(5), cursor.getString(6),
                runCatching {
                    val values = JSONArray(cursor.getString(7))
                    buildList { for (index in 0 until values.length()) values.optString(index).takeIf { it.isNotBlank() }?.let(::add) }
                }.getOrElse { listOf(cursor.getString(6)) },
                cursor.getStringOrNull(8),
            ))
        }
    }

    private fun readCustomers(): List<NativeCustomer> = readableDatabase.rawQuery(
        "SELECT id, account_id, full_name, account_name, phone, email, status FROM customer_profile WHERE status = 'active' ORDER BY full_name COLLATE NOCASE", null,
    ).use { cursor ->
        buildList {
            while (cursor.moveToNext()) add(NativeCustomer(cursor.getString(0), cursor.getString(1), cursor.getString(2), cursor.getString(3), cursor.getStringOrNull(4), cursor.getStringOrNull(5), cursor.getString(6)))
        }
    }

    private fun readTickets(): List<NativeServiceTicket> = readableDatabase.rawQuery(
        "SELECT id, ticket_no, customer_id, customer_name, ticket_type, ticket_status, priority, item_count, total_minor, currency, expected_pickup_at, created_at, updated_at, version FROM service_ticket ORDER BY updated_at DESC, created_at DESC, rowid DESC", null,
    ).use { cursor ->
        buildList {
            while (cursor.moveToNext()) add(NativeServiceTicket(
                id = cursor.getString(0),
                ticketNo = cursor.getStringOrNull(1),
                customerId = cursor.getString(2),
                customerName = cursor.getString(3),
                ticketType = cursor.getString(4),
                ticketStatus = cursor.getString(5),
                priority = cursor.getString(6),
                itemCount = cursor.getLong(7),
                totalMinor = cursor.getLong(8),
                currency = cursor.getString(9),
                expectedPickupAt = cursor.getStringOrNull(10),
                createdAt = cursor.getString(11),
                updatedAt = cursor.getString(12),
                version = cursor.getLong(13),
            ))
        }
    }

    private fun hasFreshCatalog(now: Long): Boolean = readableDatabase.rawQuery(
        "SELECT synced_at FROM catalog_state WHERE singleton = 1", null,
    ).use { cursor -> cursor.moveToFirst() && now - cursor.getLong(0) in 0..MAX_CATALOG_AGE_MS }
    private fun countPendingSales(): Int = readableDatabase.rawQuery("SELECT COUNT(*) FROM pending_operation WHERE status = 'pending'", null).use { cursor -> cursor.moveToFirst(); cursor.getInt(0) }
    private fun countFailedSales(): Int = readableDatabase.rawQuery("SELECT COUNT(*) FROM pending_operation WHERE status = 'failed'", null).use { cursor -> cursor.moveToFirst(); cursor.getInt(0) }
    private fun nextSequence(): Long = readableDatabase.rawQuery("SELECT COALESCE(MAX(sequence), 0) + 1 FROM pending_operation", null).use { cursor -> cursor.moveToFirst(); cursor.getLong(0) }
    private fun reservedQuantitiesBySku(): Map<String, Long> = readableDatabase.rawQuery(
        "SELECT sku_id, reserved_offline_quantity FROM catalog_product WHERE reserved_offline_quantity > 0", null,
    ).use { cursor -> buildMap { while (cursor.moveToNext()) put(cursor.getString(0), cursor.getLong(1)) } }
    private fun android.database.Cursor.getStringOrNull(index: Int): String? = if (isNull(index)) null else getString(index)
    private fun minorToMoney(value: Long): String = "%d.%02d".format(java.util.Locale.ROOT, value / 100, value % 100)

    private fun SQLiteDatabase.readLegacyValue(key: String): String? = rawQuery(
        "SELECT value FROM offline_kv WHERE key = ?", arrayOf(key),
    ).use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null }

    private fun parseLegacyCashState(json: String, terminal: NativeTerminal): NativeCashState? = runCatching {
        val snapshot = JSONObject(json)
        val updatedAt = snapshot.getLongInstant("updatedAt") ?: return null
        val shift = snapshot.optJSONObject("currentShift")
        val register = snapshot.getJSONObject("register")
        val registerSession = register.optJSONObject("registerSession")
        val cashSession = register.optJSONObject("cashSession")
        val mode = register.requiredString("cashHandlingMode")
        if (mode == "none" ||
            (shift != null && (shift.optString("status") != "open" || shift.optString("tenantId") != terminal.tenantId ||
                shift.optString("branchId") != terminal.branchId || shift.optString("staffId") != terminal.userId)) ||
            (registerSession != null && (registerSession.optString("status") != "open" || registerSession.optString("terminalId") != terminal.terminalId)) ||
            (cashSession != null && cashSession.optString("status") != "open")) return null
        NativeCashState(
            shiftId = shift?.requiredString("id"),
            registerSessionId = registerSession?.requiredString("id"),
            cashSessionId = cashSession?.optString("id")?.takeIf { it.isNotBlank() },
            cashHandlingMode = mode,
            updatedAt = updatedAt,
        )
    }.getOrNull()

    private fun JSONArray.toNativeProducts(currency: String): List<NativeProduct> = buildList {
        for (index in 0 until length()) {
            val product = optJSONObject(index) ?: continue
            if (product.optString("currency") != currency) continue
            val amountMinor = product.optString("amount").toMinorUnits() ?: continue
            add(
                NativeProduct(
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
                ),
            )
        }
    }

    private fun JSONObject.requiredString(key: String): String = getString(key).trim().also {
        require(it.isNotEmpty()) { "$key is required." }
    }
    private fun JSONObject.getLongInstant(key: String): Long? = optString(key).takeIf { it.isNotBlank() }?.let { Instant.parse(it).toEpochMilli() }
    private fun String.toMinorUnits(): Long? = runCatching {
        val decimal = java.math.BigDecimal(this)
        decimal.movePointRight(2).setScale(0, java.math.RoundingMode.UNNECESSARY).longValueExact()
    }.getOrNull()
}
