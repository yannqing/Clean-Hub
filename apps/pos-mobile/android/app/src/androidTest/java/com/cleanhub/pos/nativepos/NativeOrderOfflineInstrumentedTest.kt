package com.cleanhub.pos.nativepos

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.test.platform.app.InstrumentationRegistry
import android.graphics.Bitmap
import android.os.ParcelFileDescriptor
import java.io.File
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class NativeOrderOfflineInstrumentedTest {
    @get:Rule val compose = createComposeRule()

    private fun terminal(branch: String) = NativeTerminal(
        "tenant-test", branch, "terminal-test", "cashier-test", "cashier", "Africa/Dakar", 1,
        "XOF", "CleanHub", "Branch $branch", System.currentTimeMillis(),
    )

    private fun summary(branch: String, updated: String = "2026-10-20T10:00:00Z") = JSONObject()
        .put("id", "01TESTORDER0000000000000001")
        .put("tenantId", "tenant-test")
        .put("branchId", branch)
        .put("customerName", "Amina")
        .put("totalAmount", "1200")
        .put("paidAmount", "1200")
        .put("currency", "XOF")
        .put("orderType", "manual")
        .put("status", "paid")
        .put("paymentStatus", "paid")
        .put("itemCount", 2)
        .put("createdAt", "2026-10-20T09:00:00Z")
        .put("updatedAt", updated)

    @Test fun summariesAndDetailsSurviveRestartAndNeverCrossBranches() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        context.deleteDatabase("cleanhub_native_pos.db")
        val first = terminal("branch-one")
        var database = NativePosDatabase(context)
        try {
            database.replaceSnapshot(first, emptyList(), null)
            database.replaceOrderSummaries(first, JSONArray().put(summary(first.branchId)), 10_000L)
            assertEquals(1, database.cachedOrderSummaries(first).length())
            assertEquals(10_000L, database.orderCacheSyncedAt(first))
            assertTrue(database.orderDetailsNeedingRefresh(first).isNotEmpty())

            val detail = summary(first.branchId).put("items", JSONArray())
            assertTrue(database.replaceOrderDetail(first, detail, JSONArray(), JSONArray(), 20_000L))
            assertEquals("Amina", database.cachedOrderDetail(first, detail.getString("id"))
                ?.getJSONObject("order")?.getString("customerName"))
            assertFalse(database.replaceOrderDetail(first, summary("another-branch"), JSONArray(), JSONArray()))

            database.close()
            database = NativePosDatabase(context)
            assertNotNull(database.cachedOrderDetail(first, detail.getString("id")))
            database.replaceOrderSummaries(first, JSONArray().put(summary(first.branchId, "2026-10-21T10:00:00Z")))
            assertTrue(database.orderDetailsNeedingRefresh(first).contains(detail.getString("id")))

            try {
                database.replaceOrderSummaries(first, JSONArray().put(summary("another-branch")))
                fail("Mixed-branch list must be rejected")
            } catch (_: IllegalArgumentException) {
                assertEquals(1, database.cachedOrderSummaries(first).length())
            }

            val second = terminal("branch-two")
            database.replaceSnapshot(second, emptyList(), null)
            assertEquals(0, database.cachedOrderSummaries(second).length())
            assertNull(database.cachedOrderDetail(second, detail.getString("id")))
            assertNull(database.cachedOrderDetail(first, detail.getString("id")))
            assertNull(database.orderCacheSyncedAt(second))
        } finally {
            database.close()
            context.deleteDatabase("cleanhub_native_pos.db")
        }
    }

    @Test fun wideOrderListShowsWebColumnsAndOpensCachedRowOffline() {
        val copy = nativePosCopy("en")
        val selected = mutableStateOf<String?>(null)
        val order = NativeMoreOrder(
            "01TESTORDER0000000000000001", "Amina", "1200", "1200", "XOF", "manual",
            "paid", "paid", 2, "2026-10-20T09:00:00Z",
        )
        compose.setContent {
            MaterialTheme(colorScheme = nativePosColors) {
                Box(Modifier.width(1000.dp).height(700.dp)) {
                    NativeMoreOrdersView(copy, listOf(order), 10_000L, "Africa/Dakar", false, false,
                        null, {}, {}, { selected.value = it })
                }
            }
        }
        compose.onNodeWithText(copy.orderAmount).assertIsDisplayed()
        compose.onNodeWithText(copy.orderStatus).assertIsDisplayed()
        compose.onNodeWithText(copy.orderCreatedAt).assertIsDisplayed()
        compose.onNodeWithText(copy.orderOfflineNotice).assertIsDisplayed()
        compose.onNodeWithText("Amina").performClick()
        compose.runOnIdle { assertEquals(order.id, selected.value) }
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val image = File(context.getExternalFilesDir(null), "orders-offline-table.png")
        image.outputStream().use { compose.onRoot().captureToImage().asAndroidBitmap().compress(Bitmap.CompressFormat.PNG, 100, it) }
        ParcelFileDescriptor.AutoCloseInputStream(
            InstrumentationRegistry.getInstrumentation().uiAutomation.executeShellCommand(
                "cp ${image.absolutePath} /sdcard/Download/cleanhub-orders-offline-table.png",
            ),
        ).use { it.readBytes() }
    }

    @Test fun upgradingFromVersion24PreservesCatalogWhileAddingOrderCache() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        context.deleteDatabase("cleanhub_native_pos.db")
        val terminal = terminal("branch-one")
        var database = NativePosDatabase(context)
        try {
            val product = NativeProduct("sku-1", "product-1", "price-1", "Soap", "SOAP", 1500,
                "XOF", false, null, false, true, 0, 0, null)
            database.replaceSnapshot(terminal, listOf(product), null)
            database.writableDatabase.execSQL("DROP TABLE order_cache")
            database.writableDatabase.execSQL("DROP TABLE order_cache_state")
            database.writableDatabase.execSQL("PRAGMA user_version = 24")
            database.close()

            database = NativePosDatabase(context)
            assertEquals(terminal.branchId, database.snapshot().terminal?.branchId)
            assertEquals("SOAP", database.snapshot().products.single().sku)
            database.replaceOrderSummaries(terminal, JSONArray().put(summary(terminal.branchId)))
            assertEquals(1, database.cachedOrderSummaries(terminal).length())
        } finally {
            database.close()
            context.deleteDatabase("cleanhub_native_pos.db")
        }
    }
}
