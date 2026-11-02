package com.cleanhub.pos.nativepos

import org.junit.Assert.*
import org.junit.Test

class NativeFrenchFeedbackTest {
    private val fr = nativePosCopy("fr")

    @Test fun cachedFeedbackUsesTheCurrentLanguage() {
        assertEquals(fr.catalogNeedsUpdate, nativeFeedbackText(nativePosCopy("en").catalogNeedsUpdate, fr))
        assertEquals(fr.customerFallback, nativeFeedbackText(nativePosCopy("zh-CN").customerFallback, fr))
        assertEquals(fr.genericFailure, nativeFeedbackText("An undocumented provider failure", fr))
        assertEquals(fr.pinIncorrectShort, NativePosApiException(401, "INVALID_CREDENTIALS", "old wording").userMessage(fr))
        assertEquals(fr.networkError, NativePosApiException(0, "NETWORK_ERROR", "socket failed").userMessage(fr))
    }

    @Test fun apiTemplatesPreserveBusinessNamesAndCounts() {
        assertEquals("L’attribut de catégorie « Blue Cotton » est obligatoire.", nativeFeedbackText("Category attribute \"Blue Cotton\" is required.", fr))
        assertEquals("Le mot de passe doit comporter au moins 12 caractères.", nativeFeedbackText("Password must be at least 12 characters.", fr))
        assertEquals("La succursale a été modifiée. Actualisez puis réessayez.", nativeFeedbackText("Branch has been modified. Refresh and try again.", fr))
        val replay = nativeFeedbackText("Offline cash replay gave up after 25 attempts: Customer was not found.", fr)
        assertTrue(replay.contains("25"))
        assertTrue(replay.contains("Client introuvable"))
        assertFalse(replay.contains("Offline cash"))
        val system = nativeSystemNotificationText("POS synchronization error", "Old cached notice", "system", "pos_terminal", "pos-1", fr)
        assertEquals("Erreur de synchronisation POS", system.first)
        assertTrue(system.second.contains("pos-1"))
        assertEquals("Old cached notice", nativeSystemNotificationText("Merchant title", "Old cached notice", "business", "pos_terminal", "pos-1", fr).second)
        val success = "Paiement confirmé · reçu en attente"
        assertEquals(success, nativeFeedbackText(success, fr, preserveUnknown = true))
    }

    @Test fun frenchFormattingPreservesFinancialValues() {
        assertEquals("NGN 1\u202f250,75", fr.orderMoney("1250.75", "NGN"))
        assertEquals("XOF 1\u202f250", fr.orderMoney("1250.00", "XOF"))
        assertEquals("NGN -12,34", fr.money(-1234L, "NGN"))
        assertEquals("NGN 1250.75", nativeOrderMoney("1250.75", "NGN"))
        assertEquals("14/10/2026 10:30", nativeOrderTime("2026-10-14T10:30:00Z", "UTC", "fr"))
    }

    @Test fun reportExportHasFrenchLabelsAndUnchangedValues() {
        val csv = buildNativeZReportCsv(NativeMoreZReport(
            id = "report-1", cutoffAt = "2026-10-14T18:00:00Z", netSales = "1250.75",
            expectedCash = "1250.75", countedCash = "1250.75", variance = "0", currency = "NGN", orderCount = 2,
            taxableAmount = "1000", taxAmount = "250.75", taxComponents = listOf(NativeMoreZTaxComponent("VAT", "0.2", "250.75")),
            refundAmount = "0", discountAmount = "0", paymentBreakdown = listOf(NativeMoreZPayment("cash", null, "1250.75")),
        ), fr)
        assertTrue(csv.startsWith("\uFEFFRapport Z,report-1\r\n"))
        assertTrue(csv.contains("Espèces comptées,1250.75"))
        assertTrue(csv.contains("VAT 20\u00a0%,250.75"))
        assertTrue(csv.contains(fr.cashPayment + ",1250.75"))
        assertFalse(csv.contains("Net sales"))
    }
}
