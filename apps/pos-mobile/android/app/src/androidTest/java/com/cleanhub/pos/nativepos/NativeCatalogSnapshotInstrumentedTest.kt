package com.cleanhub.pos.nativepos

import android.content.Context
import android.content.ContextWrapper
import android.database.DatabaseErrorHandler
import android.database.sqlite.SQLiteDatabase
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

@RunWith(AndroidJUnit4::class)
class NativeCatalogSnapshotInstrumentedTest {
    private lateinit var context: Context
    private lateinit var database: NativePosDatabase
    private val now = 1_800_000_000_000L

    @Before
    fun openIsolatedDatabase() {
        context = object : ContextWrapper(InstrumentationRegistry.getInstrumentation().targetContext) {
            private fun testName(name: String) = "catalog-regression-$name"
            override fun getDatabasePath(name: String): File = super.getDatabasePath(testName(name))
            override fun deleteDatabase(name: String): Boolean = super.deleteDatabase(testName(name))
            override fun openOrCreateDatabase(name: String, mode: Int, factory: SQLiteDatabase.CursorFactory?): SQLiteDatabase =
                super.openOrCreateDatabase(testName(name), mode, factory)
            override fun openOrCreateDatabase(name: String, mode: Int, factory: SQLiteDatabase.CursorFactory?, errorHandler: DatabaseErrorHandler?): SQLiteDatabase =
                super.openOrCreateDatabase(testName(name), mode, factory, errorHandler)
        }
        context.deleteDatabase("cleanhub_native_pos.db")
        database = NativePosDatabase(context)
    }

    @After
    fun closeIsolatedDatabase() {
        database.close()
        context.deleteDatabase("cleanhub_native_pos.db")
    }

    private fun synchronize(services: List<NativeService> = emptyList()) {
        database.replaceSnapshot(
            terminal = NativeTerminal(
                tenantId = "01KRERJN800000000000000001",
                branchId = "01KRERJN8G0000000000000040",
                terminalId = "01M4VW3N0FKXKF55PJRFR35B1K",
                userId = "01KRERJN8B0000000000000012",
                role = "owner", timeZone = "Africa/Dakar", credentialVersion = 1,
                currency = "XOF", merchantName = "Test laundry", branchName = "Test branch",
                lastSyncedAt = now,
            ),
            products = emptyList(), cashState = null, services = services,
        )
    }

    @Test
    fun fiscalCacheKeepsItsVerificationTimeWhenLocalPreferencesChange() {
        synchronize()
        database.replaceCheckoutSettings(NativeCheckoutSettings(taxReady = true, taxVerifiedAt = now))
        database.replaceCheckoutSettings(database.checkoutSettings().copy(autoPrintReceipt = false))
        val cached = database.checkoutSettings()
        assertEquals(now, cached.taxVerifiedAt)
        assertTrue(cached.taxReadyForCheckout(now + 1000))
        assertFalse(cached.taxReadyForCheckout(now + NATIVE_TAX_READINESS_MAX_AGE_MS + 1))
    }

    @Test
    fun movingToAnotherBranchClearsFiscalCacheAndPreservesPendingSales() {
        synchronize()
        database.replaceCheckoutSettings(NativeCheckoutSettings(taxReady = true, taxVerifiedAt = now))
        database.writableDatabase.execSQL("INSERT INTO pending_operation (operation_id,sequence,entity_id,idempotency_key,payload_json,status,created_at) VALUES ('pending-original',1,'order-original','key-original','{}','pending',?)", arrayOf(now))
        val previous = database.snapshot(now).terminal!!
        database.replaceSnapshot(previous.copy(branchId = "another-branch"), emptyList(), null)
        assertFalse(database.checkoutSettings().taxReady)
        assertEquals(1, database.snapshot(now).pendingSales)
    }

    @Test
    fun taxFailureCannotCreateAnyDurablePaymentCommand() {
        val runtimeNow = System.currentTimeMillis()
        synchronize()
        val terminal = database.snapshot(now).terminal!!.copy(lastSyncedAt = runtimeNow)
        database.replaceSnapshot(terminal, emptyList(), null)
        database.replaceCheckoutSettings(NativeCheckoutSettings(taxReadinessCode = "POS_TAX_COUNTRY_REQUIRED", taxVerifiedAt = runtimeNow))
        val cart = NativePosCart.empty("XOF").copy(products = listOf(NativeCartLine("sku", "Bag", 100000, 1, null)))
        try {
            database.enqueueCheckout(cart, NativeCheckoutRequest(100000, 100000), false)
            org.junit.Assert.fail("Missing country must fail before recording any payment")
        } catch (error: NativePosValidationException) {
            assertTrue(error.message in listOf("en", "fr", "zh-CN").map { nativePosCopy(it).taxReadinessMessage("POS_TAX_COUNTRY_REQUIRED") })
        }
        assertEquals(0, database.snapshot().pendingSales)
    }

    @Test
    fun aFreshServiceCatalogueDoesNotRequireRetailProducts() {
        val service = NativeService(
            id = "01KRERJN8G0000000000000041", name = "Laundry", businessLine = "laundry",
            pricingUnit = "per_item", amountMinor = 1000, currency = "XOF",
            defaultItemType = "cloth", applicableItemTypes = listOf("cloth"), taxRate = null,
        )
        synchronize(listOf(service))
        val snapshot = database.snapshot(now + 1000)
        assertTrue(snapshot.catalogIsFresh)
        assertTrue(snapshot.products.isEmpty())
        assertEquals(listOf(service), snapshot.services)
        assertNotNull(snapshot.terminal)
    }

    @Test
    fun aSuccessfullySyncedEmptyCatalogueIsFresh() {
        synchronize()
        val snapshot = database.snapshot(now + 1000)
        assertTrue(snapshot.catalogIsFresh)
        assertTrue(snapshot.products.isEmpty())
        assertTrue(snapshot.services.isEmpty())
    }

    @Test
    fun anExpiredCatalogueRequiresSyncEvenWithAnActiveTerminal() {
        synchronize()
        database.writableDatabase.execSQL(
            "UPDATE catalog_state SET synced_at = ? WHERE singleton = 1",
            arrayOf(now - 25 * 60 * 60 * 1000L),
        )
        val snapshot = database.snapshot(now)
        assertNotNull(snapshot.terminal)
        assertFalse(snapshot.catalogIsFresh)
        synchronize()
        assertTrue(database.snapshot(now).catalogIsFresh)
    }

    @Test
    fun aMissingCatalogueSyncRecordRequiresSync() {
        synchronize()
        database.writableDatabase.delete("catalog_state", null, null)
        assertFalse(database.snapshot(now).catalogIsFresh)
    }

    @Test
    fun manualFailedReceiptRetryDoesNotClaimOrdinaryPendingJobs() {
        database.writableDatabase.execSQL(
            "INSERT INTO pending_receipt_print(job_id, entity_id, content, copies, created_at, status) VALUES ('pending', 'sale-one', 'Receipt', 1, 1, 'pending'), ('failed', 'sale-two', 'Receipt', 1, 2, 'failed')",
        )
        assertEquals("failed", database.claimReceiptPrint(failedOnly = true)?.jobId)
        assertEquals("pending", database.receiptPrintStatus("pending"))
        assertNull(database.claimReceiptPrint(failedOnly = true))
        assertEquals("pending", database.claimReceiptPrint()?.jobId)
    }

    @Test
    fun automaticPrintingNeverRetriesFailedReceiptsOrRejectedSales() {
        database.writableDatabase.execSQL(
            "INSERT INTO pending_receipt_print(job_id, entity_id, content, copies, created_at, status) VALUES ('failed', 'rejected-sale', 'Receipt', 1, 1, 'failed')",
        )
        assertNull(database.claimReceiptPrint())
        database.writableDatabase.execSQL(
            "INSERT INTO pending_operation(operation_id, sequence, entity_id, idempotency_key, payload_json, created_at, status) VALUES ('operation', 1, 'rejected-sale', 'key', '{}', 1, 'failed')",
        )
        assertNull(database.claimReceiptPrint(failedOnly = true))
        assertEquals("failed", database.receiptPrintStatus("failed"))
    }
}
