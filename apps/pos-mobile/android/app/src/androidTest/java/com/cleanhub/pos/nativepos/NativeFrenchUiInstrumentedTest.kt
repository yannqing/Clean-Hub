package com.cleanhub.pos.nativepos

import android.graphics.Bitmap
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

class NativeFrenchUiInstrumentedTest {
    @get:Rule val compose = createComposeRule()
    private val context get() = InstrumentationRegistry.getInstrumentation().targetContext
    private val fr = nativePosCopy("fr")

    private fun preserveScreenshot(bitmap: Bitmap, name: String) {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val file = File(context.getExternalFilesDir(null), "cleanhub-fr-$name.png")
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        // The runner removes its isolated app after testing. Keep synthetic QA images outside it.
        android.os.ParcelFileDescriptor.AutoCloseInputStream(
            instrumentation.uiAutomation.executeShellCommand("cp ${file.absolutePath} /sdcard/Download/cleanhub-fr-$name.png")
        ).use { it.readBytes() }
    }

    @Test fun offlinePinPageAndPersistedPreferenceUseFrench() {
        val session = NativePosSession(context)
        val previous = session.pinLanguageCode()
        try {
            session.savePinLanguageCode("fr")
            assertEquals("fr", NativePosSession(context).pinLanguageCode())
            var submitted = ""
            compose.setContent {
                MaterialTheme {
                    StaffPinGate(
                        language = NativePinLanguage.fromCode(NativePosSession(context).pinLanguageCode()),
                        onLanguageSelected = {}, tenantName = "Blanchisserie Démo", branchName = "Dakar",
                        offlineAvailable = true, internetAvailable = false, busy = false, message = null,
                        onPinEdited = {}, onUnlockOffline = { submitted = it }, onOnlineLogin = { fail("Offline UI must not log in online") },
                    )
                }
            }
            compose.onNodeWithText(fr.authPinOfflineHint).assertIsDisplayed()
            "123456".forEach { compose.onNodeWithText(it.toString(), substring = false).performClick() }
            compose.runOnIdle { assertEquals("123456", submitted) }
            preserveScreenshot(compose.onRoot().captureToImage().asAndroidBitmap(), "pin")
        } finally { session.savePinLanguageCode(previous) }
    }

    @Test fun oldAndNewOutboxErrorsRenderInFrenchWithoutLosingTheRecord() {
        val original = "Customer was not found."
        val stored = nativeStoredFeedback(NativePosApiException(422, "CUSTOMER_NOT_FOUND", original), 25)
        val parsed = JSONObject(stored)
        assertEquals("CUSTOMER_NOT_FOUND", parsed.getString("code"))
        assertEquals(original, parsed.getString("message"))
        assertEquals(25, parsed.getInt("attempts"))
        val message = nativeFeedbackText(stored, fr)
        assertTrue(message.contains("Client introuvable"))
        assertEquals("Client introuvable.", nativeFeedbackText(original, fr))
        val longRecord = nativeStoredFeedback(NativePosApiException(503, "PROVIDER_ERROR", "\\\"".repeat(1000)))
        assertTrue(longRecord.length <= 500)
        assertEquals("PROVIDER_ERROR", JSONObject(longRecord).getString("code"))
        compose.setContent {
            MaterialTheme {
                NativeSaleResultDialog(fr, NativeSaleResult(
                    "sale-demo", NativeSaleState.NeedsReview, "NGN", 125075, 125075,
                    "cash", "Amina Diop", false, original,
                ), onDismiss = {}, onViewOrder = {})
            }
        }
        compose.onNodeWithText(fr.checkoutReviewTitle).assertIsDisplayed()
        compose.onNodeWithText("Client introuvable.").assertIsDisplayed()
        compose.onNodeWithText("NGN 1\u202f250,75").assertIsDisplayed()
        preserveScreenshot(compose.onNode(isDialog()).captureToImage().asAndroidBitmap(), "sale")
    }
}
