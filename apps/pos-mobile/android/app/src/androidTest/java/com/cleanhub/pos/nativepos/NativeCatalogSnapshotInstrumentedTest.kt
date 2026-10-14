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
}
