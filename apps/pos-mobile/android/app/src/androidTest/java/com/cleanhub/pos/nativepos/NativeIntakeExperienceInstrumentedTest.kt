package com.cleanhub.pos.nativepos

import android.content.Context
import android.content.ContextWrapper
import android.database.DatabaseErrorHandler
import android.database.sqlite.SQLiteDatabase
import android.graphics.Bitmap
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import org.json.JSONArray
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class NativeIntakeExperienceInstrumentedTest {
    @get:Rule val compose = createComposeRule()
    private val copy = nativePosCopy("en")
    private val customer =
        NativeCustomer(
            "customer",
            "account",
            "Amina Fall",
            "Atelier Dakar",
            "+221771234567",
            "amina@example.test",
            "active",
        )
    private val ticket =
        NativeServiceTicket(
            "ticket",
            "TK-1001",
            customer.id,
            customer.fullName,
            "laundry",
            "draft",
            "urgent",
            1,
            150000,
            "XOF",
            "2026-10-20T14:00:00Z",
            "2026-10-19T10:00:00Z",
            "2026-10-19T10:00:00Z",
            1,
        )
    private val service =
        NativeService(
            "wash",
            "Laundry by weight",
            "laundry",
            "per_kg",
            100000,
            "XOF",
            "cloth",
            listOf("cloth"),
            null,
        )
    private var testContext: Context? = null

    private fun screenshot(name: String) {
        compose.waitForIdle()
        android.os.SystemClock.sleep(
            400
        ) // Let the platform IME/inset animation finish before visual QA.
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val file = File(instrumentation.targetContext.getExternalFilesDir(null), "$name.png")
        file.outputStream().use {
            instrumentation.uiAutomation
                .takeScreenshot()
                .compress(Bitmap.CompressFormat.PNG, 100, it)
        }
        android.os.ParcelFileDescriptor.AutoCloseInputStream(
                instrumentation.uiAutomation.executeShellCommand(
                    "cp ${file.absolutePath} /sdcard/Download/cleanhub-ui-$name.png"
                )
            )
            .use { it.readBytes() }
    }

    @After
    fun cleanup() {
        testContext?.let { context ->
            listOf("cleanhub_native_pos.db", "cleanhub_native_intake.db").forEach {
                SQLiteDatabase.deleteDatabase(context.getDatabasePath(it))
            }
        }
    }

    @Test
    fun createTicketShowsProgressAndKeepsDialogUntilLocalSaveCompletes() {
        var busy by mutableStateOf(false)
        var calls = 0
        compose.setContent {
            MaterialTheme(colorScheme = nativePosColors) {
                NativeCreateTicketDialog(
                    copy,
                    customer,
                    busy,
                    false,
                    null,
                    {},
                    { _, _, _, _ ->
                        calls++
                        busy = true
                    },
                )
            }
        }
        compose.onNodeWithText(copy.createTicket).performScrollTo().performClick()
        compose.onNodeWithText(copy.intakeSaving).assertIsDisplayed()
        compose.onNodeWithText(copy.newTicketTitle).assertExists()
        compose.onNodeWithText(copy.intakeSaving).assertIsNotEnabled()
        assertEquals(1, calls)
        screenshot("intake-creating")
    }

    @Test
    fun ticketDetailIncludesOperationalMetadataAndRelatedOrders() {
        val info =
            JSONObject()
                .put("customerProfilePhone", customer.phone)
                .put("assistantName", "Mariama")
                .put("sourceChannel", "phone")
                .put("remark", "Call before pickup")
        val orders =
            JSONArray()
                .put(
                    JSONObject()
                        .put("id", "order")
                        .put("orderNo", "ORD-009")
                        .put("status", "received")
                        .put("paymentStatus", "paid")
                        .put("currency", "XOF")
                        .put("totalAmount", "1500.00")
                        .put("createdAt", ticket.createdAt)
                )
        var opened: String? = null
        compose.setContent {
            MaterialTheme(colorScheme = nativePosColors) {
                NativeTicketDetailView(
                    copy,
                    NativeTicketDetail(
                        ticket,
                        emptyList(),
                        information = info,
                        relatedOrders = orders,
                    ),
                    listOf(service),
                    true,
                    false,
                    null,
                    {},
                    { _, _ -> },
                    {},
                    { _, _ -> },
                    { _, _ -> },
                    true,
                    { _, _ -> },
                    {},
                    {},
                    {},
                    { opened = it },
                    "Africa/Dakar",
                )
            }
        }
        compose.onNodeWithText(copy.detailBasicInformation).performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Mariama").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Call before pickup").performScrollTo().assertIsDisplayed()
        screenshot("ticket-detail-information")
        compose.onNodeWithText("ORD-009").performScrollTo().performClick()
        assertEquals("order", opened)
    }

    @Test
    fun itemEditorSupportsWeightAttributesPriceOverrideAndVisibleLoading() {
        var accepted: NativeTicketItemDraft? = null
        var busy by mutableStateOf(false)
        compose.setContent {
            MaterialTheme(colorScheme = nativePosColors) {
                NativeTicketItemForm(
                    copy,
                    ticket,
                    listOf(service),
                    null,
                    busy,
                    true,
                    null,
                    {},
                    {
                        accepted = it
                        busy = true
                    },
                )
            }
        }
        compose.onNodeWithText(copy.typeCloth).performClick()
        compose
            .onNodeWithText(
                "${service.name} · ${nativeMinorMoney(service.amountMinor,service.currency)}"
            )
            .performClick()
        compose
            .onNode(
                hasSetTextAction() and hasAnySibling(hasText(copy.weightKg)),
                useUnmergedTree = true,
            )
            .performScrollTo()
            .performTextInput("1.125")
        compose
            .onNode(
                hasSetTextAction() and hasAnySibling(hasText(copy.colorOptional)),
                useUnmergedTree = true,
            )
            .performScrollTo()
            .performTextInput("Blue")
        compose
            .onNode(
                hasSetTextAction() and hasAnySibling(hasText(copy.brandOptional)),
                useUnmergedTree = true,
            )
            .performScrollTo()
            .performTextInput("Brand")
        compose
            .onNode(
                hasSetTextAction() and hasAnySibling(hasText(copy.defectsOptional)),
                useUnmergedTree = true,
            )
            .performScrollTo()
            .performTextInput("Stain")
        compose.onNodeWithText(copy.confirmAddItem).assertIsDisplayed().performClick()
        assertEquals("1.125", accepted?.weight)
        assertEquals("Blue", accepted?.itemColor)
        assertEquals("Stain", accepted?.defectNotes)
        compose.onNodeWithText(copy.intakeSaving).assertIsDisplayed()
        screenshot("ticket-item-editor")
    }

    @Test
    fun pendingLocalTicketCannotBeSentToCheckout() {
        compose.setContent {
            MaterialTheme(colorScheme = nativePosColors) {
                NativeTicketDetailView(
                    copy,
                    NativeTicketDetail(
                        ticket,
                        emptyList(),
                        unsentIntakeIds = setOf(ticket.id),
                        intakeError = "Connection lost",
                    ),
                    listOf(service),
                    true,
                    false,
                    null,
                    {},
                    { _, _ -> },
                    {},
                    { _, _ -> },
                    { _, _ -> },
                    true,
                    { _, _ -> },
                    {},
                    {},
                    {},
                    {},
                    "Africa/Dakar",
                )
            }
        }
        compose.onNodeWithText(copy.intakeSyncBeforeCheckout).performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Connection lost").assertExists()
        compose.onNodeWithText(copy.detailRetry).assertExists()
    }

    @Test
    fun cachedCustomerProfileHasNotesAndCorrectNewTicketAction() {
        val base = InstrumentationRegistry.getInstrumentation().targetContext
        val prefix = "intake-ui-${NativeUlid.create()}-"
        val context =
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
        testContext = context
        val terminal =
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
        NativePosDatabase(context).use { it.replaceSnapshot(terminal, emptyList(), null) }
        NativePosIntakeStore(context).use {
            it.cache(
                terminal,
                "customer",
                customer.id,
                JSONObject()
                    .put("fullName", customer.fullName)
                    .put("address", "Dakar centre")
                    .put("notes", "Call Mariama before delivery")
                    .put("status", "active"),
            )
        }
        var create = false
        compose.setContent {
            CompositionLocalProvider(LocalContext provides context) {
                MaterialTheme(colorScheme = nativePosColors) {
                    Column(
                        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp)
                    ) {
                        NativeCustomerDetailPanel(
                            copy,
                            customer,
                            listOf(ticket),
                            false,
                            false,
                            {},
                            { create = true },
                            {},
                            {},
                            {},
                        )
                    }
                }
            }
        }
        compose.waitUntil(5000) {
            compose.onAllNodesWithText("Dakar centre").fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("Dakar centre").performScrollTo().assertIsDisplayed()
        screenshot("customer-detail-overview")
        compose.onNodeWithText(copy.detailCustomerNotes).performScrollTo().performClick()
        compose.onNodeWithText("Call Mariama before delivery").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText(copy.detailNewTicket).performScrollTo().performClick()
        assertTrue(create)
        compose.onNodeWithText(copy.newOrder).assertDoesNotExist()
    }
}
