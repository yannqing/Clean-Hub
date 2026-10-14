package com.cleanhub.pos.nativepos

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cleanhub.pos.BuildConfig

/** Each settings page submits only its own fields, preserving the other terminal preferences. */
internal const val NATIVE_TERMINAL_MAX_PRINT_COPIES = 5 // @cleanhub/hardware MAX_POS_PRINT_COPIES
internal fun requireNativeTerminalDevice(actual: String, expected: String, copy: NativePosCopy) {
    if (actual.isBlank() || actual != expected) throw NativePosValidationException(copy.settingsDeviceMismatch)
}

internal data class NativeTerminalSettingsPatch(
    val label: String? = null,
    val roundingRule: String? = null,
    val autoPrintReceipt: Boolean? = null,
    val printCopies: Int? = null,
    val lockTimeoutSeconds: Int? = null,
) {
    fun isValid(): Boolean =
        (label != null || roundingRule != null || autoPrintReceipt != null || printCopies != null || lockTimeoutSeconds != null) &&
        (label == null || label.trim().length <= 64) &&
        (roundingRule == null || roundingRule in listOf("none", "round_jiao", "round_yuan")) &&
        (printCopies == null || printCopies in 1..NATIVE_TERMINAL_MAX_PRINT_COPIES) &&
        (lockTimeoutSeconds == null || lockTimeoutSeconds in 30..86400)
}

private enum class NativeSettingsSection {
    Index, Terminal, Checkout, Printing, Security, Store, Hardware, Language, Sync;
    fun title(copy: NativePosCopy): String = when (this) {
        Index -> copy.menuSettings
        Terminal -> copy.settingsTerminalTitle
        Checkout -> copy.settingsCheckoutTitle
        Printing -> copy.settingsPrintingTitle
        Security -> copy.settingsSecurityTitle
        Store -> copy.settingsStoreTitle
        Hardware -> copy.printerDrawerScanner
        Language -> copy.authLanguageLabel
        Sync -> copy.settingsSyncTitle
    }
    fun description(copy: NativePosCopy): String = when (this) {
        Index -> copy.settingsIntro
        Terminal -> copy.settingsTerminalHint
        Checkout -> copy.settingsStoreManaged
        Printing -> copy.settingsPrintingHint
        Security -> copy.settingsSecurityHint
        Store -> copy.settingsStoreManaged
        Hardware -> copy.hardwareSettingsHint
        Language -> copy.settingsLanguageHint
        Sync -> copy.settingsSyncHint
    }
}

@Composable
internal fun NativeSettingsWorkspace(
    copy: NativePosCopy,
    current: NativePosSnapshot,
    settings: NativeTerminalSettingsSummary?,
    checkoutSettings: NativeCheckoutSettings,
    receiptPrintQueue: NativeReceiptPrintQueueState,
    receiptPrintSettings: NativeReceiptPrintSettings,
    language: NativePinLanguage,
    internetAvailable: Boolean,
    busy: Boolean,
    message: String?,
    onBack: () -> Unit,
    onRefresh: () -> Unit,
    onSave: (NativeTerminalSettingsPatch) -> Unit,
    onOpenHardware: () -> Unit,
    onSelectLanguage: (NativePinLanguage) -> Unit,
    onSynchronize: () -> Unit,
    onLock: () -> Unit,
    onTestPrinter: () -> Unit,
    onPrintNextReceipt: () -> Unit,
    backLabel: String = copy.backToMore,
    settingsReady: Boolean = true,
    onRetryFailedReceipt: () -> Unit = {},
) {
    var section by remember { mutableStateOf(NativeSettingsSection.Index) }
    var query by remember { mutableStateOf("") }
    var confirmReprint by remember { mutableStateOf(false) }
    val sections = NativeSettingsSection.entries.filter { it != NativeSettingsSection.Index }
    val filtered = sections.filter { "${it.title(copy)} ${it.description(copy)}".contains(query.trim(), ignoreCase = true) }
    var label by remember(settings?.label) { mutableStateOf(settings?.label.orEmpty()) }
    var autoPrint by remember(settings?.autoPrintReceipt, checkoutSettings.autoPrintReceipt) { mutableStateOf(settings?.autoPrintReceipt ?: checkoutSettings.autoPrintReceipt) }
    var copies by remember(settings?.printCopies, receiptPrintSettings.printCopies) { mutableStateOf(settings?.printCopies ?: receiptPrintSettings.printCopies) }
    var timeout by remember(settings?.lockTimeoutSeconds, checkoutSettings.lockTimeoutSeconds) { mutableStateOf(settings?.lockTimeoutSeconds ?: checkoutSettings.lockTimeoutSeconds) }
    var rounding by remember(settings?.roundingRule, checkoutSettings.roundingRule) { mutableStateOf(settings?.roundingRule ?: checkoutSettings.roundingRule) }
    val editable = internetAvailable && settingsReady && settings != null && !busy
    val terminal = current.terminal
    fun open(target: NativeSettingsSection) {
        if (target == NativeSettingsSection.Hardware) onOpenHardware() else section = target
    }
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val wide = maxWidth >= 800.dp
        Row(Modifier.fillMaxSize()) {
            if (wide) Column(Modifier.width(224.dp).fillMaxHeight().background(POS_PANEL_BACKGROUND).verticalScroll(rememberScrollState()).padding(16.dp)) {
                TextButton(onClick = onBack) { Text("‹ $backLabel") }
                Text(copy.menuSettings, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, modifier = Modifier.padding(vertical = 16.dp))
                NativePosInput(query, { query = it }, singleLine = true, placeholder = { Text(copy.settingsSearchHint) }, modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp))
                filtered.forEach { item ->
                    val selected = section == item || (section == NativeSettingsSection.Index && item == NativeSettingsSection.Terminal)
                    Text(item.title(copy), color = if (selected) POS_INK else POS_MUTED,
                        fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
                        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(if (selected) POS_PAGE_BACKGROUND else POS_PANEL_BACKGROUND)
                            .clickable(enabled = !busy) { open(item) }.padding(horizontal = 12.dp, vertical = 16.dp))
                }
            }
            Column(Modifier.weight(1f).fillMaxHeight().verticalScroll(rememberScrollState()).padding(if (wide) 28.dp else 18.dp),
                verticalArrangement = Arrangement.spacedBy(18.dp)) {
                val active = if (wide && section == NativeSettingsSection.Index) NativeSettingsSection.Terminal else section
                if (!wide) TextButton(onClick = { if (active == NativeSettingsSection.Index) onBack() else section = NativeSettingsSection.Index }) {
                    Text("‹ ${if (active == NativeSettingsSection.Index) backLabel else copy.menuSettings}")
                }
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(active.title(copy), color = POS_INK, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.headlineSmall)
                        Text(active.description(copy), color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                    }
                    if (active != NativeSettingsSection.Index) TextButton(onClick = onRefresh, enabled = internetAvailable && !busy) { Text(copy.refreshStatus) }
                }
                if (!internetAvailable || !settingsReady || settings == null) {
                    SettingsNotice(if (!internetAvailable) copy.settingsCachedHint else if (busy) copy.loading else copy.settingsRefreshRequired)
                }
                when (active) {
                    NativeSettingsSection.Index -> {
                        NativePosInput(query, { query = it }, singleLine = true, placeholder = { Text(copy.settingsSearchHint) }, modifier = Modifier.fillMaxWidth())
                        if (filtered.isEmpty()) Text(copy.settingsNoResults, color = POS_MUTED)
                        filtered.forEach { item ->
                        SettingsEntry(item.title(copy), when (item) {
                            NativeSettingsSection.Terminal -> settings?.label ?: terminal?.branchName.orEmpty()
                            NativeSettingsSection.Checkout -> checkoutSettings.paymentMethodsEnabled.joinToString(" · ") { nativePaymentMethodTitle(it, copy) }
                            NativeSettingsSection.Printing -> "${if (autoPrint) copy.autoPrintOption else copy.manualPrintOption} · ${copy.copiesSuffix.format(copies.toString())}"
                            NativeSettingsSection.Language -> language.label
                            NativeSettingsSection.Sync -> copy.settingsQueueSummary.format(current.pendingSales, current.failedSales)
                            else -> item.description(copy)
                        }, busy) { open(item) }
                        }
                    }
                    NativeSettingsSection.Terminal -> {
                        SettingsPanel {
                            NativePosInput(label, { label = it.take(64) }, label = { Text(copy.terminalName) }, singleLine = true, enabled = editable, modifier = Modifier.fillMaxWidth())
                            SettingsInfo(copy.settingsTerminalId, terminal?.terminalId)
                            SettingsInfo(copy.branchName, terminal?.branchName)
                            SettingsInfo(copy.settingsVersion, "${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})")
                        }
                        SettingsSave(copy, editable && label != settings?.label.orEmpty()) { onSave(NativeTerminalSettingsPatch(label = label.trim())) }
                    }
                    NativeSettingsSection.Checkout -> {
                        SettingsPanel {
                            SettingsInfo(copy.settingsCurrency, terminal?.currency)
                            SettingsInfo(copy.paymentMethodsLabel, checkoutSettings.paymentMethodsEnabled.joinToString(" · ") { nativePaymentMethodTitle(it, copy) })
                            SettingsInfo(copy.settingsDefaultPayment, nativePaymentMethodTitle(checkoutSettings.defaultPaymentMethod, copy))
                            SettingsInfo(copy.cashHandlingMode, when (settings?.cashHandlingMode ?: current.cashState?.cashHandlingMode) {
                                "shared_drawer" -> copy.cashModeShared
                                "cash_in_hand" -> copy.cashModePersonal
                                "untracked" -> copy.cashModeUntracked
                                "none" -> copy.cashModeNone
                                else -> "—"
                            })
                            if (checkoutSettings.mobileMoneyProvidersEnabled.isNotEmpty()) SettingsInfo(copy.mobilePayment, checkoutSettings.mobileMoneyProvidersEnabled.joinToString(" · "))
                        }
                        SettingsPanel {
                            Text(copy.cashRounding, fontWeight = FontWeight.SemiBold, color = POS_INK)
                            if (nativeCurrencyPayableStep(terminal?.currency) >= 100) Text(copy.settingsRoundingNoEffect, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                            else SettingsChoices(listOf("none" to copy.roundingNone, "round_jiao" to copy.roundingJiao, "round_yuan" to copy.roundingYuan), rounding, editable) { rounding = it }
                        }
                        if (nativeCurrencyPayableStep(terminal?.currency) < 100) SettingsSave(copy, editable && rounding != settings?.roundingRule) { onSave(NativeTerminalSettingsPatch(roundingRule = rounding)) }
                        SettingsPanel {
                            SettingsInfo(copy.taxSettingsLabel, if (checkoutSettings.taxEnabled) "${checkoutSettings.taxLabel.orEmpty()} ${formatNativeTaxRate(checkoutSettings.defaultTaxRate)}" else copy.taxDisabled)
                            SettingsInfo(copy.settingsPriceMode, if (checkoutSettings.pricesIncludeTax) copy.pricesIncludeTax else copy.pricesExcludeTax)
                            SettingsInfo(copy.settingsTaxNumber, checkoutSettings.taxRegistrationNumber)
                            checkoutSettings.taxComponents.forEach { SettingsInfo(it.name, formatNativeTaxRate(it.rate)) }
                            if (!checkoutSettings.taxReady) SettingsNotice(copy.settingsTaxNotReady)
                        }
                    }
                    NativeSettingsSection.Printing -> {
                        SettingsPanel {
                            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                Text(copy.receiptPrinting, modifier = Modifier.weight(1f), color = POS_INK, fontWeight = FontWeight.Medium)
                                Switch(checked = autoPrint, onCheckedChange = { autoPrint = it }, enabled = editable)
                            }
                            Text(if (autoPrint) copy.autoPrintOption else copy.manualPrintOption, style = MaterialTheme.typography.bodySmall, color = POS_MUTED)
                            Text(copy.autoPrintCopies, color = POS_INK, fontWeight = FontWeight.Medium)
                            SettingsChoices((1..NATIVE_TERMINAL_MAX_PRINT_COPIES).map { it to copy.copiesSuffix.format(it.toString()) }, copies, editable) { copies = it }
                        }
                        SettingsSave(copy, editable && (autoPrint != settings?.autoPrintReceipt || copies != settings?.printCopies)) {
                            onSave(NativeTerminalSettingsPatch(autoPrintReceipt = autoPrint, printCopies = copies))
                        }
                        SettingsPanel {
                            SettingsInfo(copy.settingsPrintQueue, copy.settingsQueueSummary.format(receiptPrintQueue.pending, receiptPrintQueue.failed))
                            OutlinedButton(onClick = onPrintNextReceipt, enabled = !busy && receiptPrintQueue.pending > 0, modifier = Modifier.fillMaxWidth()) { Text(copy.printNextReceipt) }
                            if (receiptPrintQueue.failed > 0) {
                                OutlinedButton(onClick = { confirmReprint = true }, enabled = !busy, modifier = Modifier.fillMaxWidth()) { Text(copy.settingsRetryPrint) }
                            }
                            OutlinedButton(onClick = onTestPrinter, enabled = !busy, modifier = Modifier.fillMaxWidth()) { Text(copy.testPrinter) }
                            TextButton(onClick = onOpenHardware, enabled = !busy) { Text(copy.openHardwareSettings) }
                        }
                    }
                    NativeSettingsSection.Security -> {
                        SettingsPanel {
                            Text(copy.autoLockSeconds, color = POS_INK, fontWeight = FontWeight.Medium)
                            val options = (listOf(60,120,300,600,1800,3600) + timeout.takeIf { it in 30..86400 }.let { listOfNotNull(it) }).distinct().sorted()
                            SettingsChoices(options.map { it to if (it % 60 == 0) copy.settingsLockMinutes.format(it / 60) else copy.settingsLockSeconds.format(it) }, timeout, editable) { timeout = it }
                            if (timeout % 60 != 0) Text(copy.settingsLockSeconds.format(timeout), color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                        }
                        SettingsSave(copy, editable && timeout != settings?.lockTimeoutSeconds) { onSave(NativeTerminalSettingsPatch(lockTimeoutSeconds = timeout)) }
                        OutlinedButton(onClick = onLock, enabled = !busy, modifier = Modifier.fillMaxWidth()) { Text(copy.lock) }
                    }
                    NativeSettingsSection.Store -> {
                        SettingsPanel {
                            SettingsInfo(copy.branchName, terminal?.branchName)
                            SettingsInfo(copy.settingsPhone, settings?.branchPhone)
                            SettingsInfo(copy.settingsAddress, settings?.branchAddress)
                            SettingsInfo(copy.settingsCurrency, terminal?.currency)
                            SettingsInfo(copy.settingsTimeZone, terminal?.timeZone)
                        }
                        SettingsPanel {
                            Text(copy.settingsReceiptHeader, color = POS_INK, fontWeight = FontWeight.SemiBold)
                            SettingsInfo(copy.receiptNameLabel, checkoutSettings.receiptProfile.name)
                            SettingsInfo(copy.receiptPhoneLabel, checkoutSettings.receiptProfile.phone)
                            SettingsInfo(copy.receiptAddressLabel, checkoutSettings.receiptProfile.address)
                            SettingsInfo(copy.settingsReceiptThanks, checkoutSettings.receiptProfile.thankYouMessage)
                        }
                    }
                    NativeSettingsSection.Language -> SettingsPanel {
                        NativePinLanguage.entries.forEach { option ->
                            Row(Modifier.fillMaxWidth().clickable(enabled = !busy) { onSelectLanguage(option) }.padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                                RadioButton(selected = language == option, onClick = { onSelectLanguage(option) }, enabled = !busy)
                                Text(option.label, color = POS_INK, modifier = Modifier.padding(start = 8.dp))
                            }
                        }
                    }
                    NativeSettingsSection.Sync -> {
                        SettingsPanel {
                            SettingsInfo(copy.settingsNetwork, if (internetAvailable) copy.settingsOnline else copy.settingsOffline)
                            SettingsInfo(copy.settingsLastSync, terminal?.let { nativeTicketTime(java.time.Instant.ofEpochMilli(it.lastSyncedAt).toString(), it.timeZone, language.code) })
                            SettingsInfo(copy.settingsCatalogueCounts, copy.settingsCatalogueSummary.format(current.services.size, current.products.size))
                            SettingsInfo(copy.settingsSaleQueue, copy.settingsQueueSummary.format(current.pendingSales, current.failedSales))
                            SettingsInfo(copy.settingsPrintQueue, copy.settingsQueueSummary.format(receiptPrintQueue.pending, receiptPrintQueue.failed))
                            settings?.lastSyncError?.let { SettingsNotice(it) }
                        }
                        Button(onClick = onSynchronize, enabled = internetAvailable && !busy, modifier = Modifier.fillMaxWidth()) { Text(if (busy) copy.loading else copy.syncNow) }
                        if (current.failedSales > 0) SettingsNotice(copy.failedSalesNeedManager.format(current.failedSales))
                    }
                    NativeSettingsSection.Hardware -> Unit
                }
                message?.let { SettingsNotice(it) }
                Spacer(Modifier.height(16.dp))
            }
        }
    }
    if (confirmReprint) AlertDialog(
        onDismissRequest = { confirmReprint = false },
        title = { Text(copy.settingsRetryPrint) },
        text = { Text(copy.settingsRetryPrintHint) },
        confirmButton = { TextButton(onClick = { confirmReprint = false; onRetryFailedReceipt() }, enabled = !busy) { Text(copy.settingsRetryPrintConfirm) } },
        dismissButton = { TextButton(onClick = { confirmReprint = false }) { Text(copy.settingsRetryPrintCancel) } },
    )
}

@Composable
private fun SettingsEntry(title: String, description: String, busy: Boolean, onClick: () -> Unit) {
    Column {
        Row(Modifier.fillMaxWidth().clickable(enabled = !busy, onClick = onClick).padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Text(title, color = POS_INK, fontWeight = FontWeight.SemiBold)
                Text(description, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
            }
            Text("›", color = POS_MUTED, style = MaterialTheme.typography.headlineSmall, modifier = Modifier.padding(start = 16.dp))
        }
        HorizontalDivider(color = POS_BORDER)
    }
}

@Composable
private fun SettingsPanel(content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxWidth().background(POS_PANEL_BACKGROUND, RoundedCornerShape(12.dp)).border(1.dp, POS_BORDER, RoundedCornerShape(12.dp)).padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp), content = content)
}

@Composable
private fun SettingsInfo(label: String, value: String?) {
    Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
        Text(label, color = POS_MUTED, style = MaterialTheme.typography.labelMedium)
        Text(value?.takeIf { it.isNotBlank() } ?: "—", color = POS_INK, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun SettingsNotice(value: String) {
    Text(value, modifier = Modifier.fillMaxWidth().background(POS_BORDER.copy(alpha = 0.35f), RoundedCornerShape(10.dp)).padding(14.dp),
        color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun <T> SettingsChoices(options: List<Pair<T,String>>, selected: T, enabled: Boolean, onSelect: (T) -> Unit) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        options.forEach { (value,label) -> FilterChip(selected = value == selected, onClick = { onSelect(value) }, enabled = enabled, label = { Text(label) }) }
    }
}

@Composable
private fun SettingsSave(copy: NativePosCopy, enabled: Boolean, onSave: () -> Unit) {
    Button(onClick = onSave, enabled = enabled, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(10.dp), contentPadding = PaddingValues(14.dp)) { Text(copy.saveTerminalSettings) }
}

internal fun nativePaymentMethodTitle(method: String, copy: NativePosCopy): String = when (method) {
    "cash" -> copy.cashPayment
    "app" -> copy.mobilePayment
    "card" -> copy.cardPayment
    else -> method
}
