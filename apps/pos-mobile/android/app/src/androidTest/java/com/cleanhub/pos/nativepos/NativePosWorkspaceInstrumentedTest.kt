package com.cleanhub.pos.nativepos

import android.graphics.Bitmap
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.io.File

/** Exercises the actual Compose screens without credentials, server writes or production SQLite. */
class NativePosWorkspaceInstrumentedTest {
    @get:Rule val compose = createComposeRule()
    private val terminal = NativeTerminal("tenant","branch","terminal","owner","owner","Africa/Dakar",1,"XOF","CleanHub","Dakar · Plateau",System.currentTimeMillis())
    private val settings = NativeTerminalSettingsSummary("Front desk", "shared_drawer", "none", 300, true, 1, "synced", null, "12 Avenue du Plateau, Dakar", "+221 77 123 45 67")
    private val current = NativePosSnapshot(terminal,null,emptyList(),emptyList(),emptyList(),emptyList(),2,0,true)
    private val checkout = NativeCheckoutSettings(lockTimeoutSeconds=300,receiptProfile=NativeReceiptProfile(name="CleanHub Dakar",phone="+221 77 123 45 67",address="Plateau, Dakar"))

    private fun screenshot(name: String) {
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        val folder=File(context.getExternalFilesDir(null),"ui-previews").apply { mkdirs() }
        val file = File(folder,"$name.png")
        file.outputStream().use {
            compose.onNodeWithTag("preview").captureToImage().asAndroidBitmap().compress(Bitmap.CompressFormat.PNG,100,it)
        }
        // Gradle uninstalls the isolated test app after the run. Preserve only the visual QA outputs.
        android.os.ParcelFileDescriptor.AutoCloseInputStream(
            InstrumentationRegistry.getInstrumentation().uiAutomation.executeShellCommand("cp ${file.absolutePath} /sdcard/Download/cleanhub-ui-$name.png")
        ).use { it.readBytes() }
    }

    @Test fun paymentEntryIsDisabledUntilTaxConfigurationHasBeenSynced() {
        val copy = nativePosCopy("en")
        val cart = NativePosCart.empty("XOF").copy(products = listOf(NativeCartLine("sku", "Laundry bag", 100000, 1, null)))
        var fiscal by mutableStateOf(NativeCheckoutSettings(taxReadinessCode = "POS_TAX_COUNTRY_REQUIRED"))
        compose.setContent {
            MaterialTheme(colorScheme = nativePosColors) {
                Box(Modifier.width(390.dp).fillMaxHeight().testTag("preview")) {
                    CheckoutPanel(cart, "Africa/Dakar", false, copy, null, fiscal, false, false, true,
                        { basket, _, exemption -> calculateNativeLocalPricing(basket, fiscal, exemption) }, {}, {}, {}, {}, {})
                }
            }
        }
        compose.onNodeWithText(copy.pay).assertIsNotEnabled()
        compose.onNodeWithText(copy.viewCartDetail.format(1L)).performClick()
        compose.onNodeWithText(copy.goToPayment).assertIsNotEnabled()
        compose.onNodeWithText(copy.close).performClick()
        compose.runOnIdle { fiscal = fiscal.copy(taxReady = true, taxReadinessCode = null, taxVerifiedAt = System.currentTimeMillis()) }
        compose.onNodeWithText(copy.pay).assertIsEnabled().performClick()
        compose.onNodeWithText(copy.confirmCollection).performScrollTo().assertIsEnabled()
        compose.runOnIdle { fiscal = fiscal.copy(taxReady = false, taxReadinessCode = "POS_TAX_CONFIGURATION_INCOMPLETE") }
        compose.onNodeWithText(copy.confirmCollection).performScrollTo().assertIsNotEnabled()
        screenshot("checkout-tax-blocked")
    }

    @Test fun missingCountryNoticeExplainsThatSyncCannotFillServerSettings() {
        val copy = nativePosCopy("en")
        compose.setContent {
            MaterialTheme(colorScheme = nativePosColors) {
                Box(Modifier.width(540.dp).testTag("preview")) {
                    NativeTaxReadinessNotice(copy, NativeCheckoutSettings(taxReadinessCode = "POS_TAX_COUNTRY_REQUIRED"), "manager", false, {}, {})
                }
            }
        }
        compose.onNodeWithText(copy.taxReadinessMessage("POS_TAX_COUNTRY_REQUIRED")).assertIsDisplayed()
        compose.onNodeWithText(copy.checkoutManagerNextSteps).assertIsDisplayed()
        compose.onNodeWithText(copy.checkoutReviewSettings).assertIsEnabled()
        screenshot("tax-readiness-notice")
    }

    @Test fun printingOnlySubmitsPrintingPreferences() {
        val copy=nativePosCopy("en")
        var submitted: NativeTerminalSettingsPatch?=null
        compose.setContent {
            MaterialTheme(colorScheme=nativePosColors) {
                Box(Modifier.width(540.dp).fillMaxHeight().background(POS_PAGE_BACKGROUND).testTag("preview")) {
                    NativeSettingsWorkspace(copy,current,settings,checkout,NativeReceiptPrintQueueState(2,0),NativeReceiptPrintSettings(true,1),NativePinLanguage.English,true,false,null,
                        {},{}, {submitted=it},{},{},{},{},{},{})
                }
            }
        }
        compose.onNodeWithText(copy.settingsPrintingTitle).performClick()
        compose.onNode(isToggleable()).performClick()
        screenshot("printing-phone")
        compose.onNodeWithText(copy.saveTerminalSettings).performScrollTo().performClick()
        compose.runOnIdle {
            assertEquals(false,submitted?.autoPrintReceipt)
            assertEquals(1,submitted?.printCopies)
            assertNull(submitted?.label)
            assertNull(submitted?.roundingRule)
            assertNull(submitted?.lockTimeoutSeconds)
        }
    }

    @Test fun offlineLanguageSelectionRemainsAvailable() {
        var language by mutableStateOf(NativePinLanguage.English)
        compose.setContent {
            MaterialTheme(colorScheme=nativePosColors) {
                Box(Modifier.width(540.dp).fillMaxHeight().background(POS_PAGE_BACKGROUND).testTag("preview")) {
                    NativeSettingsWorkspace(nativePosCopy(language.code),current,null,checkout,NativeReceiptPrintQueueState(0,0),NativeReceiptPrintSettings(true,2),language,false,false,null,
                        {},{}, {},{}, {language=it},{},{},{},{})
                }
            }
        }
        compose.onNodeWithText(nativePosCopy("en").authLanguageLabel).performScrollTo().performClick()
        compose.onNodeWithText("Français").performClick()
        compose.runOnIdle { assertEquals(NativePinLanguage.French,language) }
        compose.onNodeWithText(nativePosCopy("fr").settingsLanguageHint).assertIsDisplayed()
        screenshot("language-offline")
    }

    @Test fun customSearchFieldFiltersTheTicketList() {
        val copy=nativePosCopy("en")
        val tickets=listOf(
            NativeServiceTicket("one","T-001","c1","Amina Diop","laundry","ready_to_pick","urgent",3,120000,"XOF","2026-10-13T18:00:00Z","2026-10-13T08:00:00Z","2026-10-13T08:00:00Z",1),
            NativeServiceTicket("two","T-002","c2","Moussa Fall","laundry","in_progress","normal",5,250000,"XOF","2026-10-15T18:00:00Z","2026-10-12T08:00:00Z","2026-10-12T08:00:00Z",1),
            NativeServiceTicket("three","T-003","c3","Fatou Ndiaye","car_wash","pending","normal",1,150000,"XOF","2026-10-15T12:00:00Z","2026-10-11T08:00:00Z","2026-10-11T08:00:00Z",1),
        )
        compose.setContent {
            MaterialTheme(colorScheme=nativePosColors) {
                Row(Modifier.fillMaxSize().background(POS_PAGE_BACKGROUND).testTag("preview")) {
                    NativeAdaptiveNavigation(copy,terminal,nativeNavigationLayout(752f,56f,80f),NativeNavigationDestination.Tickets,true,true,56f,{})
                    NativeTicketList(copy,tickets,emptyList(),"Africa/Dakar","en",false,true,null,{},{},{})
                }
            }
        }
        screenshot("tickets-tablet")
        compose.onNode(hasSetTextAction()).performTextInput("Moussa")
        compose.onNodeWithText("T-002").assertExists()
        compose.onNodeWithText("T-001").assertDoesNotExist()
        compose.onNodeWithText("T-003").assertDoesNotExist()
    }

    @Test fun settingsHaveDistinctDesktopSections() {
        val copy=nativePosCopy("en")
        compose.setContent {
            MaterialTheme(colorScheme=nativePosColors) {
                Row(Modifier.fillMaxSize().background(POS_PAGE_BACKGROUND).testTag("preview")) {
                    NativeSettingsWorkspace(copy,current,settings,checkout,NativeReceiptPrintQueueState(2,0),NativeReceiptPrintSettings(true,1),NativePinLanguage.English,true,false,null,
                        {},{}, {},{},{},{},{},{},{})
                }
            }
        }
        screenshot("settings-tablet")
        compose.onNodeWithText(copy.settingsStoreTitle).performClick()
        compose.onNodeWithText(settings.branchAddress!!).assertIsDisplayed()
    }

    @Test fun narrowTicketCardsRemainReadable() {
        val ticket=NativeServiceTicket("one","T-001","c1","Amina Diop","laundry","ready_to_pick","urgent",3,120000,"XOF","2026-10-13T18:00:00Z","2026-10-13T08:00:00Z","2026-10-13T08:00:00Z",1)
        compose.setContent {
            MaterialTheme(colorScheme=nativePosColors) {
                Box(Modifier.width(390.dp).fillMaxHeight().background(POS_PAGE_BACKGROUND).testTag("preview")) {
                    NativeTicketList(nativePosCopy("en"),listOf(ticket),emptyList(),"Africa/Dakar","en",false,true,null,{},{},{})
                }
            }
        }
        compose.onNodeWithText("Amina Diop").performScrollTo().assertIsDisplayed()
        screenshot("tickets-phone")
    }

    @Test fun customInputPreservesPasswordMaskingAndEditing() {
        var secret by mutableStateOf("")
        compose.setContent {
            MaterialTheme(colorScheme=nativePosColors) {
                NativePosInput(secret, { secret=it }, label={androidx.compose.material3.Text("Password")},
                    singleLine=true, visualTransformation=PasswordVisualTransformation())
            }
        }
        compose.onNode(hasSetTextAction()).performTextInput("sample-secret")
        compose.onNode(hasSetTextAction()).assert(SemanticsMatcher.keyIsDefined(SemanticsProperties.Password))
        compose.runOnIdle { assertEquals("sample-secret",secret) }
    }

    @Test fun failedReceiptRetryRequiresCashierConfirmation() {
        val copy = nativePosCopy("en")
        var retried = false
        compose.setContent {
            MaterialTheme(colorScheme = nativePosColors) {
                Box(Modifier.width(540.dp).fillMaxHeight()) {
                    NativeSettingsWorkspace(copy,current,settings,checkout,NativeReceiptPrintQueueState(0,1),NativeReceiptPrintSettings(true,1),NativePinLanguage.English,true,false,null,
                        {},{}, {},{},{},{},{},{},{}, onRetryFailedReceipt = { retried = true })
                }
            }
        }
        compose.onNodeWithText(copy.settingsPrintingTitle).performClick()
        compose.onNodeWithText(copy.printNextReceipt).performScrollTo().assertIsNotEnabled()
        compose.onNodeWithText(copy.settingsRetryPrint).performScrollTo().performClick()
        compose.runOnIdle { assertFalse(retried) }
        compose.onNodeWithText(copy.settingsRetryPrintHint).assertIsDisplayed()
        compose.onNodeWithText(copy.settingsRetryPrintConfirm).performClick()
        compose.runOnIdle { assertTrue(retried) }
    }

    @Test fun failedSettingsRefreshKeepsCachedDataButDisablesSave() {
        val copy=nativePosCopy("en")
        compose.setContent {
            MaterialTheme(colorScheme=nativePosColors) {
                Box(Modifier.width(540.dp).fillMaxHeight()) {
                    NativeSettingsWorkspace(copy,current,settings,checkout,NativeReceiptPrintQueueState(0,0),NativeReceiptPrintSettings(true,1),NativePinLanguage.English,true,false,null,
                        {},{}, {},{},{},{},{},{},{}, settingsReady=false)
                }
            }
        }
        compose.onNodeWithText(copy.settingsTerminalTitle).performClick()
        compose.onNodeWithText("Front desk").assertExists()
        compose.onAllNodes(hasSetTextAction()).assertCountEquals(0)
        compose.onNodeWithText(copy.saveTerminalSettings).assertIsNotEnabled()
    }

    @Test fun actualShellMovesOnlyOverflowAndAdaptsAfterResize() {
        val copy=nativePosCopy("en")
        var height by mutableStateOf(480.dp)
        var activeTab by mutableStateOf(NativePosTab.Workspace)
        var more by mutableStateOf(NativeMoreDestination.Menu)
        var lastOpened: NativeMoreDestination?=null
        compose.setContent {
            CompositionLocalProvider(LocalDensity provides Density(0.8f, 1f)) {
            MaterialTheme(colorScheme=nativePosColors) {
                Box(Modifier.width(1200.dp).height(height).testTag("preview")) {
                    NativePosShell(copy,current,activeTab,more,{more=it;lastOpened=it},"en",true,false,false,null,
                        {activeTab=it; if(it==NativePosTab.More) more=NativeMoreDestination.Menu},
                        {},{},{},{_,_->},{_,_,_,_,_->},null,{_,_,_->},null,{}, {},{_,_->},{_,_,_->},{_,_,_->},{_,_,_->},{_,_->},
                        {}, {destinations,navigate->NativeMoreMenuView(copy,current,false,null,destinations,navigate)})
                }
            }
            }
        }
        compose.onNodeWithTag("navigation-Customers").assertIsDisplayed()
        compose.onNodeWithTag("navigation-Orders").assertDoesNotExist()
        compose.onNodeWithTag("navigation-More").performClick()
        compose.onAllNodesWithText(copy.menuCustomers).assertCountEquals(1)
        compose.onNodeWithText(copy.menuOrders).performScrollTo().performClick()
        compose.runOnIdle { assertEquals(NativeMoreDestination.Orders,lastOpened) }
        compose.runOnIdle { activeTab=NativePosTab.Workspace; height=840.dp }
        compose.onNodeWithTag("navigation-More").assertDoesNotExist()
        compose.onNodeWithTag("navigation-Settings").assertIsDisplayed()
        screenshot("navigation-full-tablet")
    }

    @Test fun largeFontShortSidebarKeepsMoreVisibleAndReachable() {
        val copy=nativePosCopy("fr")
        compose.setContent {
            CompositionLocalProvider(LocalDensity provides Density(1f, 1.5f)) {
                MaterialTheme(colorScheme=nativePosColors) {
                    Box(Modifier.width(900.dp).height(480.dp).testTag("preview")) {
                        NativeAdaptiveNavigation(copy,terminal,nativeNavigationLayout(480f,66f,80f),NativeNavigationDestination.Tickets,true,true,66f,{})
                    }
                }
            }
        }
        compose.onNodeWithTag("navigation-More").assertIsDisplayed()
        screenshot("navigation-large-font")
    }
}
