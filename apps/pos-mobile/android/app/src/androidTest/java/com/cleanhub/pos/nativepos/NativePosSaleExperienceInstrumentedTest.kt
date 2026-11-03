package com.cleanhub.pos.nativepos

import android.graphics.Bitmap
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.io.File

/** Actual native UI, Android JSON and SQLite; no production credentials or server writes. */
class NativePosSaleExperienceInstrumentedTest {
    @get:Rule val compose = createComposeRule()
    private val copy = nativePosCopy("en")
    private val customer = NativeCustomer("customer-101", "account-101", "Amina Fall", "Atelier Dakar", "+221771234567", "amina@example.test", "active")

    private fun screenshot(name: String) {
        val file = File(InstrumentationRegistry.getInstrumentation().targetContext.getExternalFilesDir(null), "$name.png")
        file.outputStream().use { InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot().compress(Bitmap.CompressFormat.PNG, 100, it) }
        android.os.ParcelFileDescriptor.AutoCloseInputStream(InstrumentationRegistry.getInstrumentation().uiAutomation.executeShellCommand("cp ${file.absolutePath} /sdcard/Download/cleanhub-ui-$name.png")).use { it.readBytes() }
    }

    @Test fun retailCartSearchesBeyondTheCachedCustomersAndCanReturnToWalkIn() {
        var cart by mutableStateOf(NativePosCart.empty("XOF"))
        val queries = mutableListOf<String>()
        compose.setContent {
            MaterialTheme(colorScheme = nativePosColors) {
                Column(Modifier.width(440.dp).padding(16.dp)) {
                    NativeSaleCustomerSelector(copy, cart, emptyList(), true, false,
                        onSearch = { queries.add(it); if (it.contains("amina", true)) listOf(customer) else emptyList() },
                        onSelect = { cart = cart.copy(customer = it?.let { value -> NativeCartCustomer(value.id, value.fullName) }) })
                }
            }
        }
        compose.onNodeWithText(copy.customerSelect).performClick()
        compose.onNode(hasSetTextAction()).performTextInput("amina")
        compose.waitUntil(5000) { queries.contains("amina") }
        compose.waitUntil(5000) { compose.onAllNodesWithText(customer.fullName).fetchSemanticsNodes().isNotEmpty() }
        screenshot("sale-customer-picker")
        compose.onNodeWithText(customer.fullName).assertIsDisplayed()
        compose.onNodeWithText(customer.fullName).performClick()
        compose.runOnIdle { assertEquals(customer.id, cart.customer?.id) }
        compose.onNodeWithText(copy.customerSelect).performClick()
        compose.onNodeWithText(copy.walkInCustomer).performClick()
        compose.runOnIdle { assertNull(cart.customer) }
    }

    @Test fun onlineSearchFailureKeepsCachedMatchesAndOffersRetry() {
        compose.setContent {
            MaterialTheme(colorScheme = nativePosColors) {
                Column(Modifier.width(440.dp).padding(16.dp)) {
                    NativeSaleCustomerSelector(copy, NativePosCart.empty("XOF"), listOf(customer), true, false,
                        onSearch = { throw IllegalStateException("network") }, onSelect = {})
                }
            }
        }
        compose.onNodeWithText(copy.customerSelect).performClick()
        compose.waitUntil(5000) { compose.onAllNodesWithText(copy.customerSearchFailed).fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText(customer.fullName).assertIsDisplayed()
        compose.onNodeWithText(copy.refreshOrders).assertIsEnabled()
    }

    @Test fun queuedCashResultDoesNotClaimServerPaymentSuccess() {
        val result = NativeSaleResult("01M4D63YHY2FMC9WS6RFHRRCXM", NativeSaleState.Queued, "XOF", 125000, 150000, "cash", customer.fullName, true)
        compose.setContent { MaterialTheme(colorScheme = nativePosColors) { NativeSaleResultDialog(copy, result, {}, null) } }
        compose.onNodeWithText(copy.checkoutQueuedTitle).assertIsDisplayed()
        compose.onNodeWithText(copy.checkoutPaidTitle).assertDoesNotExist()
        compose.onNodeWithText(copy.checkoutSavedPendingHint).assertIsDisplayed()
        compose.onNodeWithText(formatMoney(25000, "XOF")).assertIsDisplayed()
        screenshot("sale-queued-result")
    }

    @Test fun confirmedCashResultShowsAmountChangeAndNextSaleAction() {
        var dismissed = false
        val result = NativeSaleResult("01M4D63YHY2FMC9WS6RFHRRCXM", NativeSaleState.Paid, "XOF", 125000, 150000, "cash", customer.fullName, true)
        compose.setContent { MaterialTheme(colorScheme = nativePosColors) { NativeSaleResultDialog(copy, result, { dismissed = true }, {}) } }
        compose.onNodeWithText(copy.checkoutPaidTitle).assertIsDisplayed()
        compose.onNodeWithText(copy.checkoutViewOrder).assertIsDisplayed()
        screenshot("sale-paid-result")
        compose.onNodeWithText(copy.checkoutContinue).performClick()
        assertTrue(dismissed)
    }

    @Test fun orderDetailKeepsHistoricalTaxesItemsAndTicketSnapshots() {
        val order = JSONObject("""{
          "id":"01M4D63YHY2FMC9WS6RFHRRCXM","customerName":"Amina Fall","currency":"XOF","status":"received","paymentStatus":"partial","version":2,
          "orderType":"ticket","subtotalAmount":"1500.00","discountAmount":"250.00","totalAmount":"1250.00","paidAmount":"1000.00",
          "taxableAmount":"1000.00","taxAmount":"250.00","taxRateSnapshot":"0.25","pricesIncludeTax":true,"taxRegistrationNumberSnapshot":"TEST-TAX-001",
          "createdAt":"2026-10-19T10:30:00Z","balanceDueAt":"2026-10-21T18:00:00Z","notes":"Please call before pickup.",
          "items":[{"id":"item","itemName":"Laundry bag","sku":"BAG-001","variantName":"Large","quantity":"2","chargedUnitAmount":"750.00","lineAmount":"1500.00"}],
          "taxComponentsSnapshot":[{"name":"Component A","rate":"0.20","taxableAmount":"1000.00","taxAmount":"200.00"},{"name":"Component B","rate":"0.05","taxableAmount":"1000.00","taxAmount":"50.00"}],
          "discountApplications":[{"title":"Welcome offer","code":"WELCOME","amount":"250.00"}],
          "ticketReferences":[{"ticketId":"ticket","ticketNo":"T-1001","ticketStatus":"ready_to_pick","expectedPickupAt":"2026-10-20T14:00:00Z","assistantName":"Mariama","remark":"Blue bag","itemCount":2,"itemAmount":"1500.00"}]
        }""").toNativeMoreOrderDetail(null)
        assertEquals("250.00", order.taxAmount)
        assertEquals(2, order.taxLines.size)
        assertEquals("BAG-001", order.items.single().sku)
        assertNull(order.items.single().weight)
        assertEquals("T-1001", order.tickets.single().number)
        val confirmedPricing = JSONObject("""{
            "subtotalAmount":"1250.00","discountAmount":"0.00","taxableAmount":"1000.00","taxAmount":"250.00","totalAmount":"1250.00",
            "taxRateSnapshot":"0.25","pricesIncludeTax":true,"taxLabelSnapshot":"TEST TAX","taxRegistrationNumberSnapshot":"TEST-ONLY-REG",
            "taxComponentsSnapshot":[{"name":"Component A","rate":"0.20","parentRate":"0.25","taxableAmount":"1000.00","taxAmount":"200.00"}],
            "taxBreakdown":[{"taxRate":"0.25","taxableAmount":"1000.00","taxAmount":"250.00"}]
        }""").toNativeConfirmedPricing()
        assertEquals("TEST-ONLY-REG", confirmedPricing.taxRegistrationNumber)
        assertEquals("TEST TAX", confirmedPricing.taxLabel)
        assertEquals(25000L, confirmedPricing.taxMinor)
        assertEquals(20000L, confirmedPricing.taxComponents.single().taxMinor)
        val mixedTaxLines = JSONObject("""{
            "taxComponentsSnapshot":[{"name":"Component A","rate":"0.20","parentRate":"0.2500","taxableAmount":"1000.00","taxAmount":"200.00"}],
            "taxBreakdown":[{"taxRate":"0.25","taxableAmount":"1000.00","taxAmount":"250.00"},{"taxRate":"0.0000","taxableAmount":"300.00","taxAmount":"0.00"}]
        }""").nativeOrderTaxLines()
        assertEquals(2, mixedTaxLines.size)
        assertEquals("300.00", mixedTaxLines.last().taxableAmount)
        compose.setContent {
            MaterialTheme(colorScheme = nativePosColors) {
                Column(Modifier.width(800.dp).fillMaxHeight().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    NativeOrderOverview(copy, order, "Africa/Dakar")
                    NativeOrderItemCard(copy, order.items.single(), order.currency)
                    NativeOrderFinancialSummary(copy, order)
                    NativeOrderTicketReferences(copy, order, "Africa/Dakar")
                }
            }
        }
        compose.onNodeWithText(copy.orderOutstanding).assertIsDisplayed()
        compose.onAllNodesWithText("XOF 250").onFirst().assertExists()
        screenshot("order-overview")
        compose.onNodeWithText("Component B 5%").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("TEST-TAX-001").assertExists()
        screenshot("order-tax-summary")
        compose.onNodeWithText("T-1001").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Mariama").assertExists()
        screenshot("order-ticket-context")
    }
}
