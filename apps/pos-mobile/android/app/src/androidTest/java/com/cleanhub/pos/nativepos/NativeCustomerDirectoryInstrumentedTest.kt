package com.cleanhub.pos.nativepos

import android.graphics.Bitmap
import android.os.ParcelFileDescriptor
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.io.File

class NativeCustomerDirectoryInstrumentedTest {
    @get:Rule val compose = createComposeRule()
    private val context get() = InstrumentationRegistry.getInstrumentation().targetContext
    private fun terminal() = NativeTerminal(NativeUlid.create(), "branch-one", "terminal-test", "cashier-test", "cashier", "Africa/Dakar", 1,
        "XOF", "CleanHub", "Branch one", System.currentTimeMillis())
    private fun profile(id: String = NativeUlid.create(), name: String = "Amina Diop", status: String = "active") = JSONObject()
        .put("id", id).put("customerAccountId", "account-one").put("fullName", name).put("accountName", "Diop family")
        .put("phone", "+221 77 123 45 67").put("email", "amina@example.com").put("status", status)
        .put("createdAt", "2026-10-20T09:00:00Z")
    private fun page(vararg profiles: JSONObject) = JSONObject().put("total", profiles.size).put("data", JSONArray().apply {
        profiles.forEach { put(JSONObject().put("kind", "profile").put("profile", it)) }
    })
    private val noNetwork = object : NativeCustomerDirectoryGateway {
        override fun get(path: String): JSONObject = error("Unexpected network call")
        override fun post(path: String, body: JSONObject): JSONObject = error("Unexpected network call")
    }

    @Test fun cachedDirectoryPersistsStatusChangesAndNeverCrossesBranches() {
        val terminal = terminal()
        var db = NativePosDatabase(context)
        try {
            db.replaceSnapshot(terminal, emptyList(), null)
            var repository = NativeCustomerDirectory(db, noNetwork)
            val active = profile()
            val disabled = profile(name = "Moussa Fall", status = "disabled")
            repository.rememberPage(terminal, page(active, disabled), 123_000)
            assertEquals(1, db.snapshot().customers.size)
            db.intakeStore.close(); db.close()
            db = NativePosDatabase(context)
            repository = NativeCustomerDirectory(db, noNetwork)
            assertEquals(2, repository.cachedPage(terminal, "", "all", 0, emptyList()).total)
            assertEquals(1, repository.cachedPage(terminal, "", "disabled", 0, emptyList()).total)
            assertEquals(2, repository.cachedPage(terminal, "77-123", "all", 0, emptyList()).total)
            assertEquals(123_000L, repository.cachedPage(terminal, "", "all", 0, emptyList()).syncedAt)
            repository.rememberProfile(terminal, JSONObject(active.toString()).put("status", "disabled"))
            assertTrue(db.snapshot().customers.isEmpty())
            assertEquals(2, repository.cachedPage(terminal, "", "disabled", 0, emptyList()).total)
            val other = terminal.copy(branchId = "branch-two")
            db.replaceSnapshot(other, emptyList(), null)
            assertEquals(0, repository.cachedPage(other, "", "all", 0, emptyList()).total)
            try { repository.cachedPage(terminal, "", "all", 0, emptyList()); fail("Old scope must be rejected") }
            catch (_: IllegalStateException) { }
        } finally { db.intakeStore.close(); db.close() }
    }

    @Test fun onlineSearchPagesAcrossAllCustomersAndSavesResultsForOfflineSearch() {
        val terminal = terminal()
        val db = NativePosDatabase(context)
        try {
            db.replaceSnapshot(terminal, emptyList(), null)
            var requested = ""
            val gateway = object : NativeCustomerDirectoryGateway {
                override fun get(path: String): JSONObject { requested = path; return page(profile(status = "disabled")).put("total", 43) }
                override fun post(path: String, body: JSONObject): JSONObject = error("Unexpected mutation")
            }
            val repository = NativeCustomerDirectory(db, gateway)
            val result = repository.refreshPage(terminal, "amina@example.com", "disabled", 20)
            assertTrue(requested.contains("q=amina%40example.com"))
            assertTrue(requested.contains("offset=20") && requested.contains("status=disabled"))
            assertEquals(43, result.total)
            assertFalse(result.cached)
            val cached = repository.cachedPage(terminal, "amina@example.com", "disabled", 0, emptyList())
            assertTrue(cached.cached)
            assertEquals(1, cached.total)
            assertEquals("Amina Diop", cached.entries.single().customer.fullName)
        } finally { db.intakeStore.close(); db.close() }
    }

    @Test fun creationRetriesAfterRestartReuseBothServerIds() {
        val terminal = terminal()
        var db = NativePosDatabase(context)
        val accountIds = mutableListOf<String>()
        val profileIds = mutableListOf<String>()
        var failProfile = true
        val gateway = object : NativeCustomerDirectoryGateway {
            override fun get(path: String): JSONObject = error("Unexpected query")
            override fun post(path: String, body: JSONObject): JSONObject {
                if (path == "/pos/accounts") {
                    accountIds.add(body.getString("id"))
                    return JSONObject(body.toString()).put("status", "active")
                }
                profileIds.add(body.getString("id"))
                if (failProfile) { failProfile = false; throw NativePosApiException(0, "NETWORK_ERROR", "Disconnected") }
                return JSONObject(body.toString()).put("customerAccountId", accountIds.last()).put("status", "active")
            }
        }
        try {
            db.replaceSnapshot(terminal, emptyList(), null)
            val input = JSONObject().put("fullName", " Amina Diop ").put("phone", "771234567")
            try { NativeCustomerDirectory(db, gateway).create(terminal, input); fail("First profile request must fail") }
            catch (_: NativePosApiException) { }
            db.intakeStore.close(); db.close()
            db = NativePosDatabase(context)
            val created = NativeCustomerDirectory(db, gateway).create(terminal, JSONObject().put("phone", "771234567").put("fullName", "Amina Diop"))
            assertEquals(2, accountIds.size)
            assertEquals(accountIds.first(), accountIds.last())
            assertEquals(profileIds.first(), profileIds.last())
            assertEquals(26, created.id.length)
            assertEquals(created.id, db.snapshot().customers.single().id)
            assertNull(db.intakeStore.cached(terminal, "customer-create", "pending"))
        } finally { db.intakeStore.close(); db.close() }
    }

    private fun saveScreenshot(name: String) {
        val image = File(context.getExternalFilesDir(null), name)
        image.outputStream().use { compose.onRoot().captureToImage().asAndroidBitmap().compress(Bitmap.CompressFormat.PNG, 100, it) }
        ParcelFileDescriptor.AutoCloseInputStream(InstrumentationRegistry.getInstrumentation().uiAutomation.executeShellCommand("cp ${image.absolutePath} /sdcard/Download/$name")).use { it.readBytes() }
    }

    @Test fun wideDirectoryShowsTableAndDisablesOfflineRegistration() {
        val copy = nativePosCopy("en")
        val selected = mutableStateOf<String?>(null)
        val query = mutableStateOf("")
        val entries = listOf(NativeCustomerDirectoryEntry(profile().directoryCustomer(), "2026-10-20T09:00:00Z"),
            NativeCustomerDirectoryEntry(profile(name = "Moussa Fall", status = "disabled").directoryCustomer(), "2026-10-19T09:00:00Z"))
        compose.setContent { MaterialTheme(colorScheme = nativePosColors) {
            Box(Modifier.width(1000.dp).height(720.dp)) {
                NativeCustomerDirectoryList(copy, NativeCustomerDirectoryPage(entries, 2, System.currentTimeMillis(), true), query.value, "all", "Africa/Dakar", false, false, null,
                    {}, { query.value = it }, {}, {}, {}, { selected.value = it.id }, 0, {})
            }
        } }
        compose.onNodeWithText(copy.customerDirectoryContact).assertIsDisplayed()
        compose.onNodeWithText(copy.customerDirectoryStatus).assertIsDisplayed()
        compose.onNodeWithText(copy.newCustomer).assertIsNotEnabled()
        compose.onNodeWithText(copy.customerDirectoryOffline).assertIsDisplayed()
        compose.onNodeWithText("Amina Diop").performClick()
        compose.runOnIdle { assertEquals(entries.first().customer.id, selected.value) }
        saveScreenshot("cleanhub-customers-wide.png")
        compose.onNode(hasSetTextAction()).performTextInput("amina")
        compose.runOnIdle { assertEquals("amina", query.value) }
    }

    @Test fun narrowDirectoryShowsReadableCustomerCards() {
        val copy = nativePosCopy("fr")
        val entry = NativeCustomerDirectoryEntry(profile().directoryCustomer(), "2026-10-20T09:00:00Z")
        compose.setContent { MaterialTheme(colorScheme = nativePosColors) {
            Box(Modifier.width(460.dp).height(800.dp)) {
                NativeCustomerDirectoryList(copy, NativeCustomerDirectoryPage(listOf(entry), 1, System.currentTimeMillis(), true), "", "all", "Africa/Dakar", false, false, null,
                    {}, {}, {}, {}, {}, {}, 0, {})
            }
        } }
        compose.onNodeWithText("Amina Diop").assertIsDisplayed()
        compose.onNodeWithText(copy.customerDirectoryContact).assertDoesNotExist()
        compose.onNodeWithText(copy.customerDirectoryDetails).assertIsDisplayed()
        saveScreenshot("cleanhub-customers-narrow.png")
    }

    @Test fun customerOrderHistoryRemainsClickableOffline() {
        val terminal = terminal()
        val customer = profile().directoryCustomer()
        NativePosDatabase(context).let { db ->
            db.replaceSnapshot(terminal, emptyList(), null)
            db.intakeStore.cache(terminal, "customer", customer.id, profile(customer.id).put("address", "Dakar"))
            db.intakeStore.cache(terminal, "customer-page", "${customer.id}:orders:0", JSONObject().put("total", 1).put("data", JSONArray().put(
                JSONObject().put("id", "01TESTORDER0000000000000001").put("orderNo", "ORDER-OFFLINE-01").put("status", "paid").put("paymentStatus", "paid").put("totalAmount", "1200").put("currency", "XOF"))))
            db.intakeStore.close(); db.close()
        }
        val opened = mutableStateOf<String?>(null)
        val copy = nativePosCopy("en")
        compose.setContent { MaterialTheme(colorScheme = nativePosColors) {
            Column(Modifier.width(1000.dp).height(750.dp).verticalScroll(rememberScrollState())) {
                NativeCustomerDetailPanel(copy, customer, emptyList(), false, false, {}, {}, {}, { opened.value = it }, {})
            }
        } }
        compose.waitUntil { compose.onAllNodesWithText("Dakar").fetchSemanticsNodes().isNotEmpty() }
        saveScreenshot("cleanhub-customer-detail-offline.png")
        compose.onNodeWithText(copy.detailCustomerOrders).performScrollTo().performClick()
        compose.onNodeWithText("ORDER-OFFLINE-01").performScrollTo().performClick()
        compose.runOnIdle { assertEquals("01TESTORDER0000000000000001", opened.value) }
    }
}
