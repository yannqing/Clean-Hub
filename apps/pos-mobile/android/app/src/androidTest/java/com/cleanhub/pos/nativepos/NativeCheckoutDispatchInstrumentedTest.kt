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
import java.io.File

/** Real SQLite and replay coordinator with a fake gateway; no HTTP or app database access. */
class NativeCheckoutDispatchInstrumentedTest {
    private lateinit var context: Context
    private lateinit var database: NativePosDatabase
    private lateinit var terminal: NativeTerminal
    private lateinit var product: NativeProduct
    private lateinit var databaseFile: File

    @Before fun prepare() {
        val base = InstrumentationRegistry.getInstrumentation().targetContext
        val prefix = "checkout-test-${NativeUlid.create()}-"
        context = object : ContextWrapper(base) {
            override fun getApplicationContext(): Context = this
            override fun getDatabasePath(name: String): File = base.getDatabasePath(prefix + name)
            override fun openOrCreateDatabase(name: String, mode: Int, factory: SQLiteDatabase.CursorFactory?): SQLiteDatabase = base.openOrCreateDatabase(prefix + name, mode, factory)
            override fun openOrCreateDatabase(name: String, mode: Int, factory: SQLiteDatabase.CursorFactory?, handler: DatabaseErrorHandler?): SQLiteDatabase = base.openOrCreateDatabase(prefix + name, mode, factory, handler)
        }
        databaseFile = context.getDatabasePath("cleanhub_native_pos.db")
        database = NativePosDatabase(context)
        val now = System.currentTimeMillis()
        terminal = NativeTerminal("tenant", "branch", "terminal", "cashier", "cashier", "Africa/Dakar", 1, "XOF", "Test merchant", "Test store", now)
        product = NativeProduct("sku", "product", "price", "Test bag", "BAG-001", 100000, "XOF", true, 10L, false, true, 0L, 0L, null)
        database.replaceSnapshot(terminal, listOf(product), NativeCashState(null, "register", null, "untracked", now))
        database.replaceCheckoutSettings(NativeCheckoutSettings(taxReady = true, taxReadinessCode = null, taxVerifiedAt = now))
    }

    @After fun cleanUp() {
        database.close()
        SQLiteDatabase.deleteDatabase(databaseFile)
    }

    private fun enqueue(offline: Boolean = false): NativeCheckoutResult {
        val cart = NativePosCart.empty("XOF").copy(customer = NativeCartCustomer("customer", "Amina"), products = listOf(NativeCartLine(product.skuId, product.name, product.amountMinor, 1, null)))
        database.replaceCart(terminal, cart)
        return database.enqueueCheckout(cart, NativeCheckoutRequest(100000, 100000), offline)
    }

    @Test fun targetedCheckoutDoesNotReplayOlderSalesAndConsumesLocalStockOnce() {
        val first = enqueue(true)
        val second = enqueue()
        assertTrue(database.cart(terminal).isEmpty)
        assertEquals(2L, database.snapshot().products.single().reservedOfflineQuantity)
        val sent = mutableListOf<JSONObject>()
        val gateway = object : NativeCheckoutGateway {
            override fun submit(payload: JSONObject): JSONObject { sent.add(payload); return JSONObject().put("order", JSONObject().put("id", payload.getJSONObject("order").getString("id")).put("paymentStatus", "paid")) }
            override fun reportException(payload: JSONObject) { fail("No exception expected") }
        }
        val engine = NativePosSyncEngine(context, gateway)
        val revisionBefore = database.stockRevision()
        val result = engine.submitCheckout(second.operationId)
        assertNull(result.queueStatus)
        assertEquals("paid", result.paymentStatus)
        assertEquals(listOf(first.operationId), database.listPendingCheckouts().map { it.operationId })
        assertEquals(second.orderId, sent.single().getJSONObject("order").getString("id"))
        assertEquals("customer", sent.single().getJSONObject("order").getString("customerId"))
        assertEquals(9L, database.snapshot().products.single().availableQuantity)
        assertEquals(1L, database.snapshot().products.single().reservedOfflineQuantity)
        database.replaceSnapshot(terminal, listOf(product), database.snapshot().cashState, expectedStockRevision = revisionBefore)
        assertEquals(9L, database.snapshot().products.single().availableQuantity)
        engine.submitCheckout(second.operationId)
        assertEquals(1, sent.size)
        assertEquals(9L, database.snapshot().products.single().availableQuantity)
    }

    @Test fun responseLossKeepsSameCommandCustomerAndIdempotencyUntilRetrySucceeds() {
        val checkout = enqueue()
        val payloads = mutableListOf<String>()
        val gateway = object : NativeCheckoutGateway {
            override fun submit(payload: JSONObject): JSONObject {
                payloads.add(payload.toString())
                if (payloads.size == 1) throw NativePosApiException(0, "NETWORK_ERROR", "response lost")
                return JSONObject().put("order", JSONObject().put("id", payload.getJSONObject("order").getString("id")).put("paymentStatus", "paid"))
            }
            override fun reportException(payload: JSONObject) { fail("Transient failures must not be parked") }
        }
        val engine = NativePosSyncEngine(context, gateway)
        assertEquals("pending", engine.submitCheckout(checkout.operationId).queueStatus)
        assertEquals(1L, database.snapshot().products.single().reservedOfflineQuantity)
        assertNull(engine.submitCheckout(checkout.operationId).queueStatus)
        assertEquals(payloads[0], payloads[1])
        assertEquals(0L, database.snapshot().products.single().reservedOfflineQuantity)
    }

    @Test fun rejectedSaleCannotPrintEvenIfExceptionReportingLosesConnection() {
        val cart = NativePosCart.empty("XOF").copy(products = listOf(NativeCartLine(product.skuId, product.name, product.amountMinor, 1, null)))
        val checkout = database.enqueueCheckout(cart, NativeCheckoutRequest(100000, 100000), false, NativeReceiptPrintDraft("Test receipt", 1))
        val gateway = object : NativeCheckoutGateway {
            override fun submit(payload: JSONObject): JSONObject = throw NativePosApiException(409, "PRICE_CHANGED", "price changed")
            override fun reportException(payload: JSONObject) { throw NativePosApiException(0, "NETWORK_ERROR", "report failed") }
        }
        assertEquals("failed", NativePosSyncEngine(context, gateway).submitCheckout(checkout.operationId).queueStatus)
        assertEquals("failed", database.checkoutStatus(checkout.operationId))
        assertNull(database.claimReceiptPrint(checkout.printJobId))
        assertEquals(1, database.snapshot().failedSales)
    }
    @Test fun incompleteOrWrongOrderResponseDoesNotAcknowledgeDurableSale() {
        val checkout = enqueue()
        val gateway = object : NativeCheckoutGateway {
            override fun submit(payload: JSONObject): JSONObject = JSONObject("""{"order":{"id":"wrong-order","paymentStatus":"paid"}}""")
            override fun reportException(payload: JSONObject) { fail("Unknown confirmation must remain retryable") }
        }
        val result = NativePosSyncEngine(context, gateway).submitCheckout(checkout.operationId)
        assertEquals("pending", result.queueStatus)
        assertEquals("INVALID_CHECKOUT_RESPONSE", result.error?.code)
        assertEquals(checkout.orderId, database.listPendingCheckouts().single().orderId)
        assertEquals(1L, database.snapshot().products.single().reservedOfflineQuantity)
    }

}
