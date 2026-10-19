package com.cleanhub.pos.nativepos

import android.app.Activity
import android.content.Context
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items as gridItems
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.app.ActivityCompat
import com.cleanhub.pos.BuildConfig
import com.cleanhub.pos.NativePosActivityClock
import com.cleanhub.pos.NativeScannerKeyboardBridge
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.IOException
import java.util.concurrent.atomic.AtomicLong
import org.json.JSONArray
import org.json.JSONObject

internal data class NativeSetupBranch(val id: String, val name: String)
private data class NativeAdministrator(val branches: List<NativeSetupBranch>, val requiresReenrollment: Boolean = false, val taxIssueCode: String? = "POS_TAX_STATUS_UNAVAILABLE")
private data class NativePosBootstrapIdentity(val tenantName: String, val branchName: String?)
private data class NativeOfflinePinResult(val verified: Boolean, val lockedForSeconds: Long? = null)
internal enum class NativeMoreDestination {
    Menu,
    Customers,
    Catalog,
    Scan,
    Orders,
    OrderDetail,
    Statistics,
    Notifications,
    Shift,
    Settings,
    Hardware,
    ;

    /** Titles come from the catalogue: an enum constant cannot read the terminal's language. */
    fun title(copy: NativePosCopy): String = when (this) {
        Menu -> copy.menuMore
        Customers -> copy.menuCustomers
        Catalog -> copy.menuCatalog
        Scan -> copy.menuScan
        Orders -> copy.menuOrders
        OrderDetail -> copy.menuOrderDetail
        Statistics -> copy.menuStatistics
        Notifications -> copy.menuNotifications
        Shift -> copy.menuShift
        Settings -> copy.menuSettings
        Hardware -> copy.menuHardware
    }
}
private data class NativeMoreOrder(
    val id: String,
    val customerName: String?,
    val totalAmount: String,
    val currency: String,
    val status: String,
    val paymentStatus: String,
    val itemCount: Int,
    val createdAt: String,
)
private data class NativeMoreSearchResult(
    val id: String,
    val type: String,
    val title: String,
    val subtitle: String?,
    val badge: String?,
)
private data class NativeMoreStatistics(
    val orderCount: Int,
    val paidAmount: String,
    val unpaidCount: Int,
    val ticketTotal: Int,
    val ticketOverdue: Int,
    val customerTotal: Int,
    val todayNewCustomers: Int,
)
private data class NativeMoreNotification(
    val deliveryId: String,
    val title: String,
    val content: String,
    val priority: String,
    val readStatus: String,
    val createdAt: String,
    val relatedType: String?,
    val relatedId: String?,
)
internal data class NativeTerminalSettingsSummary(
    val label: String?,
    val cashHandlingMode: String,
    val roundingRule: String,
    val lockTimeoutSeconds: Int,
    val autoPrintReceipt: Boolean,
    val printCopies: Int,
    val syncStatus: String,
    val lastSyncError: String?,
    val branchAddress: String? = null,
    val branchPhone: String? = null,
)
private data class NativeHardwareDevice(
    val id: String,
    val name: String,
    val deviceType: String,
    val connectionType: String,
    val provisioningMode: String,
    val hardwareKey: String?,
    val status: String,
    val config: JSONObject,
    val version: Int,
)
private data class NativeBuiltInHardwareDescriptor(
    val hardwareKey: String?,
    val name: String?,
    val localDeviceId: String?,
    val available: Boolean,
)
private data class NativeHardwareScan(
    val value: String,
    val receivedAt: Long,
)
private enum class NativeHardwareScannerPurpose {
    Test,
    Registration,
}
private data class NativeHardwareScannerSession(
    val purpose: NativeHardwareScannerPurpose,
    val value: String? = null,
    val status: String? = null,
)
private data class NativeMoreCashMovement(
    val id: String,
    val type: String,
    val amount: String,
    val currency: String,
    val reason: String,
    val createdAt: String,
)
private data class NativeMoreShiftData(
    val shiftStatus: String?,
    val openingFloat: String?,
    val cashHandlingMode: String,
    val cashTrackingEnabled: Boolean,
    val requireOpeningFloat: Boolean,
    val requireClosingCount: Boolean,
    val registerOpen: Boolean,
    val cashSessionOpen: Boolean,
    val currency: String,
    val expectedCash: String?,
    val netSales: String?,
    val outstandingOrders: Int,
    val movements: List<NativeMoreCashMovement>,
    val zReports: List<NativeMoreZReport>,
)
private data class NativeMoreZReport(
    val id: String,
    val cutoffAt: String,
    val netSales: String,
    val expectedCash: String,
    val countedCash: String,
    val variance: String,
    val currency: String,
    val orderCount: Int,
    val taxableAmount: String?,
    val taxAmount: String?,
    val taxComponents: List<NativeMoreZTaxComponent>,
    val refundAmount: String,
    val discountAmount: String,
    val paymentBreakdown: List<NativeMoreZPayment>,
)
private data class NativeMoreZPayment(val method: String, val provider: String?, val netAmount: String)
private data class NativeMoreZTaxComponent(val name: String, val rate: String, val taxAmount: String)

internal enum class NativePosTab(val symbol: String) {
    Workspace("⌂"),
    Sale("▣"),
    Intake("＋"),
    Tickets("▤"),
    More("⋯"),
    ;

    fun label(copy: NativePosCopy): String = when (this) {
        Workspace -> copy.tabWorkspace
        Sale -> copy.tabSale
        Intake -> copy.tabIntake
        Tickets -> copy.tabTickets
        More -> copy.tabMore
    }
}

private enum class NativePosScreenClass {
    Compact,
    Medium,
    Expanded,
}

@Composable
private fun nativePosScreenClass(): NativePosScreenClass {
    val width = LocalConfiguration.current.screenWidthDp
    return when {
        width >= 840 -> NativePosScreenClass.Expanded
        width >= 600 -> NativePosScreenClass.Medium
        else -> NativePosScreenClass.Compact
    }
}

internal enum class NativePinLanguage(val code: String, val label: String) {
    Chinese("zh-CN", "中文"),
    English("en", "English"),
    French("fr", "Français");

    companion object {
        fun fromCode(code: String): NativePinLanguage = entries.firstOrNull { it.code == code } ?: Chinese
    }
}

private const val BLUETOOTH_PERMISSION_REQUEST_CODE = 3_208
/** Intake creation uses a durable local outbox; processing and profile edits remain online. */
internal val TICKET_STATUS_TRANSITIONS: Map<String, List<String>> = mapOf(
    "draft" to listOf("pending", "cancelled"),
    "pending" to listOf("in_progress", "cancelled"),
    "in_progress" to listOf("ready_to_pick", "exception"),
    "ready_to_pick" to listOf("picked_up", "exception"),
    "exception" to listOf("in_progress", "cancelled"),
    "picked_up" to emptyList(),
    "cancelled" to emptyList(),
)
internal val TICKET_ITEM_STATUS_TRANSITIONS: Map<String, List<String>> = mapOf(
    "pending_wash" to listOf("washing"),
    "washing" to listOf("done", "exception"),
    "done" to listOf("ready_to_pick", "washing"),
    "ready_to_pick" to listOf("washing", "exception"),
    "exception" to listOf("washing"),
)

/** The installed APK owns the POS UI, credentials and SQLite state; it never starts a WebView. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NativePosApp(applicationContext: Context) {
    val hostActivity = applicationContext as? Activity
    val session = remember { NativePosSession(applicationContext) }
    val database = remember { NativePosDatabase(applicationContext) { session.pinLanguageCode() } }
    val api = remember { NativePosApiClient(session) }
    val scope = rememberCoroutineScope()
    val cartWriteMutex = remember { Mutex() }
    val cartWriteGeneration = remember { AtomicLong(0L) }
    var snapshot by remember { mutableStateOf<NativePosSnapshot?>(null) }
    var bootstrapIdentity by remember { mutableStateOf<NativePosBootstrapIdentity?>(null) }
    var pinLanguage by remember { mutableStateOf(NativePinLanguage.fromCode(session.pinLanguageCode())) }
    // The terminal's chosen language now reaches the whole POS, not just the
    // PIN screen it was previously limited to.
    val copy = nativePosCopy(pinLanguage.code)
    fun selectLanguage(language: NativePinLanguage) {
        pinLanguage = language
        session.savePinLanguageCode(language.code)
    }
    var cart by remember { mutableStateOf(NativePosCart.empty("XOF")) }
    var message by remember { mutableStateOf<String?>(null) }
    var checkoutFailure by remember { mutableStateOf<String?>(null) }
    var checkoutResult by remember { mutableStateOf<NativeSaleResult?>(null) }
    var busy by remember { mutableStateOf(false) }
    var unlocked by remember { mutableStateOf(false) }
    var activeTab by remember { mutableStateOf(NativePosTab.Workspace) }
    var selectedTicketDetail by remember { mutableStateOf<NativeTicketDetail?>(null) }
    var setupAdministrator by remember { mutableStateOf<NativeAdministrator?>(null) }
    var moreDestination by remember { mutableStateOf(NativeMoreDestination.Menu) }
    var moreOrders by remember { mutableStateOf<List<NativeMoreOrder>>(emptyList()) }
    var moreOrderDetail by remember { mutableStateOf<NativeMoreOrderDetail?>(null) }
    // Ids for a customer creation that may need retrying; see createCustomer.
    var pendingCustomerDraft by remember { mutableStateOf<NativeCustomerDraft?>(null) }
    val moreOrderCashKeys = remember { NativePaymentIdempotency() }
    val moreOrderRefundKeys = remember { NativePaymentIdempotency() }
    // A pay-in or pay-out carries a key that survives a retry, for the same
    // reason a payment does: the server dedupes on it, and a fresh key per tap
    // turns a lost response into a second movement the drawer never received.
    val cashMovementKeys = remember { NativePaymentIdempotency() }
    var moreSearchResults by remember { mutableStateOf<List<NativeMoreSearchResult>>(emptyList()) }
    var moreStatistics by remember { mutableStateOf<NativeMoreStatistics?>(null) }
    var moreStatisticsPeriod by remember { mutableStateOf("today") }
    var moreNotifications by remember { mutableStateOf<List<NativeMoreNotification>>(emptyList()) }
    var terminalSettingsReady by remember { mutableStateOf(false) }
    var terminalSettingsScope by remember { mutableStateOf<String?>(null) }
    var terminalSettings by remember { mutableStateOf<NativeTerminalSettingsSummary?>(null) }
    val hardware = remember(applicationContext) { NativePosHardware(applicationContext) { session.pinLanguageCode() } }
    val receiptPrintMutex = remember { Mutex() }
    var hardwareStatus by remember { mutableStateOf<NativeHardwareStatus?>(null) }
    var hardwareDevices by remember { mutableStateOf<List<NativeHardwareDevice>>(emptyList()) }
    var bluetoothPrinters by remember { mutableStateOf<List<NativeBluetoothPrinter>>(emptyList()) }
    var lastHardwareScan by remember { mutableStateOf<NativeHardwareScan?>(null) }
    var receiptPrintPreferences by remember { mutableStateOf(NativeReceiptPrintSettings(true, 1)) }
    var receiptPrintQueue by remember { mutableStateOf(NativeReceiptPrintQueueState(0, 0)) }
    var checkoutSettings by remember { mutableStateOf(NativeCheckoutSettings()) }
    var receiptPrinterConfigured by remember { mutableStateOf(false) }
    var moreShiftData by remember { mutableStateOf<NativeMoreShiftData?>(null) }
    var intakeCustomer by remember { mutableStateOf<NativeCustomer?>(null) }
    var offlineModeEnabled by remember { mutableStateOf(false) }
    var scannerRegistrationPending by remember { mutableStateOf(false) }
    var keyboardScannerListening by remember { mutableStateOf(false) }
    var keyboardScannerBuffer by remember { mutableStateOf("") }
    var scannerSession by remember { mutableStateOf<NativeHardwareScannerSession?>(null) }
    val physicalInternetAvailable = rememberNativeInternetAvailable(applicationContext)
    val internetAvailable = physicalInternetAvailable && !offlineModeEnabled

    suspend fun registerBuiltInHardware(deviceType: String, scannerAlreadyTested: Boolean) {
        val refreshedStatus = withContext(Dispatchers.IO) { hardware.status() }
        val descriptor = when (deviceType) {
            "printer" -> NativeBuiltInHardwareDescriptor(
                hardwareKey = refreshedStatus.printerHardwareKey,
                name = refreshedStatus.printerName,
                localDeviceId = refreshedStatus.printerId,
                available = refreshedStatus.printerConnected && refreshedStatus.printerStatusCode == 0,
            )
            "scanner" -> NativeBuiltInHardwareDescriptor(
                hardwareKey = refreshedStatus.scannerHardwareKey,
                name = refreshedStatus.scannerName,
                localDeviceId = refreshedStatus.scannerId,
                available = refreshedStatus.scannerConnected,
            )
            else -> null
        } ?: throw NativePosValidationException(copy.unknownBuiltInDevice)
        if (!descriptor.available || descriptor.hardwareKey == null || descriptor.name == null || descriptor.localDeviceId == null) {
            throw NativePosValidationException(copy.deviceUnavailable.format(deviceType))
        }
        val testResult = withContext(Dispatchers.IO) {
            when {
                deviceType == "printer" -> hardware.printReceipt("CleanHub\n${copy.printerRegistrationTest}\n", 1)
                scannerAlreadyTested -> NativeHardwareOperationResult(true, copy.scanTestSucceeded)
                else -> hardware.requestScan()
            }
        }
        if (!testResult.success) throw NativePosValidationException(testResult.message)
        val devices = withContext(Dispatchers.IO) {
            api.post("/pos/hardware-devices/built-in-connections", JSONObject().apply {
                put("hardwareKey", descriptor.hardwareKey)
                put("name", descriptor.name)
                put("deviceType", deviceType)
                put("localDeviceId", descriptor.localDeviceId)
                put("deviceModel", refreshedStatus.hardwareModel)
            })
            api.get("/pos/hardware-devices").optJSONArray("data").toNativeHardwareDevices().also {
                database.replaceReceiptPrinterBinding(it.defaultReceiptPrinterId())
            }
        }
        hardwareStatus = withContext(Dispatchers.IO) { hardware.status() }
        hardwareDevices = devices
        message = if (deviceType == "printer") copy.printerRegistered else copy.scannerRegistered
    }

    fun completeHardwareScan(value: String) {
        keyboardScannerListening = false
        keyboardScannerBuffer = ""
        lastHardwareScan = NativeHardwareScan(value, System.nanoTime())
        if (scannerRegistrationPending) {
            scannerRegistrationPending = false
            scannerSession = scannerSession?.copy(
                value = value,
                status = copy.barcodeReadRegistering,
            )
            scope.launch {
                busy = true
                try {
                    registerBuiltInHardware("scanner", scannerAlreadyTested = true)
                    scannerSession = scannerSession?.copy(
                        status = copy.scannerReadyEverywhere,
                    )
                } catch (error: Exception) {
                    message = error.userMessage(copy)
                    scannerSession = scannerSession?.copy(status = error.userMessage(copy))
                } finally {
                    busy = false
                }
            }
        } else {
            message = copy.scanTestResult.format(value)
            scannerSession = scannerSession?.copy(value = value, status = copy.scanReadSucceeded)
        }
    }

    fun closeHardwareScannerSession() {
        keyboardScannerListening = false
        keyboardScannerBuffer = ""
        scannerRegistrationPending = false
        scannerSession = null
    }

    fun startKeyboardScannerSession(purpose: NativeHardwareScannerPurpose): Boolean {
        if (!hardware.keyboardScannerAvailable()) return false
        scannerRegistrationPending = purpose == NativeHardwareScannerPurpose.Registration
        keyboardScannerBuffer = ""
        keyboardScannerListening = true
        scannerSession = NativeHardwareScannerSession(purpose)
        return true
    }

    val scannerActivityLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { result ->
        val value = if (result.resultCode == Activity.RESULT_OK) {
            hardware.activityScanValue(result.data)
        } else {
            null
        }
        if (value == null) {
            scannerRegistrationPending = false
            message = if (result.resultCode == Activity.RESULT_CANCELED) {
                copy.scanTestCancelled
            } else {
                copy.scannerReturnedNothing
            }
        } else {
            completeHardwareScan(value)
        }
    }

    fun handleKeyboardScannerEvent(nativeEvent: android.view.KeyEvent): Boolean {
        if (!keyboardScannerListening) return false
        val deviceName = nativeEvent.device?.name.orEmpty()
        if (!deviceName.contains("usbscn", ignoreCase = true) &&
            !deviceName.contains("barcode", ignoreCase = true) &&
            !deviceName.contains("scanner", ignoreCase = true)
        ) return false
        if (nativeEvent.action != android.view.KeyEvent.ACTION_UP) return true
        when (nativeEvent.keyCode) {
            android.view.KeyEvent.KEYCODE_ENTER,
            android.view.KeyEvent.KEYCODE_NUMPAD_ENTER -> {
                val value = keyboardScannerBuffer.trim()
                if (value.isBlank()) {
                    message = copy.noBarcodeScanAgain
                } else {
                    completeHardwareScan(value)
                }
            }
            android.view.KeyEvent.KEYCODE_DEL -> {
                keyboardScannerBuffer = keyboardScannerBuffer.dropLast(1)
            }
            else -> {
                val character = nativeEvent.unicodeChar
                if (character in 32..126 && keyboardScannerBuffer.length < 512) {
                    keyboardScannerBuffer += character.toChar()
                }
            }
        }
        return true
    }

    DisposableEffect(keyboardScannerListening) {
        NativeScannerKeyboardBridge.listener = if (keyboardScannerListening) ::handleKeyboardScannerEvent else null
        onDispose {
            NativeScannerKeyboardBridge.listener = null
        }
    }

    DisposableEffect(hardware) {
        val removeListener = hardware.addScanListener { scannedValue ->
            completeHardwareScan(scannedValue)
        }
        onDispose {
            removeListener()
            hardware.close()
        }
    }

    LaunchedEffect(hardware) {
        hardwareStatus = withContext(Dispatchers.IO) { hardware.status() }
    }

    suspend fun reload(refreshCart: Boolean = true) {
        val cartGenerationBefore = cartWriteGeneration.get()
        val refreshed =
            withContext(Dispatchers.IO) {
                database.importLegacySnapshotIfNeeded(applicationContext)
                val nextSnapshot = database.snapshot()
                Triple(
                    nextSnapshot,
                    nextSnapshot.terminal?.let(database::cart) ?: NativePosCart.empty("XOF"),
                    database.receiptPrintQueueState(),
                )
            }
        val previousTerminal = snapshot?.terminal
        val nextTerminal = refreshed.first.terminal
        if (
            previousTerminal != null &&
                (nextTerminal == null ||
                    previousTerminal.tenantId != nextTerminal.tenantId ||
                    previousTerminal.branchId != nextTerminal.branchId ||
                    previousTerminal.terminalId != nextTerminal.terminalId)
        ) {
            selectedTicketDetail = null
            intakeCustomer = null
        }
        snapshot = refreshed.first
        if (refreshCart && cartWriteGeneration.get() == cartGenerationBefore)
            cart = refreshed.second
        receiptPrintQueue = refreshed.third
        val checkoutState =
            withContext(Dispatchers.IO) {
                Triple(
                    database.checkoutSettings(),
                    database.receiptPrinterId() != null,
                    database.receiptPrintSettings(),
                )
            }
        checkoutSettings = checkoutState.first
        receiptPrinterConfigured = checkoutState.second
        receiptPrintPreferences = checkoutState.third
        selectedTicketDetail?.let { previous ->
            val updated = refreshed.first.tickets.firstOrNull { it.id == previous.ticket.id }
            if (updated != null) {
                val next =
                    withContext(Dispatchers.IO) {
                        database.decorateTicket(
                            previous.copy(
                                ticket = updated,
                                items = database.ticketItems(updated.id),
                                billedTicketItemIds = database.ticketBilledItemIds(updated.id),
                                pendingTicketItemIds = database.pendingTicketItemIds(updated.id),
                            )
                        )
                    }
                if (selectedTicketDetail?.ticket?.id == updated.id) selectedTicketDetail = next
            }
        }
    }

    DisposableEffect(applicationContext) {
        val work =
            androidx.work.WorkManager.getInstance(applicationContext)
                .getWorkInfosForUniqueWorkLiveData(NativePosSyncWorker.UNIQUE_WORK)
        val observer =
            androidx.lifecycle.Observer<List<androidx.work.WorkInfo>> { infos ->
                if (infos.any { it.state.isFinished }) scope.launch { reload(refreshCart = false) }
            }
        work.observeForever(observer)
        onDispose { work.removeObserver(observer) }
    }

    /**
     * The register dashboard has a few independent secondary panels. A stale
     * Z report or reconciliation must not make the primary shift/register
     * controls unavailable, so only the shift and register calls are required
     * to render it.
     */
    suspend fun loadMoreShiftData(): NativeMoreShiftData = withContext(Dispatchers.IO) {
        val shift = api.get("/pos/staff/current-shift")
        val register = api.get("/pos/staff/current-register")
        val reconciliation = runCatching {
            api.get("/pos/staff/current-register/reconciliation")
        }.getOrDefault(JSONObject())
        val movements = runCatching {
            api.get("/pos/staff/current-register/cash-movements")
        }.getOrDefault(JSONObject())
        val reports = runCatching {
            api.get("/pos/staff/z-reports?limit=10&offset=0")
        }.getOrDefault(JSONObject())
        toNativeMoreShiftData(copy, shift, register, reconciliation, movements, reports)
    }

    suspend fun refreshMoreShiftData() {
        moreShiftData = loadMoreShiftData()
    }

    /** A server-side operation is already complete even if the cache refresh
     * happens to fail. Keep that outcome visible rather than reporting the
     * completed operation as a failure. */
    suspend fun refreshCashOperationsAfterMutation(): String? {
        val cacheError = runCatching {
            withContext(Dispatchers.IO) { NativePosSyncEngine(applicationContext).synchronize() }
        }.exceptionOrNull()
        reload()
        val screenError = runCatching { refreshMoreShiftData() }.exceptionOrNull()
        return screenError?.userMessage() ?: cacheError?.userMessage()
    }

    suspend fun executeReceiptPrint(
        jobId: String? = null,
        includeFailed: Boolean = false,
        failedOnly: Boolean = false,
    ): String? = withContext(Dispatchers.IO) {
        val printerId = database.receiptPrinterId()
        val readiness = hardware.printerReadiness(printerId)
        if (!readiness.success) return@withContext readiness.message
        val printJob = database.claimReceiptPrint(jobId, includeFailed, failedOnly) ?: return@withContext null
        val result = receiptPrintMutex.withLock { hardware.printReceipt(printJob.content, printJob.copies, printerId) }
        if (result.success) {
            database.markReceiptPrintCompleted(printJob.jobId)
            if (internetAvailable) {
                runCatching {
                    api.post("/pos/hardware-devices/print-jobs/results", JSONObject().apply {
                        put("jobId", printJob.jobId)
                        put("documentType", "receipt")
                        put("entityId", printJob.entityId)
                        put("status", "printed")
                        put("attempt", printJob.attempt)
                    })
                }
            }
        } else {
            database.markReceiptPrintFailed(printJob.jobId, result.message)
            if (internetAvailable) {
                runCatching {
                    api.post("/pos/hardware-devices/print-jobs/results", JSONObject().apply {
                        put("jobId", printJob.jobId)
                        put("documentType", "receipt")
                        put("entityId", printJob.entityId)
                        put("status", "failed")
                        put("attempt", printJob.attempt)
                        put("error", result.message.take(1_000))
                    })
                }
            }
        }
        result.message
    }

    fun printReceiptQueue(includeFailed: Boolean) {
        scope.launch {
            busy = true
            try {
                message = executeReceiptPrint(includeFailed = includeFailed, failedOnly = includeFailed) ?: copy.noReceiptToPrint
                receiptPrintQueue = withContext(Dispatchers.IO) { database.receiptPrintQueueState() }
            } catch (error: Exception) {
                message = error.userMessage(copy)
            } finally {
                busy = false
            }
        }
    }

    fun printNextReceipt() = printReceiptQueue(includeFailed = false)
    fun retryFailedReceipt() = printReceiptQueue(includeFailed = true)

    /**
     * Keep UI changes responsive while serialising SQLite writes with checkout.
     * Checkout clears this exact scoped cart in the same transaction as its
     * durable payment command, so an older write cannot restore it afterwards.
     */
    fun updateCart(next: NativePosCart) {
        if (busy) return
        cart = next
        val terminal = snapshot?.terminal ?: return
        val generation = cartWriteGeneration.incrementAndGet()
        scope.launch {
            withContext(Dispatchers.IO) {
                cartWriteMutex.withLock {
                    if (cartWriteGeneration.get() == generation) {
                        database.replaceCart(terminal, next)
                    }
                }
            }
        }
    }

    fun addProductToSale(product: NativeProduct) {
        val nextQuantity = (cart.products.firstOrNull { it.skuId == product.skuId }?.quantity ?: 0) + 1
        when {
            !internetAvailable && !canAddOffline(product, nextQuantity) -> {
                message = copy.offlineStockShort.format(product.name)
            }
            internetAvailable && !canAddOnline(product, nextQuantity) -> {
                message = copy.stockShort.format(product.name)
            }
            else -> {
                updateCart(cart.copy(products = cart.products.upsert(product, nextQuantity)))
                message = copy.addedToTill.format(product.name)
            }
        }
    }

    suspend fun refreshSelectedTicket(ticketId: String, currency: String) {
        val items =
            withContext(Dispatchers.IO) {
                NativePosSyncEngine(applicationContext).refreshTicketItems(ticketId, currency)
            }
        reload(refreshCart = false)
        val billing =
            withContext(Dispatchers.IO) {
                database.ticketBilledItemIds(ticketId) to database.pendingTicketItemIds(ticketId)
            }
        if (selectedTicketDetail?.ticket?.id != ticketId) return
        selectedTicketDetail =
            snapshot
                ?.tickets
                ?.firstOrNull { it.id == ticketId }
                ?.let {
                    database.decorateTicket(
                        NativeTicketDetail(
                            ticket = it,
                            items = items,
                            billedTicketItemIds = billing.first,
                            pendingTicketItemIds = billing.second,
                            cartTicketItemIds =
                                cart.ticketItems
                                    .filter { it.ticketId == ticketId }
                                    .mapTo(linkedSetOf()) { it.ticketItemId },
                            hasPendingCashCheckout = billing.second.isNotEmpty(),
                        )
                    )
                }
    }

    fun synchronize() {
        scope.launch {
            busy = true
            try {
                val result = withContext(Dispatchers.IO) { NativePosSyncEngine(applicationContext).synchronize() }
                NativePosSyncWorker.schedule(applicationContext)
                reload()
                if (snapshot?.catalogIsFresh != true) {
                    throw NativePosValidationException(copy.localDataExpired)
                }
                message = when {
                    result.failedSales > 0 -> copy.failedSalesNeedManager.format(result.failedSales)
                    result.intakeSyncError != null -> result.intakeSyncError.userMessage(copy)
                    (snapshot?.failedIntakes ?: 0) > 0 -> copy.intakeQueueCount.format(snapshot?.pendingIntakes ?: 0,snapshot?.failedIntakes ?: 0)
                    result.replayedSales > 0 -> copy.replayedSales.format(result.replayedSales)
                    else -> copy.syncedCatalogShift
                }
            } catch (error: Exception) {
                message = error.userMessage(copy)
            } finally {
                busy = false
            }
        }
    }

    fun toggleOfflineMode() {
        if (!offlineModeEnabled) {
            offlineModeEnabled = true
            message = copy.offlineDrillOn
            return
        }
        if (!physicalInternetAvailable) {
            message = copy.noNetworkToRestore
            return
        }
        offlineModeEnabled = false
        synchronize()
    }

    fun refreshHardware(loadConfiguredDevices: Boolean = true) {
        scope.launch {
            busy = true
            try {
                val refreshed = withContext(Dispatchers.IO) {
                    val localStatus = hardware.status()
                    val configuredDevices = if (loadConfiguredDevices && internetAvailable) {
                        api.get("/pos/hardware-devices").optJSONArray("data").toNativeHardwareDevices()
                    } else {
                        null
                    }
                    configuredDevices?.let { devices ->
                        database.replaceReceiptPrinterBinding(devices.defaultReceiptPrinterId())
                    }
                    localStatus to configuredDevices
                }
                hardwareStatus = refreshed.first
                refreshed.second?.let { hardwareDevices = it }
                message = if (internetAvailable) copy.refreshedHardwareAndDevices else copy.refreshedHardware
            } catch (error: Exception) {
                message = error.userMessage(copy)
            } finally {
                busy = false
            }
        }
    }

    fun requestBluetoothPermissions() {
        val activity = hostActivity
        if (activity == null) {
            message = copy.bluetoothNeedsRestart
            return
        }
        val missing = hardware.missingBluetoothPermissions()
        if (missing.isEmpty()) {
            message = copy.bluetoothAllowed
            return
        }
        ActivityCompat.requestPermissions(activity, missing.toTypedArray(), BLUETOOTH_PERMISSION_REQUEST_CODE)
        message = copy.bluetoothPromptHint
    }

    fun refreshBluetoothPrinters() {
        scope.launch {
            busy = true
            try {
                bluetoothPrinters = withContext(Dispatchers.IO) { hardware.pairedBluetoothPrinters() }
                message = if (bluetoothPrinters.isEmpty()) copy.noPairedBluetoothPrinters else copy.readPairedPrinters.format(bluetoothPrinters.size)
            } catch (error: Exception) {
                message = error.userMessage(copy)
            } finally {
                busy = false
            }
        }
    }

    fun bindBluetoothPrinter(device: NativeHardwareDevice, printer: NativeBluetoothPrinter) {
        if (!internetAvailable) {
            message = copy.bindNeedsNetwork
            return
        }
        scope.launch {
            busy = true
            try {
                val test = withContext(Dispatchers.IO) {
                    hardware.printReceipt(
                        content = listOf(
                            "CleanHub",
                            copy.bluetoothTestTitle,
                            copy.printerLinePrefix.format(printer.name),
                            copy.terminalLinePrefix.format(snapshot?.terminal?.terminalId ?: copy.notRegistered),
                            "",
                        ).joinToString("\n"),
                        copies = 1,
                        printerId = printer.id,
                    )
                }
                if (!test.success) throw NativePosValidationException(test.message)
                val devices = withContext(Dispatchers.IO) {
                    val purpose = if (device.config.optString("printerPurpose") == "label") "label" else "receipt"
                    val hasOtherDefault = hardwareDevices.any { candidate ->
                        candidate.id != device.id && candidate.deviceType == "printer" && candidate.status == "active" &&
                            (if (candidate.config.optString("printerPurpose") == "label") "label" else "receipt") == purpose &&
                            candidate.config.optBoolean("printerIsDefault")
                    }
                    api.put("/pos/hardware-devices/${device.id}/printer-binding", JSONObject().apply {
                        put("printerId", printer.id)
                        put("printerName", printer.name)
                        put("isDefault", device.config.optBoolean("printerIsDefault") || !hasOtherDefault)
                        put("version", device.version)
                    })
                    api.get("/pos/hardware-devices").optJSONArray("data").toNativeHardwareDevices().also {
                        database.replaceReceiptPrinterBinding(it.defaultReceiptPrinterId())
                    }
                }
                hardwareDevices = devices
                message = copy.boundPrinter.format(printer.name)
            } catch (error: Exception) {
                message = error.userMessage(copy)
            } finally {
                busy = false
            }
        }
    }

    fun testHardwarePrinter() {
        scope.launch {
            busy = true
            try {
                val result = withContext(Dispatchers.IO) {
                    hardware.printReceipt(
                        content = listOf(
                            "CleanHub",
                            copy.printerTestPageTitle,
                            copy.terminalLinePrefix.format(snapshot?.terminal?.terminalId ?: copy.notRegistered),
                            copy.timeLinePrefix.format(java.time.Instant.now()),
                            "",
                        ).joinToString("\n"),
                        copies = 1,
                        printerId = database.receiptPrinterId(),
                    )
                }
                hardwareStatus = withContext(Dispatchers.IO) { hardware.status() }
                message = result.message
            } catch (error: Exception) {
                message = error.userMessage(copy)
            } finally {
                busy = false
            }
        }
    }

    fun triggerHardwareScanner() {
        if (startKeyboardScannerSession(NativeHardwareScannerPurpose.Test)) {
            return
        }
        val systemScannerIntent = hardware.scannerActivityIntent()
        if (systemScannerIntent != null) {
            scannerRegistrationPending = false
            message = copy.useSystemScanner
            scannerActivityLauncher.launch(systemScannerIntent)
            return
        }
        scope.launch {
            busy = true
            try {
                val result = withContext(Dispatchers.IO) { hardware.requestScan() }
                hardwareStatus = withContext(Dispatchers.IO) { hardware.status() }
                message = result.message
            } catch (error: Exception) {
                message = error.userMessage(copy)
            } finally {
                busy = false
            }
        }
    }

    fun connectBuiltInHardware(deviceType: String) {
        if (!internetAvailable) {
            message = copy.registrationNeedsNetwork
            return
        }
        if (deviceType == "scanner") {
            if (startKeyboardScannerSession(NativeHardwareScannerPurpose.Registration)) {
                return
            }
            val systemScannerIntent = hardware.scannerActivityIntent()
            if (systemScannerIntent != null) {
                scannerRegistrationPending = true
                message = copy.scanAnyBarcode
                scannerActivityLauncher.launch(systemScannerIntent)
                return
            }
        }
        scope.launch {
            busy = true
            try {
                registerBuiltInHardware(deviceType, scannerAlreadyTested = false)
            } catch (error: Exception) {
                message = error.userMessage(copy)
            } finally {
                busy = false
            }
        }
    }

    fun openDrawerFromHardwareSettings() {
        if (!internetAvailable) {
            message = copy.drawerNeedsNetworkAuth
            return
        }
        scope.launch {
            busy = true
            try {
                withContext(Dispatchers.IO) {
                    api.post(
                        "/pos/hardware-devices/actions/manual-drawer-open",
                        JSONObject().put("reason", "Native POS hardware settings manual drawer test"),
                    )
                }
                val result = withContext(Dispatchers.IO) { hardware.openCashDrawer() }
                hardwareStatus = withContext(Dispatchers.IO) { hardware.status() }
                message = result.message
            } catch (error: Exception) {
                message = error.userMessage(copy)
            } finally {
                busy = false
            }
        }
    }

    fun openMoreDestination(destination: NativeMoreDestination) {
        if (busy) return
        moreDestination = destination
        if (destination == NativeMoreDestination.Settings) {
            val terminalId = snapshot?.terminal?.terminalId
            if (terminalSettingsScope != terminalId) {
                terminalSettings = null
                terminalSettingsScope = terminalId
            }
            terminalSettingsReady = false
        }
        if (destination == NativeMoreDestination.Hardware) {
            refreshHardware()
            return
        }
        if (destination == NativeMoreDestination.Menu ||
            destination == NativeMoreDestination.Customers ||
            destination == NativeMoreDestination.Catalog ||
            destination == NativeMoreDestination.Scan
        ) return
        if (!internetAvailable) {
            message = copy.moreNeedsNetwork.format(destination.title(copy))
            return
        }
        scope.launch {
            busy = true
            try {
                when (destination) {
                    NativeMoreDestination.Orders -> {
                        val branchId = snapshot?.terminal?.branchId
                            ?: throw NativePosValidationException(copy.branchNotFound)
                        moreOrders = withContext(Dispatchers.IO) {
                            api.get("/pos/orders?branchId=$branchId&limit=50&offset=0")
                                .optJSONArray("data")
                                .toNativeMoreOrders()
                        }
                    }
                    NativeMoreDestination.Statistics -> {
                        val branchId = snapshot?.terminal?.branchId
                            ?: throw NativePosValidationException(copy.branchNotFound)
                        moreStatistics = withContext(Dispatchers.IO) {
                            api.get("/pos/statistics/overview?period=$moreStatisticsPeriod&branchId=$branchId")
                                .toNativeMoreStatistics()
                        }
                    }
                    NativeMoreDestination.Notifications -> {
                        moreNotifications = withContext(Dispatchers.IO) {
                            api.get("/pos/notifications?limit=50&offset=0")
                                .optJSONArray("data")
                                .toNativeMoreNotifications()
                        }
                    }
                    NativeMoreDestination.Settings -> {
                        terminalSettings = withContext(Dispatchers.IO) {
                            val (branch, settings) = NativePosSyncEngine(applicationContext).refreshTerminalConfiguration()
                            settings.toNativeTerminalSettingsSummary(branch)
                        }
                        terminalSettingsReady = true
                        reload()
                    }
                    NativeMoreDestination.Shift -> {
                        refreshMoreShiftData()
                    }
                    else -> Unit
                }
                message = null
            } catch (error: Exception) {
                message = error.userMessage(copy)
            } finally {
                busy = false
            }
        }
    }

    suspend fun openMoreOrderDetailAfterMutation(orderId: String) {
        moreOrderDetail = withContext(Dispatchers.IO) {
            val detail = api.get("/pos/orders/$orderId")
            val payments = api.get("/pos/orders/$orderId/payments")
            val adjustments = api.get("/pos/payment-adjustments?orderId=$orderId")
            detail.toNativeMoreOrderDetail(payments.optJSONArray("data"))
                .copy(adjustments = adjustments.optJSONArray("data").toNativeMorePaymentAdjustments())
        }
        reload()
    }

    fun openMoreOrder(orderId: String) {
        if (!internetAvailable) {
            message = copy.orderDetailNeedsNetwork
            return
        }
        moreDestination = NativeMoreDestination.OrderDetail
        scope.launch {
            busy = true
            try {
                openMoreOrderDetailAfterMutation(orderId)
                message = null
            } catch (error: Exception) {
                message = error.userMessage(copy)
            } finally {
                busy = false
            }
        }
    }

    fun searchMore(query: String) {
        val normalized = query.trim()
        if (normalized.isEmpty()) {
            moreSearchResults = emptyList()
            return
        }
        if (!internetAvailable) {
            message = copy.offlineSearchLimited
            return
        }
        scope.launch {
            busy = true
            try {
                moreSearchResults = withContext(Dispatchers.IO) {
                    val encoded = java.net.URLEncoder.encode(normalized, "UTF-8")
                    api.get("/pos/search?q=$encoded&limit=10").toNativeMoreSearchResults()
                }
                message = null
            } catch (error: Exception) {
                message = error.userMessage(copy)
            } finally {
                busy = false
            }
        }
    }

    fun openMoreSearchResult(result: NativeMoreSearchResult) {
        when (result.type) {
            "order" -> openMoreOrder(result.id)
            "ticket" -> {
                val cached = snapshot?.tickets?.firstOrNull { it.id == result.id }
                if (cached != null) {
                    activeTab = NativePosTab.Tickets
                    selectedTicketDetail = NativeTicketDetail(cached, emptyList())
                    if (internetAvailable) {
                        scope.launch { runCatching { refreshSelectedTicket(cached.id, cached.currency) } }
                    }
                } else if (internetAvailable) {
                    scope.launch {
                        busy = true
                        try {
                            val ticket = withContext(Dispatchers.IO) {
                                api.get("/pos/service-tickets/${result.id}")
                                    .toNativeMoreTicket(snapshot?.terminal?.currency ?: "XOF")
                            }
                            activeTab = NativePosTab.Tickets
                            selectedTicketDetail = NativeTicketDetail(ticket, emptyList())
                            refreshSelectedTicket(ticket.id, ticket.currency)
                        } catch (error: Exception) {
                            message = error.userMessage(copy)
                        } finally {
                            busy = false
                        }
                    }
                } else {
                    message = copy.ticketNotCached
                }
            }
            "customer" -> {
                val cached = snapshot?.customers?.firstOrNull { it.id == result.id }
                if (cached != null) {
                    intakeCustomer = cached
                    activeTab = NativePosTab.Intake
                } else if (internetAvailable) {
                    scope.launch {
                        busy = true
                        try {
                            intakeCustomer = withContext(Dispatchers.IO) {
                                api.get("/pos/customers/${result.id}").toNativeMoreCustomer()
                            }
                            activeTab = NativePosTab.Intake
                        } catch (error: Exception) {
                            message = error.userMessage(copy)
                        } finally {
                            busy = false
                        }
                    }
                } else {
                    message = copy.customerNotCached
                }
            }
        }
    }

    fun saveTerminalSettings(patch: NativeTerminalSettingsPatch) {
        if (!internetAvailable) { message = copy.settingsNeedNetwork; return }
        if (!terminalSettingsReady || terminalSettings == null || !patch.isValid()) { message = copy.settingsOutOfRange; return }
        scope.launch {
            busy = true
            try {
                val previous = terminalSettings
                terminalSettings = withContext(Dispatchers.IO) {
                    api.patch("/pos/terminal-settings", JSONObject().apply {
                        patch.label?.let { put("label", it.trim()) }
                        patch.roundingRule?.let { put("roundingRule", it) }
                        patch.autoPrintReceipt?.let { put("autoPrintReceipt", it) }
                        patch.printCopies?.let { put("printCopies", it) }
                        patch.lockTimeoutSeconds?.let { put("lockTimeoutSeconds", it) }
                    }).also { result ->
                        requireNativeTerminalDevice(result.optString("deviceId"), session.deviceId(), copy)
                    }.toNativeTerminalSettingsSummary().copy(
                        branchAddress = previous?.branchAddress, branchPhone = previous?.branchPhone,
                    ).also {
                        database.replaceReceiptPrintSettings(it.autoPrintReceipt, it.printCopies)
                        database.replaceCheckoutSettings(database.checkoutSettings().copy(
                            roundingRule = it.roundingRule, autoPrintReceipt = it.autoPrintReceipt,
                            lockTimeoutSeconds = it.lockTimeoutSeconds,
                        ))
                    }
                }
                reload()
                message = copy.settingsSaved
            } catch (error: Exception) { message = error.userMessage(copy) }
            finally { busy = false }
        }
    }

    fun performShiftAction(action: String) {
        if (!internetAvailable) {
            message = copy.shiftNeedsNetwork
            return
        }
        scope.launch {
            busy = true
            try {
                withContext(Dispatchers.IO) {
                    api.post("/pos/staff/clock", JSONObject().put("action", action))
                }
                val refreshWarning = refreshCashOperationsAfterMutation()
                val successMessage = when (action) {
                    "clock_in" -> copy.shiftStarted
                    "break_start" -> copy.breakStarted
                    "break_end" -> copy.breakEnded
                    else -> copy.shiftStatusUpdated
                }
                message = if (refreshWarning == null) successMessage else copy.cacheRefreshesLater.format(successMessage)
            } catch (error: Exception) {
                message = error.userMessage(copy)
            } finally {
                busy = false
            }
        }
    }

    fun createCashMovement(type: String, amount: String, reason: String) {
        if (!internetAvailable) {
            message = copy.cashMovementNeedsNetwork
            return
        }
        if (!isPositiveDecimal(amount) || reason.trim().length < 3) {
            message = copy.cashMovementInvalid
            return
        }
        // The same type, amount and reason is the same movement being retried,
        // not a second one: re-tapping after a timeout must reuse its key.
        val movementSubject = "$type|$amount|${reason.trim()}"
        scope.launch {
            busy = true
            try {
                withContext(Dispatchers.IO) {
                    api.post("/pos/staff/current-register/cash-movements", JSONObject().apply {
                        put("movementType", type)
                        put("amount", amount)
                        put("reason", reason.trim())
                        put("idempotencyKey", cashMovementKeys.keyFor(movementSubject))
                    })
                }
                // Released only once the server has it; until then a retry must
                // carry the same key.
                cashMovementKeys.release(movementSubject)
                val refreshWarning = refreshCashOperationsAfterMutation()
                val successMessage = if (type == "pay_in") copy.payInRecorded else copy.payOutRecorded
                message = if (refreshWarning == null) successMessage else copy.cacheRefreshesLater.format(successMessage)
            } catch (error: Exception) {
                message = error.userMessage(copy)
            } finally {
                busy = false
            }
        }
    }

    fun recordMoreOrderCash(order: NativeMoreOrderDetail, tenderedAmount: String) {
        if (!internetAvailable) {
            message = copy.orderPaymentNeedsNetwork
            return
        }
        val cashState = snapshot?.cashState
        if (cashState == null) {
            message = copy.cashDisabledStore
            return
        }
        val outstanding = outstandingAmount(order.totalAmount, order.paidAmount)
        val actualTenderedAmount = tenderedAmount.ifBlank { outstanding }
        if (!isPositiveDecimal(outstanding) || !isAtLeast(actualTenderedAmount, outstanding)) {
            message = copy.tenderBelowOutstanding.format("$outstanding ${order.currency}")
            return
        }
        // Generated once per payment attempt and kept until it succeeds, so a
        // retry after a timeout reaches the server with the key it already
        // saw. `occurredAt` is captured alongside it for the same reason: a
        // replay must not look like a different payment.
        val idempotencyKey = moreOrderCashKeys.keyFor(order.id)
        val occurredAt = java.time.Instant.ofEpochMilli(NativeServerClock.now()).toString()
        scope.launch {
            busy = true
            try {
                withContext(Dispatchers.IO) {
                    api.post("/pos/orders/${order.id}/payments", JSONObject().apply {
                        put("paymentMethod", "cash")
                        put("amount", outstanding)
                        put("tenderedAmount", actualTenderedAmount)
                        put("occurredAt", occurredAt)
                        put("idempotencyKey", idempotencyKey)
                    })
                }
                openMoreOrderDetailAfterMutation(order.id)
                // Landed and refreshed: a further payment on this order may
                // now start a new idempotency key.
                moreOrderCashKeys.release(order.id)
                moreOrderDetail?.let { updated ->
                    moreOrders = moreOrders.map { row ->
                        if (row.id == updated.id) row.copy(
                            totalAmount = updated.totalAmount,
                            status = updated.status,
                            paymentStatus = updated.paymentStatus,
                        ) else row
                    }
                }
                message = copy.cashPaymentRecorded
            } catch (error: Exception) {
                message = error.userMessage(copy)
            } finally {
                busy = false
            }
        }
    }

    fun changeMoreOrderStatus(order: NativeMoreOrderDetail, target: String) {
        if (!internetAvailable) {
            message = copy.orderStatusNeedsNetwork
            return
        }
        scope.launch {
            busy = true
            try {
                withContext(Dispatchers.IO) {
                    api.post("/pos/orders/${order.id}/status-changes", JSONObject().apply {
                        put("to", target)
                        put("version", order.version)
                    })
                }
                openMoreOrderDetailAfterMutation(order.id)
                message = copy.orderStatusUpdated
            } catch (error: Exception) {
                message = error.userMessage(copy)
            } finally {
                busy = false
            }
        }
    }

    fun resolveMoreManualPayment(order: NativeMoreOrderDetail, payment: NativeMorePayment, confirmed: Boolean, reason: String) {
        if (!internetAvailable) {
            message = copy.orderPaymentNeedsNetwork
            return
        }
        if (payment.method != "app" || payment.status != "pending") return
        scope.launch {
            busy = true
            try {
                withContext(Dispatchers.IO) {
                    api.post(
                        "/pos/orders/${order.id}/payments/${payment.id}/${if (confirmed) "confirm" else "fail"}",
                        JSONObject().put("reason", reason.trim()),
                    )
                }
                openMoreOrderDetailAfterMutation(order.id)
                message = if (confirmed) copy.manualPaymentConfirmed else copy.manualPaymentMarkedFailed
            } catch (error: Exception) {
                message = error.userMessage(copy)
            } finally {
                busy = false
            }
        }
    }

    fun createMoreRefund(order: NativeMoreOrderDetail, payment: NativeMorePayment, amount: String, reason: String) {
        if (!internetAvailable) { message = copy.orderPaymentNeedsNetwork; return }
        val amountMinor = parseMoney(amount)
        if (payment.status != "paid" || amountMinor == null || amountMinor <= 0 ||
            amountMinor > (parseMoney(payment.amount) ?: 0) || reason.trim().isEmpty()) {
            message = copy.refundInvalid
            return
        }
        val subject = "${order.id}:${payment.id}:${refundMinorToMoney(amountMinor)}:${reason.trim()}"
        scope.launch {
            busy = true
            try {
                val result = withContext(Dispatchers.IO) {
                    api.post("/pos/payment-adjustments/refunds", JSONObject().apply {
                        put("orderId", order.id)
                        put("originalPaymentId", payment.id)
                        put("amount", refundMinorToMoney(amountMinor))
                        put("reason", reason.trim())
                        put("idempotencyKey", moreOrderRefundKeys.keyFor(subject))
                    })
                }
                moreOrderRefundKeys.release(subject)
                result.optJSONObject("adjustment")?.toNativeMorePaymentAdjustment()?.let { adjustment ->
                    moreOrderDetail = moreOrderDetail?.takeIf { it.id == order.id }?.let { current ->
                        current.copy(
                            paidAmount = result.optString("paidAmount", current.paidAmount),
                            paymentStatus = result.optString("paymentStatus", current.paymentStatus),
                            adjustments = current.adjustments.filterNot { it.id == adjustment.id } + adjustment,
                        )
                    }
                }
                val refreshError = runCatching { openMoreOrderDetailAfterMutation(order.id) }.exceptionOrNull()
                val outcomeMessage = if (result.optJSONObject("adjustment")?.optString("status") == "pending") copy.refundPending else copy.refundRecorded
                message = refreshError?.let { copy.cacheRefreshesLater.format(outcomeMessage) } ?: outcomeMessage
                if (payment.method == "cash" && result.optJSONObject("adjustment")?.optString("status") == "succeeded") {
                    val drawerResult = withContext(Dispatchers.IO) { hardware.openCashDrawer() }
                    if (!drawerResult.success) message = "$outcomeMessage ${drawerResult.message}"
                }
            } catch (error: Exception) {
                message = error.userMessage(copy)
            } finally {
                busy = false
            }
        }
    }

    fun resolveMoreRefund(order: NativeMoreOrderDetail, adjustment: NativeMorePaymentAdjustment, succeeded: Boolean, reference: String, reason: String) {
        if (!internetAvailable) { message = copy.orderPaymentNeedsNetwork; return }
        if (adjustment.type != "refund" || adjustment.status !in setOf("pending", "failed") || reason.trim().length < 3 ||
            (succeeded && reference.trim().isEmpty())) {
            message = copy.refundResolutionInvalid
            return
        }
        scope.launch {
            busy = true
            try {
                val result = withContext(Dispatchers.IO) {
                    api.post("/pos/payment-adjustments/${adjustment.id}/refund-outcome", JSONObject().apply {
                        put("outcome", if (succeeded) "succeeded" else "failed")
                        put("reason", reason.trim())
                        if (succeeded) put("settlementReference", reference.trim())
                    })
                }
                result.optJSONObject("adjustment")?.toNativeMorePaymentAdjustment()?.let { updated ->
                    moreOrderDetail = moreOrderDetail?.takeIf { it.id == order.id }?.let { current ->
                        current.copy(
                            paidAmount = result.optString("paidAmount", current.paidAmount),
                            paymentStatus = result.optString("paymentStatus", current.paymentStatus),
                            adjustments = current.adjustments.filterNot { it.id == updated.id } + updated,
                        )
                    }
                }
                val refreshError = runCatching { openMoreOrderDetailAfterMutation(order.id) }.exceptionOrNull()
                val outcomeMessage = if (succeeded) copy.refundSettled else copy.refundFailed
                message = refreshError?.let { copy.cacheRefreshesLater.format(outcomeMessage) } ?: outcomeMessage
            } catch (error: Exception) {
                message = error.userMessage(copy)
            } finally {
                busy = false
            }
        }
    }

    fun markNotificationRead(deliveryId: String) {
        if (!internetAvailable) {
            message = copy.notificationNeedsNetwork
            return
        }
        scope.launch {
            busy = true
            try {
                withContext(Dispatchers.IO) { api.patch("/pos/notifications/$deliveryId/read", JSONObject()) }
                moreNotifications = moreNotifications.map {
                    if (it.deliveryId == deliveryId) it.copy(readStatus = "read") else it
                }
            } catch (error: Exception) {
                message = error.userMessage(copy)
            } finally {
                busy = false
            }
        }
    }

    fun markAllNotificationsRead() {
        if (!internetAvailable) {
            message = copy.notificationNeedsNetwork
            return
        }
        scope.launch {
            busy = true
            try {
                withContext(Dispatchers.IO) { api.patch("/pos/notifications/read-all", JSONObject()) }
                moreNotifications = moreNotifications.map { it.copy(readStatus = "read") }
                message = copy.allNotificationsRead
            } catch (error: Exception) {
                message = error.userMessage(copy)
            } finally {
                busy = false
            }
        }
    }

    fun archiveNotification(deliveryId: String) {
        if (!internetAvailable) {
            message = copy.archiveNeedsNetwork
            return
        }
        scope.launch {
            busy = true
            try {
                withContext(Dispatchers.IO) { api.patch("/pos/notifications/$deliveryId/archive", JSONObject()) }
                moreNotifications = moreNotifications.map {
                    if (it.deliveryId == deliveryId) it.copy(readStatus = "archived") else it
                }
            } catch (error: Exception) {
                message = error.userMessage(copy)
            } finally {
                busy = false
            }
        }
    }

    fun loginWithStaffPin(pin: String) {
        scope.launch {
            busy = true
            try {
                val effectiveLanguage = withContext(Dispatchers.IO) {
                    val auth = api.loginWithPin(pin).getJSONObject("authContext")
                    session.saveTenantDefaultLanguageCode(auth.optString("language"))
                    session.saveOfflinePin(auth.getString("userId"), pin)
                    NativePosSyncEngine(applicationContext).synchronize(includeIntakes = false)
                    session.pinLanguageCode()
                }
                NativePosSyncWorker.schedule(applicationContext)
                reload()
                pinLanguage = NativePinLanguage.fromCode(effectiveLanguage)
                unlocked = true
                activeTab = NativePosTab.Workspace
                message = nativePosCopy(effectiveLanguage).loginSucceeded
            } catch (error: Exception) {
                message = error.userMessage(copy)
            } finally {
                busy = false
            }
        }
    }

    fun unlockWithOfflinePin(userId: String, pin: String) {
        scope.launch {
            busy = true
            try {
                val result = withContext(Dispatchers.Default) {
                    if (!session.canAttemptOfflinePin(userId)) {
                        NativeOfflinePinResult(verified = false, lockedForSeconds = session.offlinePinLockedForSeconds(userId))
                    } else {
                        NativeOfflinePinResult(verified = session.verifyOfflinePin(userId, pin))
                    }
                }
                when {
                    result.lockedForSeconds != null -> {
                        message = copy.pinTemporarilyLocked.format(result.lockedForSeconds)
                    }
                    result.verified -> {
                        unlocked = true
                        activeTab = NativePosTab.Workspace
                        message = null
                    }
                    else -> message = copy.pinIncorrect
                }
            } catch (error: Exception) {
                message = error.userMessage(copy)
            } finally {
                busy = false
            }
        }
    }

    fun openRegister(openingFloat: String) {
        if (!internetAvailable) {
            message = copy.openRegisterNeedsNetwork
            return
        }
        val normalizedOpeningFloat = openingFloat.trim()
        if (normalizedOpeningFloat.isNotEmpty() && !isPositiveDecimal(normalizedOpeningFloat) && normalizedOpeningFloat != "0") {
            message = copy.floatInvalid
            return
        }
        scope.launch {
            busy = true
            try {
                withContext(Dispatchers.IO) {
                    api.post("/pos/staff/register-sessions/open", JSONObject().apply {
                        // Omit an optional value instead of sending an empty
                        // string: the API correctly rejects an empty decimal.
                        normalizedOpeningFloat.takeIf { it.isNotEmpty() }?.let { put("openingFloat", it) }
                    })
                }
                val refreshWarning = refreshCashOperationsAfterMutation()
                message = if (refreshWarning == null) {
                    copy.registerOpenedOfflineReady
                } else {
                    copy.registerOpenedCacheLater
                }
            } catch (error: Exception) {
                message = error.userMessage(copy)
            } finally {
                busy = false
            }
        }
    }

    fun closeRegister(countedCash: String, notes: String) {
        if (!internetAvailable) {
            message = copy.closeRegisterNeedsNetwork
            return
        }
        scope.launch {
            busy = true
            try {
                withContext(Dispatchers.IO) {
                    api.post("/pos/staff/register-sessions/close", JSONObject().apply {
                        countedCash.trim().takeIf { it.isNotEmpty() }?.let { put("countedCash", it) }
                        notes.trim().takeIf { it.isNotEmpty() }?.let { put("notes", it) }
                    })
                }
                val refreshWarning = refreshCashOperationsAfterMutation()
                message = if (refreshWarning == null) {
                    copy.registerClosedZReady
                } else {
                    copy.registerClosedCacheLater
                }
            } catch (error: Exception) {
                message = error.userMessage(copy)
            } finally {
                busy = false
            }
        }
    }

    fun clockOut() {
        scope.launch {
            busy = true
            try {
                withContext(Dispatchers.IO) {
                    api.post("/pos/staff/clock", JSONObject().put("action", "clock_out"))
                    NativePosSyncEngine(applicationContext).synchronize()
                }
                reload()
                unlocked = false
                cart = NativePosCart.empty(cart.currency)
                selectedTicketDetail = null
                activeTab = NativePosTab.Workspace
                message = copy.shiftEndedNextCashier
            } catch (error: Exception) {
                message = error.userMessage(copy)
            } finally {
                busy = false
            }
        }
    }

    fun createCustomer(fullName: String, phone: String) {
        if (!internetAvailable) {
            message = copy.createCustomerNeedsNetwork
            return
        }
        // Creating a customer is two calls -- the account, then the profile
        // under it -- with no transaction spanning them. Both ids are minted
        // once and reused on every retry, because the server returns the
        // existing record when it is given an id it has already seen. Minting
        // fresh ids per attempt left an account with no profile behind and
        // created a second account on the next tap.
        val attempt = pendingCustomerDraft
            ?.takeIf { it.fullName == fullName.trim() && it.phone == phone.trim() }
            ?: NativeCustomerDraft(
                accountId = NativeUlid.create(),
                profileId = NativeUlid.create(),
                fullName = fullName.trim(),
                phone = phone.trim(),
            ).also { pendingCustomerDraft = it }

        scope.launch {
            busy = true
            try {
                withContext(Dispatchers.IO) {
                    val account = api.post("/pos/accounts", JSONObject().apply {
                        put("id", attempt.accountId)
                        put("accountName", attempt.fullName)
                        put("phone", attempt.phone)
                    })
                    api.post("/pos/accounts/${account.getString("id")}/customers", JSONObject().apply {
                        put("id", attempt.profileId)
                        put("fullName", attempt.fullName)
                        put("phone", attempt.phone)
                    })
                    NativePosSyncEngine(applicationContext).synchronize()
                }
                // Both halves landed, so the next customer starts fresh.
                pendingCustomerDraft = null
                reload()
                message = copy.customerCreated
            } catch (error: Exception) {
                message = error.userMessage(copy)
            } finally {
                busy = false
            }
        }
    }

    fun syncIntakeInBackground(ticketId: String, currency: String, retry: Boolean = false) {
        NativePosSyncWorker.schedule(applicationContext)
        if (!internetAvailable) return
        scope.launch {
            try {
                withContext(Dispatchers.IO) {
                    NativePosSyncEngine(applicationContext).synchronizeIntakes(ticketId, retry)
                }
                if (selectedTicketDetail?.ticket?.id == ticketId)
                    refreshSelectedTicket(ticketId, currency)
                else reload(refreshCart = false)
            } catch (error: Exception) {
                reload(refreshCart = false)
                selectedTicketDetail
                    ?.takeIf { it.ticket.id == ticketId }
                    ?.let {
                        selectedTicketDetail =
                            database.decorateTicket(it.copy(items = database.ticketItems(ticketId)))
                    }
            }
        }
    }

    fun createServiceTicket(
        customer: NativeCustomer,
        ticketType: String,
        priority: String,
        remark: String,
        expectedPickupText: String,
    ) {
        if (busy) return
        busy = true
        message = null
        scope.launch {
            try {
                val (ticketId, currency) =
                    withContext(Dispatchers.IO) {
                        val terminal =
                            database.snapshot().terminal
                                ?: throw NativePosValidationException(copy.localBranchNotFound)
                        val pickup =
                            expectedPickupText
                                .trim()
                                .takeIf { it.isNotEmpty() }
                                ?.let {
                                    localTicketDateTimeToIso(it, terminal.timeZone)
                                        ?: throw NativePosValidationException(copy.pickupTimeInvalid)
                                }
                        require(remark.length <= 2000)
                        database.intakeStore.createTicket(
                            terminal,
                            customer,
                            ticketType,
                            priority,
                            remark,
                            pickup,
                        ) to terminal.currency
                    }
                reload(refreshCart = false)
                activeTab = NativePosTab.Tickets
                selectedTicketDetail =
                    snapshot
                        ?.tickets
                        ?.firstOrNull { it.id == ticketId }
                        ?.let { database.decorateTicket(NativeTicketDetail(it, emptyList())) }
                message = copy.intakeSavedLocally
                syncIntakeInBackground(ticketId, currency)
            } catch (error: Exception) {
                message = error.userMessage(copy)
            } finally {
                busy = false
            }
        }
    }

    fun openTicket(ticket: NativeServiceTicket) {
        scope.launch {
            val cached =
                withContext(Dispatchers.IO) {
                    Triple(
                        database.ticketItems(ticket.id),
                        database.ticketBilledItemIds(ticket.id),
                        database.pendingTicketItemIds(ticket.id),
                    )
                }
            selectedTicketDetail =
                database.decorateTicket(
                    NativeTicketDetail(
                        ticket = ticket,
                        items = cached.first,
                        billedTicketItemIds = cached.second,
                        pendingTicketItemIds = cached.third,
                        cartTicketItemIds =
                            cart.ticketItems
                                .filter { it.ticketId == ticket.id }
                                .mapTo(linkedSetOf()) { it.ticketItemId },
                        hasPendingCashCheckout = cached.third.isNotEmpty(),
                    )
                )
            if (!internetAvailable) return@launch
            busy = true
            try {
                withContext(Dispatchers.IO) {
                    NativePosSyncEngine(applicationContext).synchronizeIntakes(ticket.id)
                }
                refreshSelectedTicket(ticket.id, ticket.currency)
                message = null
            } catch (error: Exception) {
                message = error.userMessage(copy)
            } finally {
                busy = false
            }
        }
    }

    fun addServiceTicketItem(ticket: NativeServiceTicket, draft: NativeTicketItemDraft) {
        if (busy) return
        busy = true
        scope.launch {
            try {
                withContext(Dispatchers.IO) {
                    val terminal =
                        database.snapshot().terminal
                            ?: throw NativePosValidationException(copy.localBranchNotFound)
                    database.intakeStore.createItem(terminal, ticket, draft)
                }
                reload(refreshCart = false)
                selectedTicketDetail
                    ?.takeIf { it.ticket.id == ticket.id }
                    ?.let { current ->
                        selectedTicketDetail =
                            database.decorateTicket(
                                current.copy(
                                    ticket =
                                        snapshot?.tickets?.firstOrNull { it.id == ticket.id } ?: ticket,
                                    items = database.ticketItems(ticket.id),
                                )
                            )
                    }
                message = copy.intakeSavedLocally
                syncIntakeInBackground(ticket.id, ticket.currency)
            } catch (error: Exception) {
                message = error.userMessage(copy)
            } finally {
                busy = false
            }
        }
    }

    fun discardRejectedIntake(ticket: NativeServiceTicket, id: String) {
        if (busy) return
        busy = true
        scope.launch {
            try {
                withContext(Dispatchers.IO) {
                    val t =
                        database.snapshot().terminal
                            ?: throw NativePosValidationException(copy.localBranchNotFound)
                    database.intakeStore.discardRejected(t, id)
                }
                if (id == ticket.id) selectedTicketDetail = null
                reload(refreshCart = false)
                message = copy.intakeRejectedRemoved
            } catch (error: Exception) {
                message = error.userMessage(copy)
            } finally {
                busy = false
            }
        }
    }

    fun updateTicketInformation(ticket: NativeServiceTicket, payload: JSONObject) {
        if (busy || !internetAvailable) return
        busy = true
        scope.launch {
            try {
                val response =
                    withContext(Dispatchers.IO) {
                        api.patch("/pos/service-tickets/${ticket.id}", payload)
                    }
                database.snapshot().terminal?.let {
                    database.intakeStore.cache(it, "ticket", ticket.id, response)
                }
                refreshSelectedTicket(ticket.id, ticket.currency)
                message = copy.detailTicketSaved
            } catch (error: Exception) {
                message = error.userMessage(copy)
            } finally {
                busy = false
            }
        }
    }

    fun updateServiceTicketItem(
        ticket: NativeServiceTicket,
        item: NativeTicketItem,
        update: NativeTicketItemUpdate,
    ) {
        if (!internetAvailable) {
            message = copy.requiresNetwork
            return
        }
        scope.launch {
            busy = true
            try {
                withContext(Dispatchers.IO) {
                    api.patch("/pos/service-tickets/${ticket.id}/items/${item.id}", JSONObject().apply {
                        put("serviceId", update.service.id)
                        put("itemType", update.itemType)
                        update.chargedUnitAmountMinor?.let { put("chargedUnitAmount", java.math.BigDecimal(it).movePointLeft(2).toPlainString()); put("overrideReason", update.overrideReason) }
                        if (update.service.pricingUnit == "per_kg") {
                            put("weight", update.weight ?: throw NativePosValidationException(copy.weightRequired))
                            put("bagCount", update.bagCount ?: throw NativePosValidationException(copy.bagCountRequired))
                        } else {
                            put("quantity", update.quantity)
                        }
                        update.catalogItemId?.let { put("catalogItemId", it) }
                        put("itemCategory", update.itemCategory?.trim()?.takeIf(String::isNotBlank))
                        put("itemColor", update.itemColor?.trim()?.takeIf(String::isNotBlank))
                        put("itemBrand", update.itemBrand?.trim()?.takeIf(String::isNotBlank))
                        put("itemMaterial", update.itemMaterial?.trim()?.takeIf(String::isNotBlank))
                        put("defectNotes", update.defectNotes?.trim()?.takeIf(String::isNotBlank))
                        put("specialRequest", update.specialRequest?.trim()?.takeIf(String::isNotBlank))
                        put("remark", update.remark?.trim()?.takeIf(String::isNotBlank))
                    })
                }
                refreshSelectedTicket(ticket.id, ticket.currency)
                message = copy.itemUpdated
            } catch (error: Exception) {
                message = error.userMessage(copy)
            } finally {
                busy = false
            }
        }
    }

    fun deleteServiceTicketItem(ticket: NativeServiceTicket, item: NativeTicketItem, reason: String) {
        if (!internetAvailable) {
            message = copy.requiresNetwork
            return
        }
        if (reason.isBlank()) {
            message = copy.deleteReasonMissing
            return
        }
        scope.launch {
            busy = true
            try {
                withContext(Dispatchers.IO) {
                    val encodedReason = java.net.URLEncoder.encode(reason.trim(), Charsets.UTF_8.name())
                    api.delete("/pos/service-tickets/${ticket.id}/items/${item.id}?reason=$encodedReason")
                }
                refreshSelectedTicket(ticket.id, ticket.currency)
                message = copy.itemDeleted
            } catch (error: Exception) {
                message = error.userMessage(copy)
            } finally {
                busy = false
            }
        }
    }

    fun changeTicketItemStatus(ticket: NativeServiceTicket, item: NativeTicketItem, nextStatus: String) {
        if (!internetAvailable) {
            message = copy.requiresNetwork
            return
        }
        if (nextStatus !in TICKET_ITEM_STATUS_TRANSITIONS[item.itemStatus].orEmpty()) {
            message = copy.itemCannotTransition
            return
        }
        scope.launch {
            busy = true
            try {
                withContext(Dispatchers.IO) {
                    api.post("/pos/service-tickets/${ticket.id}/items/${item.id}/status-changes", JSONObject().put("to", nextStatus))
                }
                refreshSelectedTicket(ticket.id, ticket.currency)
                message = copy.itemStatusUpdated
            } catch (error: Exception) {
                message = error.userMessage(copy)
            } finally {
                busy = false
            }
        }
    }

    fun addTicketItemsToCart(ticket: NativeServiceTicket, items: List<NativeTicketItem>) {
        val terminal=database.snapshot().terminal ?: return
        val unsent=database.intakeStore.unsent(terminal,ticket.id)
        if(unsent.any { it.kind=="ticket" || items.any { item -> item.id==it.id } }) {
            message=copy.intakeSyncBeforeCheckout
            return
        }
        if (ticket.currency != cart.currency) {
            message = copy.ticketCurrencyMismatch
            return
        }
        val cartCustomer = cart.customer
        if (cartCustomer != null && cartCustomer.id != ticket.customerId) {
            message = copy.cartHasOtherCustomer
            return
        }
        val existingIds = cart.ticketItems.mapTo(mutableSetOf()) { it.ticketItemId }
        val additions = items.filter { it.id !in existingIds }.map { item ->
            NativeTicketCartLine(
                ticketId = ticket.id,
                ticketItemId = item.id,
                ticketCode = ticket.ticketNo ?: "TK-${ticket.id.takeLast(8).uppercase()}",
                serviceId = item.serviceId,
                name = item.itemName,
                pricingUnit = item.pricingUnit,
                quantity = item.quantity,
                weight = item.weight,
                bagCount = item.bagCount,
                unitAmountMinor = item.chargedUnitAmountMinor,
                lineAmountMinor = item.lineAmountMinor,
                currency = item.currency,
                customerId = ticket.customerId,
                customerName = ticket.customerName,
            )
        }
        if (additions.isEmpty()) {
            message = copy.ticketItemsAlreadyInCart
            return
        }
        updateCart(
            cart.copy(
                customer = NativeCartCustomer(ticket.customerId, ticket.customerName),
                ticketItems = cart.ticketItems + additions,
            ),
        )
        selectedTicketDetail = selectedTicketDetail?.let { detail ->
            detail.copy(
                cartTicketItemIds = detail.cartTicketItemIds + additions.mapTo(linkedSetOf()) { it.ticketItemId },
            )
        }
        activeTab = NativePosTab.Sale
        message = copy.addedTicketItemsToCart.format(additions.size)
    }

    fun changeTicketStatus(ticket: NativeServiceTicket, nextStatus: String, reason: String?) {
        if (!internetAvailable) {
            message = copy.requiresNetwork
            return
        }
        if (nextStatus !in TICKET_STATUS_TRANSITIONS[ticket.ticketStatus].orEmpty()) {
            message = copy.ticketCannotTransition
            return
        }
        if (nextStatus == "cancelled" && reason.isNullOrBlank()) {
            message = copy.cancelReasonMissing
            return
        }
        scope.launch {
            busy = true
            try {
                withContext(Dispatchers.IO) {
                    api.post("/pos/service-tickets/${ticket.id}/status-changes", JSONObject().apply {
                        put("to", nextStatus)
                        put("version", ticket.version)
                        if (nextStatus == "cancelled") put("reason", reason?.trim())
                    })
                }
                refreshSelectedTicket(ticket.id, ticket.currency)
                message = copy.ticketStatusUpdated.format(ticketStatusLabel(nextStatus, copy))
            } catch (error: Exception) {
                message = error.userMessage(copy)
            } finally {
                busy = false
            }
        }
    }

    // Lock an unattended till. The timeout is a terminal setting an
    // administrator configures; until now the app stored and displayed it but
    // never enforced it, so a cashier who walked away left the register open to
    // anyone. Also locks when the app leaves the foreground, which a phone or
    // tablet can do at any moment and a desktop browser cannot.
    if (unlocked) {
        val lockTimeoutSeconds = checkoutSettings.lockTimeoutSeconds
        val lifecycleOwner = LocalLifecycleOwner.current

        DisposableEffect(lifecycleOwner) {
            val observer = LifecycleEventObserver { _, event ->
                when (event) {
                    Lifecycle.Event.ON_RESUME -> NativePosActivityClock.mark()
                    Lifecycle.Event.ON_STOP -> unlocked = false
                    else -> Unit
                }
            }
            lifecycleOwner.lifecycle.addObserver(observer)
            onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
        }

        if (lockTimeoutSeconds > 0) {
            LaunchedEffect(lockTimeoutSeconds) {
                while (true) {
                    val now = System.currentTimeMillis()
                    val lastInteractionAt = NativePosActivityClock.lastInteractionAt
                    if (shouldLockForIdle(lockTimeoutSeconds, lastInteractionAt, now)) {
                        unlocked = false
                        break
                    }
                    // Sleep exactly the remaining budget rather than polling, so
                    // a busy till does no periodic work.
                    delay(idleLockDelayMs(lockTimeoutSeconds, lastInteractionAt, now))
                }
            }
        }
    }

    LaunchedEffect(physicalInternetAvailable, offlineModeEnabled) {
        withContext(Dispatchers.IO) { database.recoverInterruptedReceiptPrints() }
        reload()
        // WorkManager may defer a retained retry for a long time. A live POS
        // start must refresh its cached stock before the cashier can sell from
        // it; the background worker remains the recovery path after this.
        if (physicalInternetAvailable && !offlineModeEnabled && session.hasTerminalCredential()) {
            bootstrapIdentity = runCatching {
                withContext(Dispatchers.IO) {
                    val bootstrap = api.bootstrap()
                    val tenantName = bootstrap.optJSONObject("tenant")?.optString("name")?.trim().orEmpty()
                    if (tenantName.isBlank()) {
                        null
                    } else {
                        NativePosBootstrapIdentity(
                            tenantName = tenantName,
                            branchName = bootstrap.optJSONObject("branch")?.optString("name")?.trim()?.takeIf { it.isNotEmpty() },
                        )
                    }
                }
            }.getOrNull()
            runCatching {
                withContext(Dispatchers.IO) { NativePosSyncEngine(applicationContext).synchronize() }
            }.onSuccess {
                reload()
            }
        }
        NativePosSyncWorker.schedule(applicationContext)
    }

    val current = snapshot
    MaterialTheme(colorScheme = nativePosColors) {
        Column(
            Modifier
                .fillMaxSize()
                .background(if (current == null || current.terminal == null || !session.hasTerminalCredential() || !unlocked)
                    NATIVE_ENTRY_BACKGROUND else MaterialTheme.colorScheme.surface)
                .systemBarsPadding()
                .imePadding(),
        ) {
            when {
                current == null -> LoadingView(copy)
        current.terminal == null && session.hasTerminalCredential() && setupAdministrator == null -> StaffPinGate(
            language = pinLanguage,
            onLanguageSelected = ::selectLanguage,
            tenantName = bootstrapIdentity?.tenantName,
            branchName = bootstrapIdentity?.branchName,
            offlineAvailable = false,
            internetAvailable = internetAvailable,
            busy = busy,
                    message = message,
                    onPinEdited = { message = null },
                    onUnlockOffline = { },
                    onOnlineLogin = ::loginWithStaffPin,
                    checkoutSettings = checkoutSettings,
                )
                current.terminal == null -> {
                    if (setupAdministrator == null) {
                        FirstLaunchView(copy,
                            language = pinLanguage,
                            onLanguageSelected = ::selectLanguage,
                            apiConfigured = api.configured(),
                            busy = busy,
                            message = message,
                            onStart = { setupAdministrator = NativeAdministrator(emptyList()); message = null },
                        )
                    } else if (setupAdministrator!!.branches.isEmpty()) {
                        AdministratorLoginView(copy,
                            language = pinLanguage,
                            onLanguageSelected = ::selectLanguage,
                            internetAvailable = internetAvailable,
                            busy = busy,
                            message = message,
                            onSubmit = { identifier, password ->
                                scope.launch {
                                    busy = true
                                    try {
                                        val admin = withContext(Dispatchers.IO) {
                                            val auth = api.login(identifier, password).getJSONObject("authContext")
                                            val role = auth.optString("role")
                                            if (role != "owner" && role != "manager") {
                                                session.clearAdministratorSession()
                                                throw NativePosValidationException(copy.managerOnlyEnroll)
                                            }
                                            session.saveTenantDefaultLanguageCode(auth.optString("language"))
                                            val profile = api.get("/tenant/profile")
                                            val branches = profile.optJSONArray("accessibleBranches").toSetupBranches()
                                            if (branches.isEmpty()) throw NativePosValidationException(copy.noBranchesAvailable)
                                            val readiness = api.get("/tenant/overview").optJSONObject("checkoutReadiness")?.optJSONObject("taxReadiness")
                                            val bootstrap = api.bootstrap()
                                            NativeAdministrator(
                                                branches = branches,
                                                taxIssueCode = if (readiness?.optBoolean("ready") == true) null else readiness?.optString("code") ?: "POS_TAX_STATUS_UNAVAILABLE",
                                                requiresReenrollment = bootstrap.optString("status") == "credential_lost",
                                            )
                                        }
                                        setupAdministrator = admin
                                        pinLanguage = NativePinLanguage.fromCode(session.pinLanguageCode())
                                        message = null
                                    } catch (error: Exception) {
                                        message = error.administratorLoginMessage(copy)
                                    } finally {
                                        busy = false
                                    }
                                }
                            },
                        )
                    } else {
                        TerminalEnrollmentView(copy,
                            language = pinLanguage,
                            onLanguageSelected = ::selectLanguage,
                            branches = setupAdministrator!!.branches,
                            taxIssueCode = setupAdministrator!!.taxIssueCode,
                            requiresReenrollment = setupAdministrator!!.requiresReenrollment,
                            busy = busy,
                            message = message,
                            onEnroll = { branchId, label ->
                                scope.launch {
                                    busy = true
                                    try {
                                        withContext(Dispatchers.IO) {
                                            if (database.intakeStore.hasUnsentWork()) throw NativePosValidationException(copy.intakeRebindBlocked)
                                            if (setupAdministrator!!.requiresReenrollment) {
                                                api.post(
                                                    "/pos/auth/devices/${session.deviceId()}/revocation",
                                                    JSONObject().put("reason", "Administrator reinitialized this native POS terminal to select a branch"),
                                                )
                                            }
                                            api.post("/pos/auth/devices", JSONObject().apply {
                                                put("deviceId", session.deviceId())
                                                put("label", label.trim())
                                                put("branchId", branchId)
                                                put("deviceType", "tablet")
                                                put("platform", "android")
                                                put("platformVersion", android.os.Build.VERSION.RELEASE)
                                                put("appVersion", BuildConfig.VERSION_NAME)
                                            })
                                            session.clearAdministratorSession()
                                        }
                                        message = copy.terminalEnrolled
                                        setupAdministrator = null
                                        reload()
                                    } catch (error: Exception) {
                                        message = error.userMessage(copy)
                                    } finally {
                                        busy = false
                                    }
                                }
                            },
                        )
                    }
                }
                !session.hasTerminalCredential() -> TerminalCredentialRecoveryView(copy,
                    language = pinLanguage,
                    onLanguageSelected = ::selectLanguage,
                    internetAvailable = internetAvailable,
                    busy = busy,
                    message = message,
                    onRecover = { identifier, password ->
                        scope.launch {
                            busy = true
                            try {
                                withContext(Dispatchers.IO) {
                                    val auth = api.login(identifier, password).getJSONObject("authContext")
                                    val role = auth.optString("role")
                                    if (role != "owner" && role != "manager") {
                                        session.clearAdministratorSession()
                                        throw NativePosValidationException(copy.managerOnlyRecover)
                                    }
                                    session.saveTenantDefaultLanguageCode(auth.optString("language"))
                                    api.post("/pos/auth/devices/${session.deviceId()}/credential-rotation", JSONObject().put("reason", "Move this POS installation to the native Android app"))
                                    session.clearAdministratorSession()
                                }
                                pinLanguage = NativePinLanguage.fromCode(session.pinLanguageCode())
                                message = nativePosCopy(pinLanguage.code).terminalRecovered
                            } catch (error: Exception) {
                                message = error.administratorLoginMessage(copy)
                            } finally {
                                busy = false
                            }
                        }
                    },
                )
                !unlocked -> StaffPinGate(
                    language = pinLanguage,
                    onLanguageSelected = ::selectLanguage,
                    tenantName = current.terminal.merchantName,
                    merchant = current.terminal,
                    branchName = current.terminal.branchName,
                    offlineAvailable = session.canUnlockOffline(current.terminal.userId),
                    internetAvailable = internetAvailable,
                    busy = busy,
                    message = message,
                    onPinEdited = { message = null },
                    onUnlockOffline = { pin -> unlockWithOfflinePin(current.terminal.userId, pin) },
                    onOnlineLogin = ::loginWithStaffPin,
                    checkoutSettings = checkoutSettings,
                )
                !current.catalogIsFresh -> CachedDataExpiredView(copy, busy, message, ::synchronize)
                else -> NativePosShell(copy,
                    checkoutSettings = checkoutSettings,
                    activeMoreDestination = moreDestination,
                    onNavigateMore = ::openMoreDestination,
                    languageCode = pinLanguage.code,
            current = current,
            activeTab = activeTab,
            internetAvailable = internetAvailable,
            offlineModeEnabled = offlineModeEnabled,
            busy = busy,
                    message = message,
                    onSelectTab = { tab ->
                        activeTab = tab
                        if (tab == NativePosTab.More) moreDestination = NativeMoreDestination.Menu
                    },
                    onToggleOfflineMode = ::toggleOfflineMode,
                    onLock = { unlocked = false },
                    onSynchronize = ::synchronize,
                    onCreateCustomer = ::createCustomer,
                    onCreateServiceTicket = ::createServiceTicket,
                    onUpdateTicketInformation = ::updateTicketInformation,
                    onRetryIntake = { syncIntakeInBackground(it.id,it.currency,true) },
                    onViewOrder = ::openMoreOrder,
                    onDiscardIntake = ::discardRejectedIntake,
                    intakeCustomer = intakeCustomer,
                    onChangeTicketStatus = ::changeTicketStatus,
                    selectedTicketDetail = selectedTicketDetail,
                    onOpenTicket = ::openTicket,
                    onCloseTicket = { selectedTicketDetail = null },
                    onAddServiceTicketItem = ::addServiceTicketItem,
                    onUpdateServiceTicketItem = ::updateServiceTicketItem,
                    onDeleteServiceTicketItem = ::deleteServiceTicketItem,
                    onChangeTicketItemStatus = ::changeTicketItemStatus,
                    onAddTicketItemsToCart = ::addTicketItemsToCart,
                    saleContent = {
                        if (!internetAvailable && current.cashState?.isOfflineCashReady() != true) {
                            CashOperationsView(copy,
                                cashState = current.cashState,
                                internetAvailable = false,
                                busy = busy,
                                message = message,
                                onSynchronize = ::synchronize,
                            )
                        } else {
                            NativeSaleView(
                                current = current,
                                cart = cart,
                                copy = copy,
                                internetAvailable = internetAvailable,
                                busy = busy,
                                message = message,
                                checkoutSettings = checkoutSettings,
                                receiptPrinterConfigured = receiptPrinterConfigured,
                                onOpenSettings = { activeTab = NativePosTab.More; openMoreDestination(NativeMoreDestination.Settings) },
                                onSearchCustomers = { query ->
                                    withContext(Dispatchers.IO) {
                                        val encoded = java.net.URLEncoder.encode(query, "UTF-8")
                                        val data = api.get("/pos/customers?resultType=profile&status=active&limit=30&offset=0&q=$encoded").optJSONArray("data")
                                        buildList {
                                            for (index in 0 until (data?.length() ?: 0)) {
                                                val entry = data?.optJSONObject(index) ?: continue
                                                if (entry.optString("kind") == "profile") entry.optJSONObject("profile")?.toNativeMoreCustomer()?.let(::add)
                                            }
                                        }
                                    }
                                },
                                onSelectCustomer = { customer ->
                                    if (!busy && canChangeNativeCartCustomer(cart, customer)) {
                                        updateCart(cart.copy(customer = customer?.let { NativeCartCustomer(it.id, it.fullName) }))
                                    }
                                },
                                onRefreshPricing = { checkoutCart, discountCode, taxExemptionReason ->
                                    withContext(Dispatchers.IO) {
                                        if (internetAvailable) {
                                            previewNativeCartPricing(
                                                api = api,
                                                cart = checkoutCart,
                                                branchId = current.terminal.branchId,
                                                discountCode = discountCode,
                                                taxExemptionReason = taxExemptionReason,
                                            )
                                        } else {
                                            calculateNativeLocalPricing(checkoutCart, checkoutSettings, taxExemptionReason)
                                        }
                                    }
                                },
                                onAdd = { product ->
                                    val nextQuantity = (cart.products.firstOrNull { it.skuId == product.skuId }?.quantity ?: 0) + 1
                                    if (!internetAvailable && !canAddOffline(product, nextQuantity)) {
                                        message = copy.offlineStockShort.format(product.name)
                                    } else if (internetAvailable && !canAddOnline(product, nextQuantity)) {
                                        message = copy.stockShort.format(product.name)
                                    }
                                    else updateCart(cart.copy(products = cart.products.upsert(product, nextQuantity)))
                                },
                                onRemove = { product ->
                                    val existing = cart.products.firstOrNull { it.skuId == product.skuId } ?: return@NativeSaleView
                                    updateCart(
                                        cart.copy(products = if (existing.quantity == 1L) {
                                            cart.products.filterNot { it.skuId == product.skuId }
                                        } else {
                                            cart.products.upsert(product, existing.quantity - 1)
                                        }),
                                    )
                                },
                                onClearProduct = { skuId ->
                                    updateCart(cart.copy(products = cart.products.filterNot { it.skuId == skuId }))
                                },
                                onRemoveTicketItem = { ticketItemId ->
                                    updateCart(cart.copy(ticketItems = cart.ticketItems.filterNot { it.ticketItemId == ticketItemId }))
                                },
                                onCheckout = { checkoutRequest ->
                                    val cartAtCheckout = cart
                                    val terminalAtCheckout = current.terminal
                                    if (!checkoutSettings.taxReadyForCheckout()) {
                                        checkoutFailure = copy.taxReadinessMessage(checkoutSettings.taxCheckoutBlockCode())
                                        message = checkoutFailure
                                        return@NativeSaleView
                                    }
                                    if (checkoutRequest.paymentMethod == "cash" && checkoutRequest.tenderedMinor < checkoutRequest.expectedTotalMinor) {
                                        checkoutFailure = copy.tenderBelowTotal
                                        message = checkoutFailure
                                        return@NativeSaleView
                                    }
                                    if (checkoutRequest.paymentMethod != "cash" && !internetAvailable) {
                                        checkoutFailure = copy.requiresNetwork
                                        message = checkoutFailure
                                        return@NativeSaleView
                                    }
                                    // Set synchronously so a second tap cannot start another coroutine.
                                    if (busy) return@NativeSaleView
                                    busy = true
                                    checkoutFailure = null
                                    val checkoutGeneration = cartWriteGeneration.incrementAndGet()
                                    scope.launch {
                                        var savedCheckout: NativeCheckoutResult? = null
                                        try {
                                            val checkout = withContext(Dispatchers.IO) {
                                                val pricing = checkoutRequest.pricing ?: if (internetAvailable) {
                                                    previewNativeCartPricing(api, cartAtCheckout, terminalAtCheckout.branchId,
                                                        checkoutRequest.discountCode, checkoutRequest.taxExemptionReason)
                                                } else calculateNativeLocalPricing(cartAtCheckout, database.checkoutSettings(), checkoutRequest.taxExemptionReason)
                                                val expected = if (checkoutRequest.paymentMethod == "cash") {
                                                    applyNativeCashRounding(pricing.totalMinor, checkoutRequest.cashRoundingStep)
                                                } else pricing.totalMinor
                                                if (expected != checkoutRequest.expectedTotalMinor) throw NativePosValidationException(copy.priceChanged)
                                                cartWriteMutex.withLock {
                                                    database.enqueueCheckout(
                                                        cart = cartAtCheckout,
                                                        checkoutRequest = checkoutRequest,
                                                        reserveOfflineStock = !internetAvailable,
                                                        receiptPrintDraft = if (checkoutRequest.receiptDelivery == NativeReceiptDelivery.Print) {
                                                            buildNativeReceiptDraft(copy, terminalAtCheckout, cartAtCheckout, pricing,
                                                                checkoutRequest.expectedTotalMinor, checkoutRequest.tenderedMinor,
                                                                checkoutRequest.paymentMethod, checkoutRequest.externalReference,
                                                                checkoutRequest.balanceDueAt, checkoutRequest.taxExemptionReason,
                                                                database.receiptPrintSettings(), database.checkoutSettings().receiptProfile)
                                                        } else null,
                                                    )
                                                }
                                            }
                                            savedCheckout = checkout
                                            if (cartWriteGeneration.get() == checkoutGeneration) cart = NativePosCart.empty(cartAtCheckout.currency)
                                            val submission = if (internetAvailable) {
                                                withContext(Dispatchers.IO) { NativePosSyncEngine(applicationContext).submitCheckout(checkout.operationId) }
                                            } else NativeCheckoutSubmission("pending")
                                            val result = nativeSaleResult(checkout, checkoutRequest, cartAtCheckout, submission)
                                            // Only local reads remain on the critical path. Secondary work never holds the till button.
                                            reload()
                                            checkoutResult = result
                                            message = result.description(copy)
                                            busy = false
                                            NativePosSyncWorker.schedule(applicationContext)
                                            scope.launch {
                                                try {
                                                    if (checkout.printJobId != null && submission.order?.has("totalAmount") == true) {
                                                        withContext(Dispatchers.IO) {
                                                            database.updatePendingReceiptDraft(checkout.printJobId,
                                                                buildNativeReceiptDraft(copy, terminalAtCheckout, cartAtCheckout,
                                                                    submission.order.toNativeConfirmedPricing(),
                                                                    checkoutRequest.expectedTotalMinor, checkoutRequest.tenderedMinor,
                                                                    checkoutRequest.paymentMethod, checkoutRequest.externalReference,
                                                                    checkoutRequest.balanceDueAt, checkoutRequest.taxExemptionReason,
                                                                    database.receiptPrintSettings(), database.checkoutSettings().receiptProfile))
                                                        }
                                                    }
                                                    val hardwareMessage = runCatching {
                                                        val status = withContext(Dispatchers.IO) { hardware.status() }
                                                        hardwareStatus = status
                                                        if (checkoutRequest.paymentMethod == "cash" && submission.queueStatus != "failed" && status.cashDrawerConnected) {
                                                            withContext(Dispatchers.IO) { hardware.openCashDrawer().takeUnless { it.success }?.message }
                                                        } else null
                                                    }.getOrNull()
                                                    val printMessage = if (submission.queueStatus != "failed" && checkout.printJobId != null) {
                                                        runCatching { executeReceiptPrint(checkout.printJobId) }.getOrElse { it.userMessage(copy) }
                                                    } else null
                                                    if (internetAvailable && submission.queueStatus == null) {
                                                        withContext(Dispatchers.IO) {
                                                            runCatching {
                                                                api.post("/pos/orders/${checkout.orderId}/receipt-deliveries", JSONObject().apply {
                                                                    put("channel", checkoutRequest.receiptDelivery.wireValue)
                                                                    put("idempotencyKey", "receipt:${checkout.orderId}:${checkoutRequest.receiptDelivery.wireValue}:initial")
                                                                    if (checkoutRequest.receiptDelivery == NativeReceiptDelivery.Print) {
                                                                        val printed = checkout.printJobId?.let(database::receiptPrintStatus) == "printed"
                                                                        put("printStatus", if (printed) "sent" else "failed")
                                                                        if (!printed) put("failureReason", "The native receipt print job is queued or failed.")
                                                                    }
                                                                })
                                                            }
                                                        }
                                                    }
                                                    receiptPrintQueue = withContext(Dispatchers.IO) { database.receiptPrintQueueState() }
                                                    // Do not reload the cart here: the cashier may already be making the next sale.
                                                    if (checkoutResult?.orderId == checkout.orderId) {
                                                        checkoutResult = checkoutResult?.copy(followUpMessage = listOfNotNull(checkoutResult?.followUpMessage, hardwareMessage, printMessage).joinToString(" ").takeIf { it.isNotBlank() })
                                                    }
                                                } catch (error: Exception) {
                                                    if (error is kotlinx.coroutines.CancellationException) throw error
                                                    if (checkoutResult?.orderId == checkout.orderId) {
                                                        checkoutResult = checkoutResult?.copy(followUpMessage = error.userMessage(copy))
                                                    }
                                                }
                                            }
                                        } catch (error: Exception) {
                                            val saved = savedCheckout
                                            if (saved != null) {
                                                // The durable transaction already cleared this cart. Never invite a second charge.
                                                val status = withContext(Dispatchers.IO) { database.checkoutStatus(saved.operationId) }
                                                checkoutResult = nativeSaleResult(saved, checkoutRequest, cartAtCheckout, NativeCheckoutSubmission(status))
                                                message = checkoutResult?.description(copy)
                                                NativePosSyncWorker.schedule(applicationContext)
                                            } else {
                                                val failure = error.userMessage(copy)
                                                message = failure
                                                checkoutFailure = failure
                                            }
                                        } finally {
                                            busy = false
                                        }
                                    }
                                },
                                onSynchronize = ::synchronize,
                            )
                        }
                    },
                    moreContent = { overflowDestinations, onNavigateDestination ->
                        NativeMoreView(
                            copy,
                            current = current,
                            destination = moreDestination,
                            overflowDestinations = overflowDestinations,
                            onNavigateDestination = onNavigateDestination,
                            language = pinLanguage,
                            onSelectLanguage = ::selectLanguage,
                            onLock = { unlocked = false },
                            orders = moreOrders,
                            statistics = moreStatistics,
                            notifications = moreNotifications,
                            terminalSettings = terminalSettings,
                            terminalSettingsReady = terminalSettingsReady,
                            checkoutSettings = checkoutSettings,
                            hardwareStatus = hardwareStatus,
                            hardwareDevices = hardwareDevices,
                            bluetoothPrinters = bluetoothPrinters,
                            lastHardwareScan = lastHardwareScan,
                            receiptPrintQueue = receiptPrintQueue,
                            receiptPrintPreferences = receiptPrintPreferences,
                            canManageSensitiveHardware = current.terminal.role == "owner" || current.terminal.role == "manager",
                            internetAvailable = internetAvailable,
                            busy = busy,
                            message = message,
                            onNavigate = ::openMoreDestination,
                            onStartIntake = { activeTab = NativePosTab.Intake },
                            onStartIntakeForCustomer = { customer ->
                                intakeCustomer = customer
                                activeTab = NativePosTab.Intake
                            },
                            onStartSale = { activeTab = NativePosTab.Sale },
                            onAddProduct = ::addProductToSale,
                            onCreateCustomer = ::createCustomer,
                            onOpenTicket = { ticket ->
                                activeTab = NativePosTab.Tickets
                                openTicket(ticket)
                            },
                            searchResults = moreSearchResults,
                            onSearch = ::searchMore,
                            onOpenSearchResult = ::openMoreSearchResult,
                            onOpenOrder = ::openMoreOrder,
                            orderDetail = moreOrderDetail,
                            onRecordOrderCash = ::recordMoreOrderCash,
                            onResolveManualPayment = ::resolveMoreManualPayment,
                            onCreateRefund = ::createMoreRefund,
                            onResolveRefund = ::resolveMoreRefund,
                            onChangeOrderStatus = ::changeMoreOrderStatus,
                            onMarkNotificationRead = ::markNotificationRead,
                            onMarkAllNotificationsRead = ::markAllNotificationsRead,
                            onArchiveNotification = ::archiveNotification,
                            onSynchronize = ::synchronize,
                            onPerformShiftAction = ::performShiftAction,
                            onOpenRegister = ::openRegister,
                            shiftData = moreShiftData,
                            onCreateCashMovement = ::createCashMovement,
                            onCloseRegister = ::closeRegister,
                            onClockOut = ::clockOut,
                            onSaveTerminalSettings = ::saveTerminalSettings,
                            onRefreshHardware = ::refreshHardware,
                            onTestHardwarePrinter = ::testHardwarePrinter,
                            onTriggerHardwareScanner = ::triggerHardwareScanner,
                            onConnectBuiltInHardware = ::connectBuiltInHardware,
                            onRequestBluetoothPermissions = ::requestBluetoothPermissions,
                            onRefreshBluetoothPrinters = ::refreshBluetoothPrinters,
                            onBindBluetoothPrinter = ::bindBluetoothPrinter,
                            onOpenDrawerFromHardwareSettings = ::openDrawerFromHardwareSettings,
                            onPrintNextReceipt = ::printNextReceipt,
                            onRetryFailedReceipt = ::retryFailedReceipt,
                            statisticsPeriod = moreStatisticsPeriod,
                            onStatisticsPeriodChange = { period ->
                                moreStatisticsPeriod = period
                                openMoreDestination(NativeMoreDestination.Statistics)
                            },
                        )
                    },
                )
            }
            scannerSession?.let { currentSession ->
                NativeHardwareScannerSessionView(copy,
                    session = currentSession,
                    busy = busy,
                    onClose = ::closeHardwareScannerSession,
                )
            }
            checkoutResult?.let { result ->
                NativeSaleResultDialog(copy, result,
                    onDismiss = { checkoutResult = null },
                    onViewOrder = if (internetAvailable && result.state != NativeSaleState.Queued && result.state != NativeSaleState.NeedsReview) ({
                        checkoutResult = null
                        activeTab = NativePosTab.More
                        openMoreOrder(result.orderId)
                    }) else null,
                )
            }
            checkoutFailure?.let { failure ->
                NativeCashCheckoutFailureDialog(copy,
                    message = failure,
                    onDismiss = { checkoutFailure = null },
                )
            }
        }
    }
}

@Composable
private fun NativeCashCheckoutFailureDialog(copy: NativePosCopy, message: String, onDismiss: () -> Unit) {
    Dialog(onDismissRequest = onDismiss) {
        Surface(
            modifier = Modifier.fillMaxWidth().widthIn(max = 420.dp),
            shape = RoundedCornerShape(24.dp),
            color = POS_PAGE_BACKGROUND,
            shadowElevation = 12.dp,
        ) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Text(
                    copy.cashCheckoutFailedTitle,
                    color = POS_INK,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    copy.cartKeptAfterFailure,
                    color = POS_MUTED,
                    style = MaterialTheme.typography.bodyMedium,
                )
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFFFE9E7)),
                ) {
                    Text(
                        message,
                        modifier = Modifier.padding(14.dp),
                        color = Color(0xFFB3261E),
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
                Button(
                    onClick = onDismiss,
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = POS_ACCENT),
                ) {
                    Text(copy.gotIt)
                }
            }
        }
    }
}

@Composable
private fun NativeHardwareScannerSessionView(
    copy: NativePosCopy,
    session: NativeHardwareScannerSession,
    busy: Boolean,
    onClose: () -> Unit,
) {
    val scanning = session.value == null
    val isRegistration = session.purpose == NativeHardwareScannerPurpose.Registration
    Dialog(
        onDismissRequest = onClose,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Surface(
            modifier = Modifier.fillMaxWidth().fillMaxHeight(),
            color = Color(0xFF17141C),
        ) {
            Column(
                modifier = Modifier.fillMaxSize().systemBarsPadding().padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            if (isRegistration) copy.testAndRegisterScanner else copy.scanTest,
                            color = Color.White,
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            copy.useInfraredHead,
                            color = Color(0xFFBDB5C7),
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                    TextButton(onClick = onClose) {
                        Text(if (scanning) copy.cancel else copy.done, color = Color.White)
                    }
                }

                Spacer(Modifier.height(12.dp))
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(24.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF0E1E16)),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(300.dp)
                            .padding(20.dp)
                            .clip(RoundedCornerShape(18.dp))
                            .border(2.dp, Color(0xFF39D98A), RoundedCornerShape(18.dp)),
                        contentAlignment = Alignment.Center,
                    ) {
                        HorizontalDivider(
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
                            color = Color(0xFFE95565),
                            thickness = 2.dp,
                        )
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            Text("▣", color = Color(0xFF39D98A), style = MaterialTheme.typography.displayMedium)
                            Text(
                                if (scanning) copy.scanningContinuously else copy.readComplete,
                                color = Color.White,
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold,
                            )
                        }
                    }
                }

                if (scanning) {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF25212D)),
                    ) {
                        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(copy.infraredReady, color = Color(0xFF39D98A), fontWeight = FontWeight.SemiBold)
                            Text(
                                if (isRegistration) copy.scanAnyToRegister else copy.aimAnyBarcode,
                                color = Color(0xFFBDB5C7),
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                    }
                } else {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFE7F6EC)),
                    ) {
                        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(copy.barcodeRead, color = Color(0xFF16803A), fontWeight = FontWeight.SemiBold)
                            Text(session.value.orEmpty(), color = POS_INK, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                            session.status?.let { Text(it, color = POS_MUTED, style = MaterialTheme.typography.bodySmall) }
                        }
                    }
                }

                if (busy && !scanning) {
                    Text(copy.savingRegistration, color = Color(0xFFBDB5C7), style = MaterialTheme.typography.bodySmall)
                }
                Spacer(Modifier.weight(1f))
                Text(
                    copy.noOrdinaryCamera,
                    color = Color(0xFF81798D),
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun NativePosShell(
    copy: NativePosCopy,
    current: NativePosSnapshot,
    activeTab: NativePosTab,
    activeMoreDestination: NativeMoreDestination,
    onNavigateMore: (NativeMoreDestination) -> Unit,
    languageCode: String,
    internetAvailable: Boolean,
    offlineModeEnabled: Boolean,
    busy: Boolean,
    message: String?,
    onSelectTab: (NativePosTab) -> Unit,
    onToggleOfflineMode: () -> Unit,
    onLock: () -> Unit,
    onSynchronize: () -> Unit,
    onCreateCustomer: (String, String) -> Unit,
    onCreateServiceTicket: (NativeCustomer, String, String, String, String) -> Unit,
    intakeCustomer: NativeCustomer?,
    onChangeTicketStatus: (NativeServiceTicket, String, String?) -> Unit,
    selectedTicketDetail: NativeTicketDetail?,
    onOpenTicket: (NativeServiceTicket) -> Unit,
    onCloseTicket: () -> Unit,
    onAddServiceTicketItem: (NativeServiceTicket, NativeTicketItemDraft) -> Unit,
    onUpdateServiceTicketItem: (NativeServiceTicket, NativeTicketItem, NativeTicketItemUpdate) -> Unit,
    onDeleteServiceTicketItem: (NativeServiceTicket, NativeTicketItem, String) -> Unit,
    onChangeTicketItemStatus: (NativeServiceTicket, NativeTicketItem, String) -> Unit,
    onAddTicketItemsToCart: (NativeServiceTicket, List<NativeTicketItem>) -> Unit,
    saleContent: @Composable () -> Unit,
    moreContent: @Composable (List<NativeNavigationDestination>, (NativeNavigationDestination) -> Unit) -> Unit,
    checkoutSettings: NativeCheckoutSettings = NativeCheckoutSettings(),
    onUpdateTicketInformation: (NativeServiceTicket, JSONObject) -> Unit = { _, _ -> },
    onRetryIntake: (NativeServiceTicket) -> Unit = {},
    onViewOrder: (String) -> Unit = {},
    onDiscardIntake: (NativeServiceTicket,String) -> Unit = { _, _ -> },
) {
    val terminal = current.terminal ?: return
    val canManageSensitiveOperations = terminal.role == "owner" || terminal.role == "manager"
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val expanded = maxWidth >= 840.dp
        val showNavigationRail = maxWidth >= 600.dp
        val fontScale = LocalDensity.current.fontScale.coerceAtLeast(1f)
        val itemHeight = (if (expanded) 56f else 64f) + (if (expanded) 20f else 32f) * (fontScale - 1f)
        val navigation = nativeNavigationLayout(
            if (showNavigationRail) maxHeight.value else maxWidth.value,
            if (showNavigationRail) itemHeight else 76f * fontScale,
            if (showNavigationRail) 80f else 0f,
        )
        LaunchedEffect(navigation.overflow.isEmpty(), activeTab, activeMoreDestination, busy) {
            if (navigation.overflow.isEmpty() && activeTab == NativePosTab.More && activeMoreDestination == NativeMoreDestination.Menu && !busy) {
                onSelectTab(NativePosTab.Workspace)
            }
        }
        val selectedNavigation = when (activeTab) {
            NativePosTab.Workspace -> NativeNavigationDestination.Workspace
            NativePosTab.Sale -> NativeNavigationDestination.Sale
            NativePosTab.Intake -> NativeNavigationDestination.Intake
            NativePosTab.Tickets -> NativeNavigationDestination.Tickets
            NativePosTab.More -> when (activeMoreDestination) {
                NativeMoreDestination.OrderDetail -> NativeNavigationDestination.Orders
                NativeMoreDestination.Hardware -> NativeNavigationDestination.Settings
                NativeMoreDestination.Menu -> NativeNavigationDestination.More
                else -> NativeNavigationDestination.valueOf(activeMoreDestination.name)
            }
        }
        fun navigate(item: NativeNavigationDestination) {
            if (busy) return
            when (item) {
                NativeNavigationDestination.Workspace -> onSelectTab(NativePosTab.Workspace)
                NativeNavigationDestination.Sale -> onSelectTab(NativePosTab.Sale)
                NativeNavigationDestination.Intake -> onSelectTab(NativePosTab.Intake)
                NativeNavigationDestination.Tickets -> onSelectTab(NativePosTab.Tickets)
                NativeNavigationDestination.More -> onSelectTab(NativePosTab.More)
                else -> { onSelectTab(NativePosTab.More); onNavigateMore(NativeMoreDestination.valueOf(item.name)) }
            }
        }
        Row(Modifier.fillMaxSize().background(POS_PAGE_BACKGROUND)) {
            if (showNavigationRail && !(activeTab == NativePosTab.More && activeMoreDestination in listOf(NativeMoreDestination.Settings, NativeMoreDestination.Hardware))) {
                NativeAdaptiveNavigation(copy, terminal, navigation, selectedNavigation, true, expanded, itemHeight, ::navigate)
            }
            Column(Modifier.weight(1f).fillMaxHeight()) {
                TopAppBar(
                    title = {
                        Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
                            NativeMerchantBrand(terminal, compact = false, modifier = Modifier.fillMaxWidth())
                            Text(terminal.branchName, color = POS_MUTED, style = MaterialTheme.typography.labelSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    },
                    actions = {
                        OutlinedButton(
                            onClick = onToggleOfflineMode,
                            enabled = !busy,
                            modifier = Modifier.padding(end = 4.dp),
                        ) { Text(if (offlineModeEnabled) copy.restoreOnline else copy.offlineDrill) }
                        OutlinedButton(onClick = onLock, modifier = Modifier.padding(end = 8.dp)) { Text(copy.lock) }
                    },
                )
                Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                    when (activeTab) {
                        NativePosTab.Workspace -> NativeWorkspaceView(copy,
                            current = current,
                            internetAvailable = internetAvailable,
                            busy = busy,
                            message = message,
                            checkoutSettings = checkoutSettings,
                            onOpenSettings = { navigate(NativeNavigationDestination.Settings) },
                            onStartSale = { onSelectTab(NativePosTab.Sale) },
                            onSynchronize = onSynchronize,
                        )
                        NativePosTab.Sale -> saleContent()
                        NativePosTab.Intake -> NativeIntakeView(copy,
                            customers = current.customers,
                            tickets = current.tickets,
                            preselectedCustomer = intakeCustomer,
                            onViewOrder = onViewOrder,
                            internetAvailable = internetAvailable,
                            busy = busy,
                            message = message,
                            onCreateCustomer = onCreateCustomer,
                            onCreateTicket = onCreateServiceTicket,
                            onOpenTicket = { ticket ->
                                onSelectTab(NativePosTab.Tickets)
                                onOpenTicket(ticket)
                            },
                        )
                        NativePosTab.Tickets -> NativeTicketsView(copy,
                            tenantId = terminal.tenantId,
                            itemCatalog = current.itemCatalog,
                            customers = current.customers,
                            timeZone = terminal.timeZone,
                            language = languageCode,
                            onCreate = { onSelectTab(NativePosTab.Intake) },
                            onRefresh = onSynchronize,
                            tickets = current.tickets,
                            services = current.services,
                            selectedDetail = selectedTicketDetail,
                            internetAvailable = internetAvailable,
                            busy = busy,
                            message = message,
                            onOpenTicket = onOpenTicket,
                            onCloseTicket = onCloseTicket,
                            onChangeTicketStatus = onChangeTicketStatus,
                            onAddService = onAddServiceTicketItem,
                            onUpdateItem = onUpdateServiceTicketItem,
                            onDeleteItem = onDeleteServiceTicketItem,
                            canManageSensitiveOperations = canManageSensitiveOperations,
                            onChangeItemStatus = onChangeTicketItemStatus,
                            onAddTicketItemsToCart = onAddTicketItemsToCart,
                            onUpdateInformation = onUpdateTicketInformation,
                            onRetryIntake = onRetryIntake,
                            onDiscardIntake = onDiscardIntake,
                            onViewOrder = onViewOrder,
                        )
                        NativePosTab.More -> moreContent(navigation.overflow, ::navigate)
                    }
                }
                if (!showNavigationRail) {
                    NativeAdaptiveNavigation(copy, terminal, navigation, selectedNavigation, false, false, itemHeight, ::navigate)
                }
            }
        }
    }
}

@Composable
private fun NativeWorkspaceView(
    copy: NativePosCopy,
    current: NativePosSnapshot,
    internetAvailable: Boolean,
    busy: Boolean,
    message: String?,
    onStartSale: () -> Unit,
    onSynchronize: () -> Unit,
    checkoutSettings: NativeCheckoutSettings,
    onOpenSettings: () -> Unit,
) {
    val expanded = nativePosScreenClass() == NativePosScreenClass.Expanded
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text(copy.workspaceTitle, color = POS_INK, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Text(if (internetAvailable) copy.workspaceOnlineHint else copy.workspaceOfflineHint, color = POS_MUTED, style = MaterialTheme.typography.bodyMedium)
        NativeTaxReadinessNotice(copy, checkoutSettings, current.terminal?.role, busy, onSynchronize, onOpenSettings)
        if (expanded) {
            if (current.pendingIntakes > 0 || current.failedIntakes > 0) Text(copy.intakeQueueCount.format(current.pendingIntakes,current.failedIntakes), color=if(current.failedIntakes>0) POS_ERROR else POS_MUTED)
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                WorkspaceMetric(copy.metricCatalog, current.products.size.toString(), Modifier.weight(1f))
                WorkspaceMetric(copy.metricPendingOrders, current.pendingSales.toString(), Modifier.weight(1f))
                WorkspaceMetric(copy.metricFailedOrders, current.failedSales.toString(), Modifier.weight(1f), warning = current.failedSales > 0)
            }
        } else {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                WorkspaceMetric(copy.metricCatalog, current.products.size.toString(), Modifier.weight(1f))
                WorkspaceMetric(copy.metricPendingOrders, current.pendingSales.toString(), Modifier.weight(1f))
            }
            WorkspaceMetric(copy.metricFailedOrders, current.failedSales.toString(), Modifier.fillMaxWidth(), warning = current.failedSales > 0)
        }
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(18.dp),
            colors = CardDefaults.cardColors(containerColor = POS_PANEL_BACKGROUND),
        ) {
            Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(copy.cashSectionTitle, color = POS_INK, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text(
                    when {
                        current.cashState?.isOfflineCashReady() == true -> copy.cashReadyOffline
                        internetAvailable -> copy.cashCheckedOnline
                        else -> copy.cashNeedsSync
                    },
                    color = POS_MUTED,
                    style = MaterialTheme.typography.bodyMedium,
                )
                Button(
                    onClick = onStartSale,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = POS_ACCENT),
                ) { Text(copy.openTill) }
            }
        }
        OutlinedButton(onClick = onSynchronize, enabled = !busy, modifier = Modifier.fillMaxWidth()) { Text(if (busy) copy.synchronizing else copy.syncLocalData) }
        message?.let { Text(it, color = POS_MUTED, style = MaterialTheme.typography.bodySmall) }
    }
}

@Composable
private fun WorkspaceMetric(label: String, value: String, modifier: Modifier, warning: Boolean = false) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = POS_PANEL_BACKGROUND),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(label, color = POS_MUTED, style = MaterialTheme.typography.labelMedium)
            Text(
                value,
                color = if (warning) MaterialTheme.colorScheme.error else POS_INK,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

@Composable
private fun NativeIntakeView(
    copy: NativePosCopy,
    customers: List<NativeCustomer>,
    tickets: List<NativeServiceTicket>,
    preselectedCustomer: NativeCustomer?,
    internetAvailable: Boolean,
    busy: Boolean,
    message: String?,
    onCreateCustomer: (String, String) -> Unit,
    onCreateTicket: (NativeCustomer, String, String, String, String) -> Unit,
    onOpenTicket: (NativeServiceTicket) -> Unit,
    onViewOrder: (String) -> Unit,
) {
    var draftQuery by remember { mutableStateOf("") }
    var submittedQuery by remember { mutableStateOf("") }
    var selectedCustomer by remember { mutableStateOf<NativeCustomer?>(preselectedCustomer) }
    var customerDialogOpen by remember { mutableStateOf(false) }
    var ticketDialogOpen by remember { mutableStateOf(false) }
    LaunchedEffect(preselectedCustomer?.id) {
        preselectedCustomer?.let {
            selectedCustomer = it
            submittedQuery = ""
        }
    }
    val filteredCustomers = customers.filter {
        submittedQuery.isNotBlank() && (
            it.fullName.contains(submittedQuery, ignoreCase = true) ||
                it.accountName.contains(submittedQuery, ignoreCase = true) ||
                it.phone.orEmpty().contains(submittedQuery)
            )
    }.take(20)

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(copy.intakeTitle, color = POS_INK, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                Text(
                    if (internetAvailable) copy.intakeOnlineHint
                    else copy.intakeOfflineHint,
                    color = POS_MUTED,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            OutlinedButton(
                onClick = { customerDialogOpen = true },
                enabled = internetAvailable && !busy,
                shape = RoundedCornerShape(12.dp),
            ) { Text(copy.newCustomer) }
        }
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(18.dp),
            colors = CardDefaults.cardColors(containerColor = POS_PANEL_BACKGROUND),
        ) {
            Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(copy.lookupTitle, color = POS_INK, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text(copy.lookupHint, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    NativePosInput(
                        value = draftQuery,
                        onValueChange = { draftQuery = it },
                        label = { Text(copy.lookupLabel) },
                        placeholder = { Text(copy.lookupPlaceholder) },
                        singleLine = true,
                        enabled = !busy,
                        modifier = Modifier.weight(1f),
                    )
                    Button(
                        onClick = {
                            submittedQuery = draftQuery.trim()
                            selectedCustomer = null
                        },
                        enabled = !busy,
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = POS_ACCENT),
                    ) { Text(copy.search) }
                }
            }
        }

        selectedCustomer?.let { customer ->
            NativeCustomerDetailPanel(copy,customer,tickets,busy,internetAvailable,
                onChange={selectedCustomer=null},onNewTicket={ticketDialogOpen=true},onOpenTicket=onOpenTicket,
                onOpenOrder=onViewOrder,onUpdated={selectedCustomer=it})
        } ?: when {
            submittedQuery.isBlank() -> NativeIntakeEmptyState(
                title = copy.intakeEmptyTitle,
                description = copy.intakeEmptyDescription,
                actionLabel = copy.newCustomerShort,
                actionEnabled = internetAvailable && !busy,
                onAction = { customerDialogOpen = true },
            )
            filteredCustomers.isEmpty() -> NativeIntakeEmptyState(
                title = copy.intakeNoMatchTitle,
                description = copy.intakeNoMatchDescription.format(submittedQuery),
                actionLabel = copy.newCustomerShort,
                actionEnabled = internetAvailable && !busy,
                onAction = { customerDialogOpen = true },
            )
            else -> Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = POS_PANEL_BACKGROUND),
            ) {
                Column(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(horizontal = 16.dp, vertical = 14.dp)) {
                        Text(copy.matchingCustomers, color = POS_INK, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                        Text(copy.matchingCustomersCount.format(filteredCustomers.size), color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                    }
                    HorizontalDivider(color = Color(0xFFE9E5EE))
                    filteredCustomers.forEach { customer ->
                        NativeIntakeCustomerRow(copy, customer = customer, onClick = { selectedCustomer = customer })
                        HorizontalDivider(color = Color(0xFFF0EDF3))
                    }
                }
            }
        }
        message?.let { Text(it, color = POS_MUTED, style = MaterialTheme.typography.bodySmall) }
    }

    if (customerDialogOpen) {
        NativeCreateCustomerDialog(copy,
            busy = busy,
            onDismiss = { customerDialogOpen = false },
            onCreate = { name, phone ->
                customerDialogOpen = false
                draftQuery = name
                submittedQuery = name
                selectedCustomer = null
                onCreateCustomer(name, phone)
            },
        )
    }
    val ticketCustomer = selectedCustomer
    if (ticketDialogOpen && ticketCustomer != null) {
        NativeCreateTicketDialog(copy,
            customer = ticketCustomer,
            busy = busy,
            internetAvailable = internetAvailable,
            message = message,
            onDismiss = { ticketDialogOpen = false },
            onCreate = { type, priority, remark, pickupAt ->
                onCreateTicket(ticketCustomer, type, priority, remark, pickupAt)
            },
        )
    }
}

@Composable
private fun NativeIntakeEmptyState(
    title: String,
    description: String,
    actionLabel: String,
    actionEnabled: Boolean,
    onAction: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = POS_PANEL_BACKGROUND),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 34.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Box(
                modifier = Modifier.size(44.dp).clip(RoundedCornerShape(14.dp)).background(Color(0xFFF1EDF7)),
                contentAlignment = Alignment.Center,
            ) { Text("⌕", color = POS_ACCENT, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold) }
            Text(title, color = POS_INK, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text(description, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
            OutlinedButton(onClick = onAction, enabled = actionEnabled, shape = RoundedCornerShape(12.dp)) { Text("＋ $actionLabel") }
        }
    }
}

@Composable
private fun NativeIntakeCustomerRow(copy: NativePosCopy, customer: NativeCustomer, onClick: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 13.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(POS_INK),
            contentAlignment = Alignment.Center,
        ) { Text(customer.fullName.trim().take(1).uppercase(), color = Color.White, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold) }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(customer.fullName, color = POS_INK, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
            Text(customer.accountName, color = POS_MUTED, style = MaterialTheme.typography.labelSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(customer.phone ?: copy.noPhoneOnFile, color = POS_MUTED, style = MaterialTheme.typography.labelSmall)
        }
        Text(copy.select, color = POS_ACCENT, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold)
    }
}

/** The selected customer's operational history stays on the intake page so a
 * clerk can see the latest handling state before adding another order. */
@Composable
private fun NativeIntakeRecentTicketRow(copy: NativePosCopy, ticket: NativeServiceTicket, onOpen: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Color(0xFFF9F7FC))
            .clickable(onClick = onOpen)
            .padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(
                ticket.ticketNo ?: copy.serviceOrder,
                color = POS_INK,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                "${ticketStatusLabel(ticket.ticketStatus, copy)} · ${copy.itemsCountSuffix.format(ticket.itemCount)} · ${formatNativeActivityTime(ticket.updatedAt.ifBlank { ticket.createdAt })}",
                color = POS_MUTED,
                style = MaterialTheme.typography.labelSmall,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            ticket.expectedPickupAt?.let { pickupAt ->
                Text(copy.expectedPickup.format(formatNativeActivityTime(pickupAt)), color = POS_MUTED, style = MaterialTheme.typography.labelSmall)
            }
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(formatMoney(ticket.totalMinor, ticket.currency), color = POS_INK, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.SemiBold)
            Text(copy.continueProcessing, color = POS_ACCENT, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun NativeCreateCustomerDialog(
    copy: NativePosCopy,
    busy: Boolean,
    onDismiss: () -> Unit,
    onCreate: (String, String) -> Unit,
) {
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    Dialog(onDismissRequest = { if (!busy) onDismiss() }) {
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(24.dp),
            color = POS_PAGE_BACKGROUND,
            shadowElevation = 12.dp,
        ) {
            Column(
                modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text(copy.newCustomerTitle, color = POS_INK, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                        Text(copy.newCustomerHint, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                    }
                    TextButton(onClick = onDismiss, enabled = !busy) { Text(copy.back) }
                }
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(18.dp),
                    colors = CardDefaults.cardColors(containerColor = POS_PANEL_BACKGROUND),
                ) {
                    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text(copy.customerInfo, color = POS_INK, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        NativePosInput(value = name, onValueChange = { name = it }, label = { Text(copy.customerName) }, placeholder = { Text(copy.customerNamePlaceholder) }, singleLine = true, modifier = Modifier.fillMaxWidth())
                        NativePosInput(value = phone, onValueChange = { phone = it }, label = { Text(copy.phoneNumber) }, placeholder = { Text(copy.phonePlaceholder) }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    }
                }
                Button(
                    onClick = { onCreate(name.trim(), phone.trim()) },
                    enabled = !busy && name.isNotBlank() && phone.isNotBlank(),
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = POS_ACCENT),
                ) { Text(if (busy) copy.saving else copy.saveCustomer) }
            }
        }
    }
}

@Composable
internal fun NativeCreateTicketDialog(
    copy: NativePosCopy,
    customer: NativeCustomer,
    busy: Boolean,
    internetAvailable: Boolean,
    message: String? = null,
    onDismiss: () -> Unit,
    onCreate: (String, String, String, String) -> Unit,
) {
    var ticketType by remember(customer.id) { mutableStateOf("laundry") }
    var priority by remember(customer.id) { mutableStateOf("normal") }
    var expectedPickupText by remember(customer.id) { mutableStateOf("") }
    var remark by remember(customer.id) { mutableStateOf("") }
    Dialog(onDismissRequest = { if (!busy) onDismiss() }) {
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(24.dp),
            color = POS_PAGE_BACKGROUND,
            shadowElevation = 12.dp,
        ) {
            Column(
                modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text(copy.newTicketTitle, color = POS_INK, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                        Text(copy.newTicketHint, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                    }
                    TextButton(onClick = onDismiss, enabled = !busy) { Text(copy.back) }
                }
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(18.dp),
                    colors = CardDefaults.cardColors(containerColor = POS_PANEL_BACKGROUND),
                ) {
                    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(copy.ticketCustomer, color = POS_MUTED, style = MaterialTheme.typography.labelSmall)
                        Text(customer.fullName, color = POS_INK, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Text(customer.phone ?: customer.accountName, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                    }
                }
                Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
                    Text(copy.ticketType, color = POS_INK, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        NativeIntakeChoiceButton(copy.typeLaundry, ticketType == "laundry", !busy, { ticketType = "laundry" }, Modifier.weight(1f))
                        NativeIntakeChoiceButton(copy.typeCarWash, ticketType == "car_wash", !busy, { ticketType = "car_wash" }, Modifier.weight(1f))
                    }
                }
                Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
                    Text(copy.priorityTitle, color = POS_INK, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        NativeIntakeChoiceButton(copy.priorityNormal, priority == "normal", !busy, { priority = "normal" }, Modifier.weight(1f))
                        NativeIntakeChoiceButton(copy.priorityUrgent, priority == "urgent", !busy, { priority = "urgent" }, Modifier.weight(1f))
                        NativeIntakeChoiceButton(copy.priorityCritical, priority == "critical", !busy, { priority = "critical" }, Modifier.weight(1f))
                    }
                }
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(18.dp),
                    colors = CardDefaults.cardColors(containerColor = POS_PANEL_BACKGROUND),
                ) {
                    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        NativePosInput(value = expectedPickupText, onValueChange = { expectedPickupText = it }, label = { Text(copy.expectedPickupField) }, placeholder = { Text(copy.detailPickupHint) }, singleLine = true, enabled = !busy, modifier = Modifier.fillMaxWidth())
                        NativePosInput(value = remark, onValueChange = { remark = it.take(2000) }, label = { Text(copy.remarkOptional) }, placeholder = { Text(copy.remarkPlaceholder) }, enabled = !busy, modifier = Modifier.fillMaxWidth())
                    }
                }
                if (!internetAvailable) Text(copy.intakeOfflineHint, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                message?.let { Text(it,color=MaterialTheme.colorScheme.error,style=MaterialTheme.typography.bodySmall) }
                Button(
                    onClick = { onCreate(ticketType, priority, remark.trim(), expectedPickupText.trim()) },
                    enabled = !busy,
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = POS_ACCENT),
                ) { NativeBusyLabel(busy,copy.intakeSaving,copy.createTicket) }
            }
        }
    }
}

@Composable
private fun NativeIntakeChoiceButton(
    label: String,
    selected: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.height(46.dp),
        shape = RoundedCornerShape(12.dp),
        colors = if (selected) ButtonDefaults.buttonColors(containerColor = POS_ACCENT) else ButtonDefaults.buttonColors(containerColor = POS_PANEL_BACKGROUND, contentColor = POS_INK),
    ) { Text(label, maxLines = 1, overflow = TextOverflow.Ellipsis) }
}

@Composable
private fun ReferenceRow(copy: NativePosCopy, primary: String, secondary: String, selected: Boolean, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(if (selected) Color(0xFFECE6F7) else Color(0xFFF8F7FB))
            .clickable(onClick = onClick)
            .padding(12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(primary, color = POS_INK, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
            Text(secondary, color = POS_MUTED, style = MaterialTheme.typography.labelSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Text(copy.select, color = POS_ACCENT, style = MaterialTheme.typography.labelMedium)
    }
}

@Composable
private fun SelectedReferenceCard(copy: NativePosCopy, label: String, primary: String, secondary: String, onClear: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color(0xFFECE6F7)).padding(12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(label, color = POS_ACCENT, style = MaterialTheme.typography.labelSmall)
            Text(primary, color = POS_INK, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
            Text(secondary, color = POS_MUTED, style = MaterialTheme.typography.labelSmall)
        }
        OutlinedButton(onClick = onClear) { Text(copy.change) }
    }
}

@Composable
private fun NativeTicketsView(
    copy: NativePosCopy,
    tickets: List<NativeServiceTicket>,
    customers: List<NativeCustomer>,
    timeZone: String,
    language: String,
    onCreate: () -> Unit,
    onRefresh: () -> Unit,
    services: List<NativeService>,
    selectedDetail: NativeTicketDetail?,
    internetAvailable: Boolean,
    busy: Boolean,
    message: String?,
    onOpenTicket: (NativeServiceTicket) -> Unit,
    onCloseTicket: () -> Unit,
    onChangeTicketStatus: (NativeServiceTicket, String, String?) -> Unit,
    onAddService: (NativeServiceTicket, NativeTicketItemDraft) -> Unit,
    onUpdateItem: (NativeServiceTicket, NativeTicketItem, NativeTicketItemUpdate) -> Unit,
    onDeleteItem: (NativeServiceTicket, NativeTicketItem, String) -> Unit,
    canManageSensitiveOperations: Boolean,
    onChangeItemStatus: (NativeServiceTicket, NativeTicketItem, String) -> Unit,
    onAddTicketItemsToCart: (NativeServiceTicket, List<NativeTicketItem>) -> Unit,
    onUpdateInformation: (NativeServiceTicket, JSONObject) -> Unit,
    onRetryIntake: (NativeServiceTicket) -> Unit,
    onViewOrder: (String) -> Unit,
    onDiscardIntake: (NativeServiceTicket,String) -> Unit,
    tenantId: String,
    itemCatalog: NativeItemCatalog?,
) {
    if (selectedDetail != null) {
        NativeTicketDetailView(copy,
            tenantId = tenantId,
            itemCatalog = itemCatalog,
            detail = selectedDetail,
            services = services,
            internetAvailable = internetAvailable,
            busy = busy,
            message = message,
            onBack = onCloseTicket,
            onChangeTicketStatus = { target, reason -> onChangeTicketStatus(selectedDetail.ticket, target, reason) },
            onAddService = { draft -> onAddService(selectedDetail.ticket, draft) },
            onUpdateItem = { item, update -> onUpdateItem(selectedDetail.ticket, item, update) },
            onDeleteItem = { item, reason -> onDeleteItem(selectedDetail.ticket, item, reason) },
            canManageSensitiveOperations = canManageSensitiveOperations,
            onChangeItemStatus = { item, target -> onChangeItemStatus(selectedDetail.ticket, item, target) },
            onAddToCart = { items -> onAddTicketItemsToCart(selectedDetail.ticket, items) },
            onUpdateInformation = { onUpdateInformation(selectedDetail.ticket,it) },
            onRetryIntake = { onRetryIntake(selectedDetail.ticket) },
            onDiscardIntake = { onDiscardIntake(selectedDetail.ticket,it) },
            onViewOrder = onViewOrder,
            timeZone = timeZone,
        )
        return
    }
    NativeTicketList(copy, tickets, customers, timeZone, language, busy, internetAvailable, message, onOpenTicket, onCreate, onRefresh)
}

internal fun ticketStatusLabel(status: String, copy: NativePosCopy): String = when (status) {
    "draft" -> copy.ticketDraft
    "pending" -> copy.ticketPending
    "in_progress" -> copy.ticketInProgress
    "ready_to_pick" -> copy.ticketReadyToPick
    "picked_up" -> copy.ticketPickedUp
    "cancelled" -> copy.ticketCancelled
    "exception" -> copy.ticketException
    else -> copy.ticketUnknown
}

internal fun ticketItemStatusLabel(status: String, copy: NativePosCopy): String = when (status) {
    "pending_wash" -> copy.itemPendingWash
    "washing" -> copy.itemWashing
    "done" -> copy.itemDone
    "ready_to_pick" -> copy.itemReadyToPick
    "exception" -> copy.ticketException
    else -> copy.ticketUnknown
}

internal fun ticketItemTypeLabel(type: String, copy: NativePosCopy): String = when (type) {
    "cloth" -> copy.typeCloth
    "car" -> copy.typeCar
    "shoe" -> copy.typeShoe
    "carpet" -> copy.typeCarpet
    else -> type
}

internal fun NativeServiceTicket.priorityLabel(copy: NativePosCopy): String = when (priority) {
    "critical" -> copy.priorityCritical
    "urgent" -> copy.priorityUrgent
    else -> copy.priorityNormal
}

@Composable
private fun NativeMoreView(
    copy: NativePosCopy,
    current: NativePosSnapshot,
    destination: NativeMoreDestination,
    overflowDestinations: List<NativeNavigationDestination>,
    onNavigateDestination: (NativeNavigationDestination) -> Unit,
    language: NativePinLanguage,
    onSelectLanguage: (NativePinLanguage) -> Unit,
    onLock: () -> Unit,
    orders: List<NativeMoreOrder>,
    statistics: NativeMoreStatistics?,
    notifications: List<NativeMoreNotification>,
    terminalSettings: NativeTerminalSettingsSummary?,
    terminalSettingsReady: Boolean,
    checkoutSettings: NativeCheckoutSettings,
    hardwareStatus: NativeHardwareStatus?,
    hardwareDevices: List<NativeHardwareDevice>,
    bluetoothPrinters: List<NativeBluetoothPrinter>,
    lastHardwareScan: NativeHardwareScan?,
    receiptPrintQueue: NativeReceiptPrintQueueState,
    receiptPrintPreferences: NativeReceiptPrintSettings,
    canManageSensitiveHardware: Boolean,
    internetAvailable: Boolean,
    busy: Boolean,
    message: String?,
    onNavigate: (NativeMoreDestination) -> Unit,
    onStartIntake: () -> Unit,
    onStartIntakeForCustomer: (NativeCustomer) -> Unit,
    onStartSale: () -> Unit,
    onAddProduct: (NativeProduct) -> Unit,
    onCreateCustomer: (String, String) -> Unit,
    onOpenTicket: (NativeServiceTicket) -> Unit,
    searchResults: List<NativeMoreSearchResult>,
    onSearch: (String) -> Unit,
    onOpenSearchResult: (NativeMoreSearchResult) -> Unit,
    onOpenOrder: (String) -> Unit,
    orderDetail: NativeMoreOrderDetail?,
    onRecordOrderCash: (NativeMoreOrderDetail, String) -> Unit,
    onResolveManualPayment: (NativeMoreOrderDetail, NativeMorePayment, Boolean, String) -> Unit,
    onCreateRefund: (NativeMoreOrderDetail, NativeMorePayment, String, String) -> Unit,
    onResolveRefund: (NativeMoreOrderDetail, NativeMorePaymentAdjustment, Boolean, String, String) -> Unit,
    onChangeOrderStatus: (NativeMoreOrderDetail, String) -> Unit,
    onMarkNotificationRead: (String) -> Unit,
    onMarkAllNotificationsRead: () -> Unit,
    onArchiveNotification: (String) -> Unit,
    onSynchronize: () -> Unit,
    onPerformShiftAction: (String) -> Unit,
    onOpenRegister: (String) -> Unit,
    shiftData: NativeMoreShiftData?,
    onCreateCashMovement: (String, String, String) -> Unit,
    onCloseRegister: (String, String) -> Unit,
    onClockOut: () -> Unit,
    onSaveTerminalSettings: (NativeTerminalSettingsPatch) -> Unit,
    onRefreshHardware: () -> Unit,
    onTestHardwarePrinter: () -> Unit,
    onTriggerHardwareScanner: () -> Unit,
    onConnectBuiltInHardware: (String) -> Unit,
    onRequestBluetoothPermissions: () -> Unit,
    onRefreshBluetoothPrinters: () -> Unit,
    onBindBluetoothPrinter: (NativeHardwareDevice, NativeBluetoothPrinter) -> Unit,
    onOpenDrawerFromHardwareSettings: () -> Unit,
    onPrintNextReceipt: () -> Unit,
    onRetryFailedReceipt: () -> Unit,
    statisticsPeriod: String,
    onStatisticsPeriodChange: (String) -> Unit,
) {
    fun backToMenu() {
        if (overflowDestinations.isEmpty()) onNavigateDestination(NativeNavigationDestination.Workspace)
        else onNavigate(NativeMoreDestination.Menu)
    }
    when (destination) {
        NativeMoreDestination.Menu -> NativeMoreMenuView(copy,
            current = current,
            busy = busy,
            message = message,
            destinations = overflowDestinations,
            onNavigate = onNavigateDestination,
        )
        NativeMoreDestination.Customers -> NativeMoreCustomersView(copy,
            customers = current.customers,
            busy = busy,
            message = message,
            onBack = ::backToMenu,
            onStartIntake = onStartIntake,
            onStartIntakeForCustomer = onStartIntakeForCustomer,
            onCreateCustomer = onCreateCustomer,
        )
        NativeMoreDestination.Catalog -> NativeMoreCatalogView(copy,
            products = current.products,
            services = current.services,
            internetAvailable = internetAvailable,
            busy = busy,
            message = message,
            onBack = ::backToMenu,
            onStartSale = onStartSale,
            onAddProduct = onAddProduct,
        )
        NativeMoreDestination.Scan -> NativeMoreScanView(copy,
            current = current,
            busy = busy,
            message = message,
            hardwareScan = lastHardwareScan,
            onBack = ::backToMenu,
            onOpenTicket = onOpenTicket,
            onStartIntakeForCustomer = onStartIntakeForCustomer,
            onAddProduct = onAddProduct,
            searchResults = searchResults,
            onSearch = onSearch,
            onOpenSearchResult = onOpenSearchResult,
            onTriggerHardwareScanner = onTriggerHardwareScanner,
        )
        NativeMoreDestination.Orders -> NativeMoreOrdersView(copy,
            orders = orders,
            busy = busy,
            message = message,
            onBack = ::backToMenu,
            onRefresh = { onNavigate(NativeMoreDestination.Orders) },
            onOpenOrder = onOpenOrder,
        )
        NativeMoreDestination.OrderDetail -> NativeMoreOrderDetailView(copy,
            order = orderDetail,
            timeZone = current.terminal?.timeZone ?: "UTC",
            canResolveManualPayments = current.terminal?.role in setOf("owner", "manager"),
            internetAvailable = internetAvailable,
            busy = busy,
            message = message,
            onBack = { onNavigate(NativeMoreDestination.Orders) },
            onRefresh = { orderDetail?.let { onOpenOrder(it.id) } },
            onRecordCash = onRecordOrderCash,
            onResolveManualPayment = onResolveManualPayment,
            onCreateRefund = onCreateRefund,
            onResolveRefund = onResolveRefund,
            onChangeStatus = onChangeOrderStatus,
        )
        NativeMoreDestination.Statistics -> NativeMoreStatisticsView(copy,
            statistics = statistics,
            busy = busy,
            message = message,
            onBack = ::backToMenu,
            onRefresh = { onNavigate(NativeMoreDestination.Statistics) },
            period = statisticsPeriod,
            onPeriodChange = onStatisticsPeriodChange,
        )
        NativeMoreDestination.Notifications -> NativeMoreNotificationsView(copy,
            notifications = notifications,
            internetAvailable = internetAvailable,
            busy = busy,
            message = message,
            onBack = ::backToMenu,
            onRefresh = { onNavigate(NativeMoreDestination.Notifications) },
            onMarkRead = onMarkNotificationRead,
            onMarkAllRead = onMarkAllNotificationsRead,
            onArchive = onArchiveNotification,
            onOpenRelated = { notification ->
                when (notification.relatedType) {
                    "order" -> notification.relatedId?.let(onOpenOrder)
                    "ticket" -> notification.relatedId
                        ?.let { id -> current.tickets.firstOrNull { it.id == id } }
                        ?.let(onOpenTicket)
                    else -> Unit
                }
            },
        )
        NativeMoreDestination.Shift -> NativeShiftHandoverView(copy,
            current = current,
            busy = busy,
            message = message,
            onBack = ::backToMenu,
            onRefresh = { onNavigate(NativeMoreDestination.Shift) },
            onSynchronize = onSynchronize,
            shiftData = shiftData,
            internetAvailable = internetAvailable,
            onPerformShiftAction = onPerformShiftAction,
            onOpenRegister = onOpenRegister,
            onCreateCashMovement = onCreateCashMovement,
            onCloseRegister = onCloseRegister,
            onClockOut = onClockOut,
        )
        NativeMoreDestination.Settings -> NativeSettingsWorkspace(copy,
            current = current,
            receiptPrintQueue = receiptPrintQueue,
            receiptPrintSettings = receiptPrintPreferences,
            language = language,
            internetAvailable = internetAvailable,
            onSelectLanguage = onSelectLanguage,
            onSynchronize = onSynchronize,
            onLock = onLock,
            onTestPrinter = onTestHardwarePrinter,
            onPrintNextReceipt = onPrintNextReceipt,
            onRetryFailedReceipt = onRetryFailedReceipt,
            backLabel = if (overflowDestinations.isEmpty()) copy.tabWorkspace else copy.backToMore,
            settings = terminalSettings,
            settingsReady = terminalSettingsReady,
            checkoutSettings = checkoutSettings,
            busy = busy,
            message = message,
            onBack = ::backToMenu,
            onRefresh = { onNavigate(NativeMoreDestination.Settings) },
            onSave = onSaveTerminalSettings,
            onOpenHardware = { onNavigate(NativeMoreDestination.Hardware) },
        )
        NativeMoreDestination.Hardware -> NativeMoreHardwareView(copy,
            hardwareStatus = hardwareStatus,
            configuredDevices = hardwareDevices,
            bluetoothPrinters = bluetoothPrinters,
            receiptPrintQueue = receiptPrintQueue,
            canManageSensitiveHardware = canManageSensitiveHardware,
            internetAvailable = internetAvailable,
            busy = busy,
            message = message,
            onBack = { onNavigate(NativeMoreDestination.Settings) },
            onRefresh = onRefreshHardware,
            onTestPrinter = onTestHardwarePrinter,
            onTriggerScanner = onTriggerHardwareScanner,
            onConnectBuiltIn = onConnectBuiltInHardware,
            onRequestBluetoothPermissions = onRequestBluetoothPermissions,
            onRefreshBluetoothPrinters = onRefreshBluetoothPrinters,
            onBindBluetoothPrinter = onBindBluetoothPrinter,
            onOpenDrawer = onOpenDrawerFromHardwareSettings,
            onPrintNextReceipt = onPrintNextReceipt,
        )
    }
}

@Composable
private fun NativeShiftHandoverView(
    copy: NativePosCopy,
    current: NativePosSnapshot,
    shiftData: NativeMoreShiftData?,
    internetAvailable: Boolean,
    busy: Boolean,
    message: String?,
    onBack: () -> Unit,
    onRefresh: () -> Unit,
    onSynchronize: () -> Unit,
    onPerformShiftAction: (String) -> Unit,
    onOpenRegister: (String) -> Unit,
    onCreateCashMovement: (String, String, String) -> Unit,
    onCloseRegister: (String, String) -> Unit,
    onClockOut: () -> Unit,
) {
    var countedCash by remember { mutableStateOf("") }
    var closeNotes by remember { mutableStateOf("") }
    var closeConfirmationVisible by remember { mutableStateOf(false) }
    var clockOutConfirmationVisible by remember { mutableStateOf(false) }
    var openingFloat by remember { mutableStateOf("") }
    var movementAmount by remember { mutableStateOf("") }
    var movementReason by remember { mutableStateOf("") }
    var localFeedback by remember { mutableStateOf<String?>(null) }
    val context = LocalContext.current
    var pendingReportCsv by remember { mutableStateOf<String?>(null) }
    val createReportDocument = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri ->
        if (uri != null) {
            val csv = pendingReportCsv
            localFeedback = if (csv != null && runCatching {
                context.contentResolver.openOutputStream(uri)?.use { stream ->
                    stream.write(csv.toByteArray(Charsets.UTF_8))
                } ?: error("Cannot open report destination")
            }.isSuccess) copy.zReportSaved else copy.zReportExportFailed
        }
        pendingReportCsv = null
    }
    var runningAction by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(busy) {
        if (!busy) runningAction = null
    }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = onBack, enabled = !busy, modifier = Modifier.weight(1f)) { Text(copy.backToMore) }
            OutlinedButton(onClick = onRefresh, enabled = internetAvailable && !busy, modifier = Modifier.weight(1f)) {
                Text(if (busy) copy.refreshing else copy.refreshStatus)
            }
        }
        Text(copy.shiftTitle, color = POS_INK, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Text(copy.shiftIntro, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)

        if (!internetAvailable) {
            NativeShiftFeedback(copy.shiftOfflineNotice)
        }
        (localFeedback ?: message)?.let { feedback ->
            NativeShiftFeedback(feedback)
        }

        val data = shiftData
        if (data == null) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = POS_PANEL_BACKGROUND),
            ) {
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(copy.shiftLoading, color = POS_INK, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text(copy.shiftLoadFailed, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                    OutlinedButton(onClick = onRefresh, enabled = internetAvailable && !busy, modifier = Modifier.fillMaxWidth()) { Text(copy.reload) }
                }
            }
        } else {
            val status = data.shiftStatus
            val trackedCash = data.cashHandlingMode == "shared_drawer" || data.cashHandlingMode == "cash_in_hand"
            val personalCash = data.cashHandlingMode == "cash_in_hand"
            val canFinalizeRegister = current.terminal?.role == "owner" || current.terminal?.role == "manager"
            val canCloseCurrentSession = data.registerOpen && (!personalCash || data.cashSessionOpen || canFinalizeRegister)

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = POS_PANEL_BACKGROUND),
            ) {
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(copy.staffShift, color = POS_INK, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text(
                        when (status) {
                            "open" -> copy.shiftOpen
                            "on_break" -> copy.shiftOnBreak
                            else -> copy.shiftClosed
                        },
                        color = POS_MUTED,
                        style = MaterialTheme.typography.bodySmall,
                    )
                    when (status) {
                        null, "" -> Button(
                            onClick = {
                                localFeedback = null
                                runningAction = "clock_in"
                                onPerformShiftAction("clock_in")
                            },
                            enabled = internetAvailable && !busy,
                            modifier = Modifier.fillMaxWidth(),
                        ) { Text(if (runningAction == "clock_in") copy.clockingIn else copy.clockIn) }
                        "open" -> Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(
                                onClick = {
                                    localFeedback = null
                                    runningAction = "break_start"
                                    onPerformShiftAction("break_start")
                                },
                                enabled = internetAvailable && !busy,
                                modifier = Modifier.weight(1f),
                            ) { Text(if (runningAction == "break_start") copy.breakStarting else copy.breakStart) }
                            OutlinedButton(
                                onClick = { clockOutConfirmationVisible = true },
                                enabled = internetAvailable && !busy,
                                modifier = Modifier.weight(1f),
                            ) { Text(copy.clockOut) }
                        }
                        "on_break" -> Button(
                            onClick = {
                                localFeedback = null
                                runningAction = "break_end"
                                onPerformShiftAction("break_end")
                            },
                            enabled = internetAvailable && !busy,
                            modifier = Modifier.fillMaxWidth(),
                        ) { Text(if (runningAction == "break_end") copy.breakEnding else copy.breakEnd) }
                    }
                }
            }

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = POS_PANEL_BACKGROUND),
            ) {
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(copy.registerTitle, color = POS_INK, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text(
                        when {
                            data.cashHandlingMode == "none" -> copy.cashModeNone
                            data.cashHandlingMode == "untracked" -> copy.cashModeUntracked
                            personalCash -> copy.cashModePersonal
                            else -> copy.cashModeShared
                        },
                        color = POS_MUTED,
                        style = MaterialTheme.typography.bodySmall,
                    )

                    if (!data.registerOpen || (personalCash && !data.cashSessionOpen)) {
                        if (trackedCash) {
                            NativePosInput(
                                value = openingFloat,
                                onValueChange = {
                                    openingFloat = it.filter { char -> char.isDigit() || char == '.' }
                                    localFeedback = null
                                },
                                label = { Text(if (data.requireOpeningFloat) copy.openingFloatRequired else copy.openingFloatOptional) },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth(),
                            )
                        }
                        Button(
                            onClick = {
                                if (data.requireOpeningFloat && openingFloat.isBlank()) {
                                    localFeedback = copy.openingFloatNeeded
                                } else {
                                    localFeedback = null
                                    runningAction = "open_register"
                                    onOpenRegister(openingFloat)
                                }
                            },
                            enabled = internetAvailable && !busy,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text(
                                if (runningAction == "open_register") copy.registerOpening
                                else if (personalCash && data.registerOpen) copy.openMyCashSession
                                else copy.openRegister,
                            )
                        }
                    } else {
                        NativeReferenceRow(copy.registerStatus, copy.thisTerminal, copy.opened)
                        if (trackedCash) {
                            NativeReferenceRow(copy.cashSession, if (personalCash) copy.myPersonalCash else copy.sharedDrawer, if (data.cashSessionOpen) copy.opened else copy.notOpened)
                        }
                        data.expectedCash?.let { NativeReferenceRow(copy.expectedCash, copy.thisRegister, "$it ${data.currency}") }
                        data.netSales?.let { NativeReferenceRow(copy.netSales, copy.thisRegister, "$it ${data.currency}") }
                        NativeReferenceRow(copy.outstandingOrders, copy.awaitingProcessing, data.outstandingOrders.toString())

                        if (data.cashSessionOpen) {
                            Text(copy.cashInOut, color = POS_INK, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                            NativePosInput(value = movementAmount, onValueChange = { movementAmount = it.filter { char -> char.isDigit() || char == '.' } }, label = { Text(copy.amountLabel) }, singleLine = true, modifier = Modifier.fillMaxWidth())
                            NativePosInput(value = movementReason, onValueChange = { movementReason = it; localFeedback = null }, label = { Text(copy.reasonLabel) }, modifier = Modifier.fillMaxWidth())
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                OutlinedButton(
                                    onClick = {
                                        localFeedback = null
                                        runningAction = "pay_in"
                                        onCreateCashMovement("pay_in", movementAmount, movementReason)
                                    },
                                    enabled = internetAvailable && !busy,
                                    modifier = Modifier.weight(1f),
                                ) { Text(if (runningAction == "pay_in") copy.recording else copy.payIn) }
                                OutlinedButton(
                                    onClick = {
                                        localFeedback = null
                                        runningAction = "pay_out"
                                        onCreateCashMovement("pay_out", movementAmount, movementReason)
                                    },
                                    enabled = internetAvailable && !busy,
                                    modifier = Modifier.weight(1f),
                                ) { Text(if (runningAction == "pay_out") copy.recording else copy.payOut) }
                            }
                            data.movements.forEach { movement ->
                                NativeReferenceRow(
                                    if (movement.type == "pay_in") copy.payIn else copy.payOut,
                                    movement.reason,
                                    "${movement.amount} ${movement.currency}",
                                )
                            }
                        }

                        if (canCloseCurrentSession) {
                            if (!closeConfirmationVisible) {
                                OutlinedButton(
                                    onClick = { closeConfirmationVisible = true },
                                    enabled = internetAvailable && !busy,
                                    modifier = Modifier.fillMaxWidth(),
                                ) {
                                    Text(
                                        when {
                                            personalCash && data.cashSessionOpen -> copy.countAndCloseMyCash
                                            personalCash -> copy.closeRegisterZReport
                                            else -> copy.closeRegisterZReport
                                        },
                                    )
                                }
                            } else {
                                Text(copy.closeRegisterHint, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                                if (data.cashSessionOpen) {
                                    NativePosInput(
                                        value = countedCash,
                                        onValueChange = { countedCash = it.filter { char -> char.isDigit() || char == '.' }; localFeedback = null },
                                        label = { Text(if (data.requireClosingCount) copy.countedCashRequired else copy.countedCashOptional) },
                                        singleLine = true,
                                        modifier = Modifier.fillMaxWidth(),
                                    )
                                }
                                NativePosInput(value = closeNotes, onValueChange = { closeNotes = it }, label = { Text(copy.handoverNotes) }, modifier = Modifier.fillMaxWidth())
                                Button(
                                    onClick = {
                                        if (data.cashSessionOpen && data.requireClosingCount && countedCash.isBlank()) {
                                            localFeedback = copy.countedCashNeeded
                                        } else {
                                            localFeedback = null
                                            runningAction = "close_register"
                                            onCloseRegister(countedCash, closeNotes)
                                        }
                                    },
                                    enabled = internetAvailable && !busy,
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(14.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                                ) { Text(if (runningAction == "close_register") copy.closing else copy.confirmClose) }
                                OutlinedButton(onClick = { closeConfirmationVisible = false }, enabled = !busy, modifier = Modifier.fillMaxWidth()) { Text(copy.notYet) }
                            }
                        } else if (personalCash && data.registerOpen) {
                            Text(copy.closeNeedsManager, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }

            if (data.zReports.isNotEmpty()) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(18.dp),
                    colors = CardDefaults.cardColors(containerColor = POS_PANEL_BACKGROUND),
                ) {
                    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(copy.recentZReports, color = POS_INK, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        data.zReports.forEach { report ->
                            NativeReferenceRow("${report.netSales} ${report.currency}", "${report.cutoffAt} · ${copy.varianceLabel} ${report.variance}", copy.orderCountLabel.format(report.orderCount))
                            report.taxableAmount?.let { NativeReferenceRow(copy.taxableAmountLabel, it, report.currency) }
                            report.taxAmount?.let { NativeReferenceRow(copy.taxAmountLabel, it, report.currency) }
                            report.taxComponents.forEach { component ->
                                NativeReferenceRow("${component.name} ${formatNativeTaxRate(component.rate)}", component.taxAmount, report.currency)
                            }
                            NativeReferenceRow(copy.discountAmountLabel, report.discountAmount, report.currency)
                            NativeReferenceRow(copy.refundAmountLabel, report.refundAmount, report.currency)
                            report.paymentBreakdown.forEach { payment ->
                                NativeReferenceRow("${payment.method}${payment.provider?.let { " / $it" }.orEmpty()}", payment.netAmount, report.currency)
                            }
                            OutlinedButton(
                                onClick = {
                                    pendingReportCsv = buildNativeZReportCsv(report)
                                    createReportDocument.launch("z-report-${report.cutoffAt.take(10)}-${report.id}.csv")
                                },
                                modifier = Modifier.fillMaxWidth(),
                            ) { Text(copy.exportZReport) }
                        }
                    }
                }
            }
        }

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(18.dp),
            colors = CardDefaults.cardColors(containerColor = POS_PANEL_BACKGROUND),
        ) {
            Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(copy.localData, color = POS_INK, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text(copy.cachedSummary.format(current.products.size, current.pendingSales), color = POS_MUTED, style = MaterialTheme.typography.bodyMedium)
                OutlinedButton(onClick = onSynchronize, enabled = !busy, modifier = Modifier.fillMaxWidth()) { Text(if (busy) copy.synchronizing else copy.syncLocalData) }
            }
        }
    }

    if (clockOutConfirmationVisible) {
        Dialog(onDismissRequest = { if (!busy) clockOutConfirmationVisible = false }) {
            Surface(
                modifier = Modifier.fillMaxWidth().widthIn(max = 420.dp),
                shape = RoundedCornerShape(24.dp),
                color = Color.White,
            ) {
                Column(Modifier.padding(22.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Text(copy.confirmClockOutTitle, color = POS_INK, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    Text(copy.confirmClockOutBody, color = POS_MUTED, style = MaterialTheme.typography.bodyMedium)
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        OutlinedButton(onClick = { clockOutConfirmationVisible = false }, enabled = !busy, modifier = Modifier.weight(1f)) { Text(copy.checkAgain) }
                        Button(
                            onClick = {
                                clockOutConfirmationVisible = false
                                runningAction = "clock_out"
                                onClockOut()
                            },
                            enabled = !busy,
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                        ) { Text(copy.confirmClockOut) }
                    }
                }
            }
        }
    }
}

@Composable
private fun NativeShiftFeedback(message: String) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        color = Color(0xFFF1EEF7),
    ) {
        Text(
            message,
            modifier = Modifier.padding(12.dp),
            color = POS_INK,
            style = MaterialTheme.typography.bodySmall,
        )
    }
}

@Composable
internal fun NativeMoreMenuView(copy: NativePosCopy, current: NativePosSnapshot, busy: Boolean, message: String?,
    destinations: List<NativeNavigationDestination>, onNavigate: (NativeNavigationDestination) -> Unit) {
    LazyColumn(Modifier.fillMaxSize().padding(20.dp)) {
        item {
            Text(copy.tabMore, color = POS_INK, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Text(current.terminal?.branchName.orEmpty(), color = POS_MUTED, modifier = Modifier.padding(top = 6.dp, bottom = 20.dp))
        }
        items(destinations, key = { it.name }) { destination ->
            Row(Modifier.fillMaxWidth().background(POS_PANEL_BACKGROUND).clickable(enabled = !busy) { onNavigate(destination) }.padding(18.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                NativeNavigationGlyph(destination)
                Text(destination.title(copy), color = POS_INK, modifier = Modifier.weight(1f))
                Text("›", color = POS_MUTED)
            }
            HorizontalDivider(color = POS_BORDER)
        }
        message?.let { item { Text(it, color = POS_MUTED, modifier = Modifier.padding(top = 16.dp)) } }
    }
}

@Composable
private fun NativeMoreCustomersView(
    copy: NativePosCopy,
    customers: List<NativeCustomer>,
    busy: Boolean,
    message: String?,
    onBack: () -> Unit,
    onStartIntake: () -> Unit,
    onStartIntakeForCustomer: (NativeCustomer) -> Unit,
    onCreateCustomer: (String, String) -> Unit,
) {
    var query by remember { mutableStateOf("") }
    var creating by remember { mutableStateOf(false) }
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    val normalized = query.trim().lowercase()
    val matches = customers.filter {
        normalized.isBlank() || it.fullName.lowercase().contains(normalized) ||
            it.accountName.lowercase().contains(normalized) || it.phone.orEmpty().contains(normalized)
    }
    NativeMorePage(copy, copy.menuCustomers, onBack) {
        Text(copy.customersCachedHint, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
        NativePosInput(value = query, onValueChange = { query = it }, label = { Text(copy.nameAccountOrPhone) }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { creating = !creating }, enabled = !busy, modifier = Modifier.weight(1f), colors = ButtonDefaults.buttonColors(containerColor = POS_ACCENT)) { Text(if (creating) copy.collapseRegistration else copy.newCustomerToggle) }
            OutlinedButton(onClick = onStartIntake, enabled = !busy, modifier = Modifier.weight(1f)) { Text(copy.newServiceTicket) }
        }
        if (creating) {
            Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = POS_PANEL_BACKGROUND)) {
                Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(copy.customerRegistration, color = POS_INK, fontWeight = FontWeight.SemiBold)
                    NativePosInput(value = name, onValueChange = { name = it }, label = { Text(copy.customerName) }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    NativePosInput(value = phone, onValueChange = { phone = it }, label = { Text(copy.phoneNumber) }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    Button(
                        onClick = { onCreateCustomer(name, phone) },
                        enabled = !busy && name.isNotBlank() && phone.isNotBlank(),
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text(copy.createCustomer) }
                }
            }
        }
        if (matches.isEmpty()) Text(copy.noCachedMatches, color = POS_MUTED)
        matches.forEach { customer ->
            Card(
                modifier = Modifier.fillMaxWidth().clickable(enabled = !busy) { onStartIntakeForCustomer(customer) },
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = POS_PANEL_BACKGROUND),
            ) {
                Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(customer.fullName, color = POS_INK, fontWeight = FontWeight.SemiBold)
                    Text(customer.accountName, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                    Text(customer.phone ?: customer.email ?: copy.noContactOnFile, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                    Text(copy.tapToStartIntake, color = POS_ACCENT, style = MaterialTheme.typography.labelSmall)
                }
            }
        }
        message?.let { Text(it, color = POS_MUTED, style = MaterialTheme.typography.bodySmall) }
    }
}

@Composable
private fun NativeMoreCatalogView(
    copy: NativePosCopy,
    products: List<NativeProduct>,
    services: List<NativeService>,
    internetAvailable: Boolean,
    busy: Boolean,
    message: String?,
    onBack: () -> Unit,
    onStartSale: () -> Unit,
    onAddProduct: (NativeProduct) -> Unit,
) {
    NativeMorePage(copy, copy.menuCatalog, onBack) {
        Button(onClick = onStartSale, enabled = !busy, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = POS_ACCENT)) { Text(copy.goToTill) }
        Text(copy.productsHeading, color = POS_INK, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        products.forEach { product ->
            Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = POS_PANEL_BACKGROUND)) {
                Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    NativeReferenceRow(
                        product.name,
                        "${product.sku} · ${if (internetAvailable) copy.syncedSellOffline else copy.usingLocalCatalog}",
                        formatMoney(product.amountMinor, product.currency),
                    )
                    Button(
                        onClick = { onAddProduct(product) },
                        enabled = !busy,
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text(copy.addToTillList) }
                }
            }
        }
        Text(copy.servicePrices, color = POS_INK, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        services.forEach { service ->
            NativeReferenceRow(
                title = service.name,
                detail = "${service.businessLine} · ${service.pricingUnit}",
                amount = formatMoney(service.amountMinor, service.currency),
            )
        }
        message?.let { Text(it, color = POS_MUTED, style = MaterialTheme.typography.bodySmall) }
    }
}

@Composable
private fun NativeMoreScanView(
    copy: NativePosCopy,
    current: NativePosSnapshot,
    busy: Boolean,
    message: String?,
    hardwareScan: NativeHardwareScan?,
    onBack: () -> Unit,
    onOpenTicket: (NativeServiceTicket) -> Unit,
    onStartIntakeForCustomer: (NativeCustomer) -> Unit,
    onAddProduct: (NativeProduct) -> Unit,
    searchResults: List<NativeMoreSearchResult>,
    onSearch: (String) -> Unit,
    onOpenSearchResult: (NativeMoreSearchResult) -> Unit,
    onTriggerHardwareScanner: () -> Unit,
) {
    var query by remember { mutableStateOf("") }
    LaunchedEffect(hardwareScan?.receivedAt) {
        hardwareScan?.let { scan ->
            query = scan.value
            onSearch(scan.value)
        }
    }
    val keyword = query.trim().lowercase()
    val ticketMatches = current.tickets.filter { keyword.isNotBlank() && (it.ticketNo.orEmpty().lowercase().contains(keyword) || it.customerName.lowercase().contains(keyword)) }
    val productMatches = current.products.filter { keyword.isNotBlank() && (it.sku.lowercase().contains(keyword) || it.name.lowercase().contains(keyword)) }
    val customerMatches = current.customers.filter { keyword.isNotBlank() && (it.fullName.lowercase().contains(keyword) || it.phone.orEmpty().contains(keyword)) }
    NativeMorePage(copy, copy.menuScan, onBack) {
        Text(copy.scanIntro, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
        NativePosInput(value = query, onValueChange = { query = it }, label = { Text(copy.scanOrType) }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { onSearch(query) }, enabled = !busy && keyword.isNotBlank(), modifier = Modifier.weight(1f)) { Text(if (busy) copy.searching else copy.searchOnline) }
            OutlinedButton(onClick = onTriggerHardwareScanner, enabled = !busy, modifier = Modifier.weight(1f)) { Text(copy.startBuiltInScanner) }
        }
        if (keyword.isBlank()) Text(copy.scanEmptyHint, color = POS_MUTED)
        ticketMatches.forEach { ticket ->
            OutlinedButton(onClick = { onOpenTicket(ticket) }, enabled = !busy, modifier = Modifier.fillMaxWidth()) { Text("${copy.ticketPrefix.format(ticket.ticketNo ?: ticket.id.takeLast(8))} · ${ticket.customerName}") }
        }
        productMatches.forEach { product ->
            OutlinedButton(onClick = { onAddProduct(product) }, enabled = !busy, modifier = Modifier.fillMaxWidth()) { Text(copy.productAddToTill.format(product.name)) }
        }
        customerMatches.forEach { customer ->
            OutlinedButton(onClick = { onStartIntakeForCustomer(customer) }, enabled = !busy, modifier = Modifier.fillMaxWidth()) { Text(copy.customerIntakePrefix.format(customer.fullName)) }
        }
        if (searchResults.isNotEmpty()) {
            Text(copy.onlineSearchResults, color = POS_INK, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            searchResults.forEach { result ->
                Card(
                    modifier = Modifier.fillMaxWidth().clickable(enabled = !busy) { onOpenSearchResult(result) },
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = POS_PANEL_BACKGROUND),
                ) {
                    Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text(result.title, color = POS_INK, fontWeight = FontWeight.SemiBold)
                        Text(listOfNotNull(result.type, result.subtitle, result.badge).joinToString(" · "), color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
        if (keyword.isNotBlank() && ticketMatches.isEmpty() && productMatches.isEmpty() && customerMatches.isEmpty() && searchResults.isEmpty()) Text(copy.noMatchFound, color = POS_MUTED)
        message?.let { Text(it, color = POS_MUTED, style = MaterialTheme.typography.bodySmall) }
    }
}

@Composable
private fun NativeMoreOrdersView(
    copy: NativePosCopy,
    orders: List<NativeMoreOrder>,
    busy: Boolean,
    message: String?,
    onBack: () -> Unit,
    onRefresh: () -> Unit,
    onOpenOrder: (String) -> Unit,
) {
    NativeMorePage(copy, copy.menuOrders, onBack) {
        OutlinedButton(onClick = onRefresh, enabled = !busy, modifier = Modifier.fillMaxWidth()) { Text(if (busy) copy.loading else copy.refreshOrders) }
        if (!busy && orders.isEmpty()) Text(copy.noOrdersToShow, color = POS_MUTED)
        orders.forEach { order ->
            Card(
                modifier = Modifier.fillMaxWidth().clickable(enabled = !busy) { onOpenOrder(order.id) },
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = POS_PANEL_BACKGROUND),
            ) {
                Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(copy.orderPrefix.format(order.id.takeLast(8).uppercase()), color = POS_INK, fontWeight = FontWeight.SemiBold)
                    Text("${order.customerName ?: copy.walkInCustomer} · ${copy.itemsCountSuffix.format(order.itemCount)} · ${nativeOrderStatusLabel(order.status, copy)} · ${nativePaymentStatusLabel(order.paymentStatus, copy)}", color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                    Text("${order.totalAmount} ${order.currency} · ${copy.tapToProcessOrder}", color = POS_ACCENT, style = MaterialTheme.typography.labelMedium)
                }
            }
        }
        message?.let { Text(it, color = POS_MUTED, style = MaterialTheme.typography.bodySmall) }
    }
}

@Composable
private fun NativeMoreOrderDetailView(
    copy: NativePosCopy,
    order: NativeMoreOrderDetail?,
    timeZone: String,
    canResolveManualPayments: Boolean,
    internetAvailable: Boolean,
    busy: Boolean,
    message: String?,
    onBack: () -> Unit,
    onRefresh: () -> Unit,
    onRecordCash: (NativeMoreOrderDetail, String) -> Unit,
    onResolveManualPayment: (NativeMoreOrderDetail, NativeMorePayment, Boolean, String) -> Unit,
    onCreateRefund: (NativeMoreOrderDetail, NativeMorePayment, String, String) -> Unit,
    onResolveRefund: (NativeMoreOrderDetail, NativeMorePaymentAdjustment, Boolean, String, String) -> Unit,
    onChangeStatus: (NativeMoreOrderDetail, String) -> Unit,
) {
    var tendered by remember(order?.id) { mutableStateOf("") }
    var showTenderInput by remember(order?.id) { mutableStateOf(false) }
    var resolutionPaymentId by remember(order?.id) { mutableStateOf<String?>(null) }
    var resolutionReason by remember(order?.id) { mutableStateOf("") }
    var refundPaymentId by remember(order?.id) { mutableStateOf<String?>(null) }
    var refundAmount by remember(order?.id) { mutableStateOf("") }
    var refundReason by remember(order?.id) { mutableStateOf("") }
    var refundAdjustmentId by remember(order?.id) { mutableStateOf<String?>(null) }
    var refundReference by remember(order?.id) { mutableStateOf("") }
    var refundResolutionReason by remember(order?.id) { mutableStateOf("") }
    NativeMorePage(copy, copy.menuOrderDetail, onBack) {
        OutlinedButton(onClick = onRefresh, enabled = internetAvailable && !busy, modifier = Modifier.fillMaxWidth()) { Text(if (busy) copy.loading else copy.refreshOrders) }
        if (order == null) {
            Text(copy.openOrderWhenOnline, color = POS_MUTED)
            message?.let { Text(it, color = POS_MUTED, style = MaterialTheme.typography.bodySmall) }
            return@NativeMorePage
        }
        val outstanding = outstandingAmount(order.totalAmount, order.paidAmount)
        val pendingManualPayment = order.payments.any { it.method == "app" && it.status == "pending" }
        NativeOrderOverview(copy, order, timeZone)
        if (isPositiveDecimal(outstanding) && !pendingManualPayment && order.status != "cancelled" && order.status != "delivered") {
            Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = POS_PANEL_BACKGROUND)) {
                Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(copy.cashCollection, color = POS_INK, fontWeight = FontWeight.SemiBold)
                    Text(copy.outstandingHint.format("$outstanding ${order.currency}"), color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                    if (showTenderInput) {
                        NativePosInput(value = tendered, onValueChange = { tendered = it.filter { char -> char.isDigit() || char == '.' } }, label = { Text(copy.tenderedForChange) }, singleLine = true, modifier = Modifier.fillMaxWidth())
                        TextButton(onClick = { tendered = ""; showTenderInput = false }) { Text(copy.chargeOutstanding) }
                    } else {
                        Text(copy.defaultChargeOutstanding, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                        OutlinedButton(onClick = { showTenderInput = true }, enabled = !busy, modifier = Modifier.fillMaxWidth()) { Text(copy.enterTenderAndChange) }
                    }
                    Button(
                        onClick = { onRecordCash(order, tendered) },
                        enabled = internetAvailable && !busy && (tendered.isBlank() || isAtLeast(tendered, outstanding)),
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = POS_ACCENT),
                    ) { Text(copy.confirmTakeCash) }
                }
            }
        }
        val transitions = when (order.status) {
            "draft" -> listOf("received")
            "paid" -> listOf("delivered")
            else -> emptyList()
        }
        if (transitions.isNotEmpty()) {
            Text(copy.orderProcessing, color = POS_INK, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            transitions.forEach { target ->
                OutlinedButton(onClick = { onChangeStatus(order, target) }, enabled = internetAvailable && !busy, modifier = Modifier.fillMaxWidth()) {
                    Text(if (target == "received") copy.confirmReceived else copy.confirmDelivered)
                }
            }
        }
        Text(copy.orderItems, color = POS_INK, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
        order.items.forEach { item -> NativeOrderItemCard(copy, item, order.currency) }
        NativeOrderFinancialSummary(copy, order)
        NativeOrderTicketReferences(copy, order, timeZone)
        Text(copy.paymentRecords, color = POS_INK, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
        if (order.payments.isEmpty()) Text(copy.orderNoPayments, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
        if (order.payments.isNotEmpty()) {
            order.payments.forEach { payment ->
                NativeOrderPaymentCard(copy, payment, order.currency, timeZone)
                if (payment.status == "pending" && payment.method == "app" && canResolveManualPayments) {
                    Text(copy.paymentReferenceLine.format(payment.externalReference.orEmpty()), color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                    if (resolutionPaymentId == payment.id) {
                        NativePosInput(value = resolutionReason, onValueChange = { resolutionReason = it }, label = { Text(copy.manualPaymentReason) }, modifier = Modifier.fillMaxWidth())
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(onClick = { onResolveManualPayment(order, payment, true, resolutionReason); resolutionPaymentId = null }, enabled = internetAvailable && !busy && resolutionReason.trim().length >= 3, modifier = Modifier.weight(1f)) { Text(copy.confirmManualPayment) }
                            OutlinedButton(onClick = { onResolveManualPayment(order, payment, false, resolutionReason); resolutionPaymentId = null }, enabled = internetAvailable && !busy && resolutionReason.trim().length >= 3, modifier = Modifier.weight(1f)) { Text(copy.failManualPayment) }
                        }
                    } else {
                        OutlinedButton(onClick = { resolutionPaymentId = payment.id; resolutionReason = "" }, enabled = internetAvailable && !busy, modifier = Modifier.fillMaxWidth()) { Text(copy.reviewManualPayment) }
                    }
                }
                if (payment.status == "paid" && canResolveManualPayments) {
                    val refundedMinor = order.adjustments.filter {
                        it.type == "refund" && it.originalPaymentId == payment.id && it.status != "failed"
                    }.sumOf { parseMoney(it.amount) ?: 0L }
                    val refundableMinor = ((parseMoney(payment.amount) ?: 0L) - refundedMinor).coerceAtLeast(0)
                    if (refundableMinor > 0L) {
                        if (refundPaymentId == payment.id) {
                            Text(copy.refundLimit.format("${refundMinorToMoney(refundableMinor)} ${order.currency}"), color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                            if (payment.method == "cash") Text(copy.cashRefundHint, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                            NativePosInput(value = refundAmount, onValueChange = { refundAmount = it.filter { char -> char.isDigit() || char == '.' } }, label = { Text(copy.refundAmountLabel) }, singleLine = true, modifier = Modifier.fillMaxWidth())
                            NativePosInput(value = refundReason, onValueChange = { refundReason = it }, label = { Text(copy.refundReasonLabel) }, modifier = Modifier.fillMaxWidth())
                            Button(
                                onClick = { onCreateRefund(order, payment, refundAmount, refundReason); refundPaymentId = null },
                                enabled = internetAvailable && !busy && (parseMoney(refundAmount)?.let { it in 1..refundableMinor } == true) && refundReason.trim().isNotEmpty(),
                                modifier = Modifier.fillMaxWidth(),
                            ) { Text(copy.recordRefund) }
                        } else {
                            OutlinedButton(onClick = {
                                refundPaymentId = payment.id
                                refundAmount = refundMinorToMoney(refundableMinor)
                                refundReason = ""
                            }, enabled = internetAvailable && !busy, modifier = Modifier.fillMaxWidth()) { Text(copy.recordRefund) }
                        }
                    }
                }
            }
        }
        if (order.adjustments.isNotEmpty()) {
            Text(copy.refundRecords, color = POS_INK, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            order.adjustments.filter { it.type == "refund" }.forEach { adjustment ->
                NativeReferenceRow(copy.refundAmountLabel, "${adjustment.status} · ${adjustment.reason}", "${adjustment.amount} ${order.currency}")
                if (adjustment.status != "succeeded" && canResolveManualPayments) {
                    if (refundAdjustmentId == adjustment.id) {
                        NativePosInput(value = refundReference, onValueChange = { refundReference = it }, label = { Text(copy.refundReferenceLabel) }, singleLine = true, modifier = Modifier.fillMaxWidth())
                        NativePosInput(value = refundResolutionReason, onValueChange = { refundResolutionReason = it }, label = { Text(copy.refundReasonLabel) }, modifier = Modifier.fillMaxWidth())
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(onClick = { onResolveRefund(order, adjustment, true, refundReference, refundResolutionReason); refundAdjustmentId = null }, enabled = internetAvailable && !busy && refundReference.trim().isNotEmpty() && refundResolutionReason.trim().length >= 3, modifier = Modifier.weight(1f)) { Text(copy.refundSettledAction) }
                            if (adjustment.status == "pending") OutlinedButton(onClick = { onResolveRefund(order, adjustment, false, "", refundResolutionReason); refundAdjustmentId = null }, enabled = internetAvailable && !busy && refundResolutionReason.trim().length >= 3, modifier = Modifier.weight(1f)) { Text(copy.refundFailedAction) }
                        }
                    } else {
                        OutlinedButton(onClick = { refundAdjustmentId = adjustment.id; refundReference = ""; refundResolutionReason = "" }, enabled = internetAvailable && !busy, modifier = Modifier.fillMaxWidth()) { Text(copy.resolveRefundAction) }
                    }
                }
            }
        }
        message?.let { Text(it, color = POS_MUTED, style = MaterialTheme.typography.bodySmall) }
    }
}

@Composable
private fun NativeMoreStatisticsView(
    copy: NativePosCopy,
    statistics: NativeMoreStatistics?,
    busy: Boolean,
    message: String?,
    onBack: () -> Unit,
    onRefresh: () -> Unit,
    period: String,
    onPeriodChange: (String) -> Unit,
) {
    NativeMorePage(copy, copy.menuStatistics, onBack) {
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            listOf("today" to copy.periodToday, "week" to copy.periodWeek, "month" to copy.periodMonth, "all" to copy.periodAll).forEach { (value, label) ->
                OutlinedButton(onClick = { onPeriodChange(value) }, enabled = !busy) { Text(if (period == value) "✓ $label" else label) }
            }
        }
        OutlinedButton(onClick = onRefresh, enabled = !busy, modifier = Modifier.fillMaxWidth()) { Text(if (busy) copy.loading else copy.refreshData) }
        if (statistics != null) {
            val data = statistics
            NativeReferenceRow(copy.ordersLabel, copy.ordersSummary.format(data.orderCount, data.unpaidCount), data.paidAmount)
            NativeReferenceRow(copy.ticketsLabel, copy.ticketsSummary.format(data.ticketTotal, data.ticketOverdue), null)
            NativeReferenceRow(copy.customerLabel, copy.customersSummary.format(data.customerTotal, data.todayNewCustomers), null)
        } else if (!busy) {
            Text(copy.statisticsWhenOnline, color = POS_MUTED)
        }
        message?.let { Text(it, color = POS_MUTED, style = MaterialTheme.typography.bodySmall) }
    }
}

@Composable
private fun NativeMoreNotificationsView(
    copy: NativePosCopy,
    notifications: List<NativeMoreNotification>,
    internetAvailable: Boolean,
    busy: Boolean,
    message: String?,
    onBack: () -> Unit,
    onRefresh: () -> Unit,
    onMarkRead: (String) -> Unit,
    onMarkAllRead: () -> Unit,
    onArchive: (String) -> Unit,
    onOpenRelated: (NativeMoreNotification) -> Unit,
) {
    NativeMorePage(copy, copy.menuNotifications, onBack) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = onRefresh, enabled = !busy, modifier = Modifier.weight(1f)) { Text(if (busy) copy.loading else copy.refreshNotifications) }
            OutlinedButton(onClick = onMarkAllRead, enabled = internetAvailable && !busy && notifications.any { it.readStatus == "unread" }, modifier = Modifier.weight(1f)) { Text(copy.markAllRead) }
        }
        if (!busy && notifications.isEmpty()) Text(copy.noNotifications, color = POS_MUTED)
        notifications.forEach { notification ->
            Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = POS_PANEL_BACKGROUND)) {
                Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text(notification.title, color = POS_INK, fontWeight = FontWeight.SemiBold)
                    Text(notification.content, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                    Text("${notification.priority} · ${notification.createdAt}", color = POS_MUTED, style = MaterialTheme.typography.labelSmall)
                    if (notification.readStatus == "unread") {
                        OutlinedButton(onClick = { onMarkRead(notification.deliveryId) }, enabled = internetAvailable && !busy, modifier = Modifier.fillMaxWidth()) { Text(copy.markRead) }
                    }
                    if (notification.relatedId != null && notification.relatedType in setOf("ticket", "order")) {
                        OutlinedButton(onClick = { onOpenRelated(notification) }, enabled = !busy, modifier = Modifier.fillMaxWidth()) { Text(if (notification.relatedType == "order") copy.openRelatedOrder else copy.openRelatedTicket) }
                    }
                    if (notification.readStatus != "archived") {
                        TextButton(onClick = { onArchive(notification.deliveryId) }, enabled = internetAvailable && !busy, modifier = Modifier.fillMaxWidth()) { Text(copy.archiveNotification) }
                    }
                }
            }
        }
        message?.let { Text(it, color = POS_MUTED, style = MaterialTheme.typography.bodySmall) }
    }
}

@Composable
private fun NativeMoreHardwareView(
    copy: NativePosCopy,
    hardwareStatus: NativeHardwareStatus?,
    configuredDevices: List<NativeHardwareDevice>,
    bluetoothPrinters: List<NativeBluetoothPrinter>,
    receiptPrintQueue: NativeReceiptPrintQueueState,
    canManageSensitiveHardware: Boolean,
    internetAvailable: Boolean,
    busy: Boolean,
    message: String?,
    onBack: () -> Unit,
    onRefresh: () -> Unit,
    onTestPrinter: () -> Unit,
    onTriggerScanner: () -> Unit,
    onConnectBuiltIn: (String) -> Unit,
    onRequestBluetoothPermissions: () -> Unit,
    onRefreshBluetoothPrinters: () -> Unit,
    onBindBluetoothPrinter: (NativeHardwareDevice, NativeBluetoothPrinter) -> Unit,
    onOpenDrawer: () -> Unit,
    onPrintNextReceipt: () -> Unit,
) {
    val defaultReceiptPrinterId = configuredDevices.defaultReceiptPrinterId()
    val isCurrentPrinterSelected =
        (hardwareStatus?.printerId != null && hardwareStatus.printerId == defaultReceiptPrinterId) ||
            bluetoothPrinters.any { it.id == defaultReceiptPrinterId }
    val externalPrinterTargets = configuredDevices.filter {
        it.deviceType == "printer" && it.status == "active" && it.provisioningMode != "built_in"
    }
    NativeMorePage(copy, copy.menuHardware, onBack, backLabel = copy.menuSettings) {
        Text(copy.hardwareIntro, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
        OutlinedButton(onClick = onRefresh, enabled = !busy, modifier = Modifier.fillMaxWidth()) {
            Text(if (busy) copy.detecting else copy.refreshHardware)
        }
        if (hardwareStatus == null) {
            Text(copy.readingHardware, color = POS_MUTED)
        } else {
            NativeReferenceRow(copy.hardwareModel, hardwareStatus.hardwareModel, hardwareStatus.host)
            Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = POS_PANEL_BACKGROUND)) {
                Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(copy.builtInPrinter, color = POS_INK, fontWeight = FontWeight.SemiBold)
                    Text(
                        hardwareStatus.printerName ?: copy.noBuiltInPrinter,
                        color = POS_MUTED,
                        style = MaterialTheme.typography.bodySmall,
                    )
                    NativeReferenceRow(
                        copy.statusHeading,
                        if (hardwareStatus.printerConnected) hardwareStatus.printerStatus ?: copy.connected else copy.notConnected,
                        hardwareStatus.printerId,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(
                            onClick = onTestPrinter,
                            enabled = !busy && hardwareStatus.printerConnected && hardwareStatus.printerStatusCode == 0,
                            modifier = Modifier.weight(1f),
                        ) { Text(copy.printTestPage) }
                        Button(
                            onClick = { onConnectBuiltIn("printer") },
                            enabled = !busy && canManageSensitiveHardware && internetAvailable && hardwareStatus.printerConnected && hardwareStatus.printerStatusCode == 0,
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(containerColor = POS_ACCENT),
                        ) { Text(copy.testAndRegister) }
                    }
                }
            }
            Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = POS_PANEL_BACKGROUND)) {
                Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(copy.builtInScanner, color = POS_INK, fontWeight = FontWeight.SemiBold)
                    Text(
                        hardwareStatus.scannerName ?: copy.noBuiltInScanner,
                        color = POS_MUTED,
                        style = MaterialTheme.typography.bodySmall,
                    )
                    NativeReferenceRow(
                        copy.statusHeading,
                        if (hardwareStatus.scannerConnected) copy.connectedReadyToScan else copy.notConnected,
                        hardwareStatus.scannerId,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(
                            onClick = onTriggerScanner,
                            enabled = !busy && hardwareStatus.scannerConnected,
                            modifier = Modifier.weight(1f),
                        ) { Text(copy.startScanTest) }
                        Button(
                            onClick = { onConnectBuiltIn("scanner") },
                            enabled = !busy && canManageSensitiveHardware && internetAvailable && hardwareStatus.scannerConnected,
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(containerColor = POS_ACCENT),
                        ) { Text(copy.testAndRegister) }
                    }
                }
            }
            Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = POS_PANEL_BACKGROUND)) {
                Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(copy.drawerTitle, color = POS_INK, fontWeight = FontWeight.SemiBold)
                    Text(
                        if (hardwareStatus.cashDrawerConnected) copy.drawerConnectedHint else copy.drawerUnavailable,
                        color = POS_MUTED,
                        style = MaterialTheme.typography.bodySmall,
                    )
                    OutlinedButton(
                        onClick = onOpenDrawer,
                        enabled = !busy && canManageSensitiveHardware && internetAvailable && hardwareStatus.cashDrawerConnected,
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text(copy.authoriseAndTestDrawer) }
                }
            }
        }
        if (!canManageSensitiveHardware) {
            Text(copy.hardwareManagerOnly, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
        }
        Text(copy.registeredDevices, color = POS_INK, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
        if (configuredDevices.isEmpty()) {
            Text(if (internetAvailable) copy.noRegisteredDevicesOnline else copy.noRegisteredDevicesOffline, color = POS_MUTED)
        } else {
            configuredDevices.forEach { device ->
                val isDefaultReceiptPrinter = device.deviceType == "printer" &&
                    device.status == "active" &&
                    device.config.optString("printerPurpose", "receipt") != "label" &&
                    device.config.optBoolean("printerIsDefault")
                NativeReferenceRow(
                    title = device.name,
                    detail = "${nativeHardwareDeviceTypeLabel(device.deviceType, copy)} · ${device.provisioningMode} · ${device.connectionType}",
                    amount = when {
                        isDefaultReceiptPrinter -> copy.defaultReceiptPrinter
                        device.status == "active" -> copy.deviceEnabled
                        else -> copy.deviceDisabled
                    },
                )
            }
        }
        Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = POS_PANEL_BACKGROUND)) {
            Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(copy.bluetoothPrinter, color = POS_INK, fontWeight = FontWeight.SemiBold)
                Text(copy.bluetoothIntro, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = onRequestBluetoothPermissions,
                        enabled = !busy,
                        modifier = Modifier.weight(1f),
                    ) { Text(copy.authoriseBluetooth) }
                    Button(
                        onClick = onRefreshBluetoothPrinters,
                        enabled = !busy,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = POS_ACCENT),
                    ) { Text(copy.readPairedDevices) }
                }
                if (bluetoothPrinters.isEmpty()) {
                    Text(copy.noPairedPrinters, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                }
                bluetoothPrinters.forEach { printer ->
                    NativeReferenceRow("${printer.name}", printer.id.removePrefix("bluetooth:"), copy.paired)
                    if (canManageSensitiveHardware && externalPrinterTargets.isNotEmpty()) {
                        externalPrinterTargets.forEach { target ->
                            OutlinedButton(
                                onClick = { onBindBluetoothPrinter(target, printer) },
                                enabled = !busy && internetAvailable,
                                modifier = Modifier.fillMaxWidth(),
                            ) { Text(copy.testAndBindTo.format(target.name)) }
                        }
                    }
                }
                if (canManageSensitiveHardware && externalPrinterTargets.isEmpty()) {
                    Text(copy.needRegisteredPrinter, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
        Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = POS_PANEL_BACKGROUND)) {
            Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(copy.localReceiptQueue, color = POS_INK, fontWeight = FontWeight.SemiBold)
                Text(
                    copy.receiptQueueSummary.format(receiptPrintQueue.pending, receiptPrintQueue.failed),
                    color = POS_MUTED,
                    style = MaterialTheme.typography.bodySmall,
                )
                OutlinedButton(
                    onClick = onPrintNextReceipt,
                    enabled = !busy && hardwareStatus?.printerConnected == true && hardwareStatus.printerStatusCode == 0 &&
                        isCurrentPrinterSelected && receiptPrintQueue.pending > 0,
                    modifier = Modifier.fillMaxWidth(),
                ) { Text(copy.printNextReceipt) }
                if (receiptPrintQueue.pending > 0 && !isCurrentPrinterSelected) {
                    Text(copy.useDefaultPrinterHint, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
        message?.let { Text(it, color = POS_MUTED, style = MaterialTheme.typography.bodySmall) }
    }
}

private fun nativeHardwareDeviceTypeLabel(type: String, copy: NativePosCopy): String = when (type) {
    "printer" -> copy.devicePrinter
    "scanner" -> copy.deviceScanner
    "cash_drawer" -> copy.deviceCashDrawer
    else -> type
}

@Composable
private fun NativeMorePage(copy: NativePosCopy, title: String, onBack: () -> Unit, backLabel: String = copy.backToMore, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        OutlinedButton(onClick = onBack, modifier = Modifier.fillMaxWidth()) { Text(backLabel) }
        Text(title, color = POS_INK, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        content()
    }
}

@Composable
private fun NativeReferenceRow(title: String, detail: String, amount: String?) {
    Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = POS_PANEL_BACKGROUND)) {
        Row(Modifier.fillMaxWidth().padding(14.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(title, color = POS_INK, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                Text(detail, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
            }
            amount?.let { Text(it, color = POS_INK, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold) }
        }
    }
}

@Composable private fun LoadingView(copy: NativePosCopy) = Text(copy.loadingLocalData, Modifier.padding(24.dp))

@Composable
private fun CachedDataExpiredView(copy: NativePosCopy, busy: Boolean, message: String?, onSynchronize: () -> Unit) {
    FormColumn(copy.catalogNeedsUpdate) {
        Text(copy.catalogExpired)
        Button(onClick = onSynchronize, enabled = !busy, modifier = Modifier.fillMaxWidth()) { Text(copy.syncNow) }
        ErrorText(message)
    }
}

@Composable
private fun FormColumn(
    title: String,
    language: NativePinLanguage? = null,
    onLanguageSelected: ((NativePinLanguage) -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    Box(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
    ) {
        Column(
            modifier = Modifier
                .widthIn(max = 720.dp)
                .fillMaxWidth()
                .align(Alignment.TopCenter),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            if (language != null && onLanguageSelected != null) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text(title, modifier = Modifier.weight(1f), style = MaterialTheme.typography.headlineSmall)
                    PinLanguageMenu(language, onLanguageSelected)
                }
            } else {
                Text(title, style = MaterialTheme.typography.headlineSmall)
            }
            content()
        }
    }
}

@Composable private fun ErrorText(message: String?) { message?.let { Text(it, color = MaterialTheme.colorScheme.error) } }

@Composable
private fun NetworkStatusIndicator(copy: NativePosCopy, internetAvailable: Boolean) {
    val color = if (internetAvailable) Color(0xFF16803A) else MaterialTheme.colorScheme.error
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(10.dp).clip(CircleShape).background(color))
        Text(
            text = if (internetAvailable) copy.deviceOnline else copy.deviceOffline,
            modifier = Modifier.padding(start = 8.dp),
            color = color,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

@Composable
private fun NativeSaleView(
    current: NativePosSnapshot,
    cart: NativePosCart,
    copy: NativePosCopy,
    internetAvailable: Boolean,
    busy: Boolean,
    message: String?,
    checkoutSettings: NativeCheckoutSettings,
    receiptPrinterConfigured: Boolean,
    onRefreshPricing: suspend (NativePosCart, String?, String?) -> NativeCartPricing,
    onAdd: (NativeProduct) -> Unit,
    onRemove: (NativeProduct) -> Unit,
    onClearProduct: (String) -> Unit,
    onRemoveTicketItem: (String) -> Unit,
    onCheckout: (NativeCheckoutRequest) -> Unit,
    onSynchronize: () -> Unit,
    onOpenSettings: () -> Unit,
    onSearchCustomers: suspend (String) -> List<NativeCustomer>,
    onSelectCustomer: (NativeCustomer?) -> Unit,
) {
    val terminal = current.terminal ?: return
    val screenClass = nativePosScreenClass()
    val expanded = screenClass == NativePosScreenClass.Expanded

    @Composable
    fun CheckoutSummary(modifier: Modifier = Modifier.fillMaxWidth(), persistent: Boolean = false) {
        CheckoutPanel(
            cart = cart,
            timeZone = terminal.timeZone,
            busy = busy,
            copy = copy,
            message = message,
            checkoutSettings = checkoutSettings,
            receiptPrinterConfigured = receiptPrinterConfigured,
            internetAvailable = internetAvailable,
            canManageSensitiveOperations = terminal.role == "owner" || terminal.role == "manager",
            onRefreshPricing = onRefreshPricing,
            onAddProduct = { line ->
                current.products.firstOrNull { it.skuId == line.skuId }?.let(onAdd)
            },
            onRemoveProduct = { line ->
                current.products.firstOrNull { it.skuId == line.skuId }?.let(onRemove)
            },
            onClearProduct = onClearProduct,
            onRemoveTicketItem = onRemoveTicketItem,
            onCheckout = onCheckout,
            customers = current.customers,
            onSearchCustomers = onSearchCustomers,
            onSelectCustomer = onSelectCustomer,
            modifier = modifier,
            persistent = persistent,
        )
    }

    Column(Modifier.fillMaxSize().background(POS_PAGE_BACKGROUND)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 12.dp, top = 12.dp, bottom = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(copy.catalogTitle, color = POS_INK, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text(terminal.branchName, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
            }
            OutlinedButton(onClick = onSynchronize, enabled = !busy) { Text(if (busy) copy.syncing else copy.synchronize) }
        }

        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            SaleStatusPill(copy, internetAvailable, current.pendingSales)
            if (current.failedSales > 0) {
                Text(
                    copy.pendingCount.format(current.failedSales),
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.labelMedium,
                )
            }
        }
        // Selling from an old catalog is allowed -- a store that lost its
        // network still has to take money -- but the cashier should know the
        // prices may have moved.
        val cacheSyncedAt = current.terminal.lastSyncedAt
        if (nativeCacheFreshness(cacheSyncedAt, System.currentTimeMillis()) == NativeCacheFreshness.Stale) {
            Text(
                copy.staleCatalogWarning.format(
                    nativeCacheAgeHours(cacheSyncedAt, System.currentTimeMillis()),
                ),
                modifier = Modifier.padding(horizontal = 16.dp),
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall,
            )
        }
        if (internetAvailable && current.cashState?.isOfflineCashReady() != true) {
            Text(
                copy.checkoutVerifiesOnline,
                modifier = Modifier.padding(horizontal = 16.dp),
                color = POS_MUTED,
                style = MaterialTheme.typography.bodySmall,
            )
        }
        Box(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
            NativeTaxReadinessNotice(copy, checkoutSettings, terminal.role, busy, onSynchronize, onOpenSettings)
        }

        if (expanded) {
            Row(
                modifier = Modifier.weight(1f).fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                NativeProductCatalogGrid(
                    copy,
                    products = current.products,
                    cart = cart,
                    offlineMode = !internetAvailable,
                    busy = busy,
                    compact = false,
                    modifier = Modifier.weight(1f).fillMaxHeight(),
                    onAdd = onAdd,
                    onRemove = onRemove,
                )
                CheckoutSummary(
                    modifier = Modifier.width(390.dp).fillMaxHeight(),
                    persistent = true,
                )
            }
        } else {
            NativeProductCatalogGrid(
                copy,
                products = current.products,
                cart = cart,
                offlineMode = !internetAvailable,
                busy = busy,
                compact = screenClass == NativePosScreenClass.Compact,
                modifier = Modifier.weight(1f).fillMaxWidth(),
                onAdd = onAdd,
                onRemove = onRemove,
            )
            CheckoutSummary()
        }
    }
}

@Composable
private fun NativeProductCatalogGrid(
    copy: NativePosCopy,
    products: List<NativeProduct>,
    cart: NativePosCart,
    offlineMode: Boolean,
    busy: Boolean,
    compact: Boolean,
    modifier: Modifier,
    onAdd: (NativeProduct) -> Unit,
    onRemove: (NativeProduct) -> Unit,
) {
    LazyVerticalGrid(
        columns = if (compact) GridCells.Fixed(2) else GridCells.Adaptive(minSize = 164.dp),
        modifier = modifier,
        contentPadding = PaddingValues(start = 16.dp, top = 12.dp, end = 16.dp, bottom = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        gridItems(products, key = { it.skuId }) { product ->
            val quantity = cart.products.firstOrNull { it.skuId == product.skuId }?.quantity ?: 0
            ProductCatalogCard(copy,
                product = product,
                cartQuantity = quantity,
                offlineMode = offlineMode,
                busy = busy,
                onAdd = { onAdd(product) },
                onRemove = { onRemove(product) },
            )
        }
    }
}

@Composable
private fun CashOperationsView(
    copy: NativePosCopy,
    cashState: NativeCashState?,
    internetAvailable: Boolean,
    busy: Boolean,
    message: String?,
    onSynchronize: () -> Unit,
) {
    FormColumn(if (internetAvailable) copy.readyOnlineCash else copy.readyOfflineCash) {
        Text(if (cashState == null) copy.cashDisabledStore else copy.cashNeedsSync)
        if (cashState != null) {
            OutlinedButton(
                onClick = onSynchronize,
                enabled = internetAvailable && !busy,
                modifier = Modifier.fillMaxWidth(),
            ) { Text(if (busy) copy.synchronizing else copy.syncLocalData) }
        }
        ErrorText(message)
    }
}

@Composable
private fun SaleStatusPill(copy: NativePosCopy, internetAvailable: Boolean, pendingSales: Int) {
    val statusColor = if (internetAvailable) Color(0xFF16803A) else Color(0xFFD06B16)
    val statusLabel = if (internetAvailable) copy.online else copy.offlineTill
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(if (internetAvailable) Color(0xFFE7F6EC) else Color(0xFFFFF0DD))
            .padding(horizontal = 10.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(7.dp).clip(CircleShape).background(statusColor))
        Text(
            if (pendingSales > 0) copy.pendingSyncSuffix.format(statusLabel, pendingSales) else statusLabel,
            color = statusColor,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
private fun ProductCatalogCard(
    copy: NativePosCopy,
    product: NativeProduct,
    cartQuantity: Long,
    offlineMode: Boolean,
    busy: Boolean,
    onAdd: () -> Unit,
    onRemove: () -> Unit,
) {
    val offlineStockUnavailable = offlineMode && !canAddOffline(product, cartQuantity + 1)
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(0.86f)
            .clickable(enabled = !offlineStockUnavailable && !busy, onClick = onAdd),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = POS_PANEL_BACKGROUND),
    ) {
        Column(
            modifier = Modifier.fillMaxSize().padding(12.dp),
            verticalArrangement = Arrangement.SpaceBetween,
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(58.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(if (offlineStockUnavailable) Color(0xFFF0EDF3) else Color(0xFFECE6F7)),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    product.name.take(1).uppercase(),
                    color = if (offlineStockUnavailable) POS_MUTED else POS_ACCENT,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                )
            }
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    product.name,
                    color = POS_INK,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(product.sku, color = POS_MUTED, style = MaterialTheme.typography.labelSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(formatMoney(product.amountMinor, product.currency), color = POS_INK, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            }
            if (offlineStockUnavailable) {
                Text(copy.offlineStockShortShort, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.labelSmall)
            } else if (cartQuantity == 0L) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                ) {
                    Text(copy.addPlus, color = POS_ACCENT, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
                }
            } else {
                CartQuantityStepper(quantity = cartQuantity, onAdd = onAdd, onRemove = onRemove)
            }
        }
    }
}

@Composable
private fun CartQuantityStepper(quantity: Long, onAdd: () -> Unit, onRemove: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        OutlinedButton(onClick = onRemove, modifier = Modifier.size(34.dp), contentPadding = PaddingValues(0.dp)) { Text("−") }
        Text(quantity.toString(), color = POS_INK, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
        Button(
            onClick = onAdd,
            modifier = Modifier.size(34.dp),
            contentPadding = PaddingValues(0.dp),
            colors = ButtonDefaults.buttonColors(containerColor = POS_ACCENT),
        ) { Text("+") }
    }
}

@Composable
internal fun CheckoutPanel(
    cart: NativePosCart,
    timeZone: String,
    busy: Boolean,
    copy: NativePosCopy,
    message: String?,
    checkoutSettings: NativeCheckoutSettings,
    receiptPrinterConfigured: Boolean,
    internetAvailable: Boolean,
    canManageSensitiveOperations: Boolean,
    onRefreshPricing: suspend (NativePosCart, String?, String?) -> NativeCartPricing,
    onAddProduct: (NativeCartLine) -> Unit,
    onRemoveProduct: (NativeCartLine) -> Unit,
    onClearProduct: (String) -> Unit,
    onRemoveTicketItem: (String) -> Unit,
    onCheckout: (NativeCheckoutRequest) -> Unit,
    modifier: Modifier = Modifier.fillMaxWidth(),
    persistent: Boolean = false,
    customers: List<NativeCustomer> = emptyList(),
    onSearchCustomers: suspend (String) -> List<NativeCustomer> = { emptyList() },
    onSelectCustomer: (NativeCustomer?) -> Unit = {},
) {
    val taxReady = rememberNativeTaxCheckoutReady(checkoutSettings)
    val itemCount = cart.itemCount
    val totalMinor = cart.totalMinor
    var checkoutOpen by remember { mutableStateOf(false) }
    var cartDrawerOpen by remember { mutableStateOf(false) }
    Card(
        modifier = modifier,
        shape = if (persistent) RoundedCornerShape(20.dp) else RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
        colors = CardDefaults.cardColors(containerColor = POS_PANEL_BACKGROUND),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(copy.cartTitle, color = POS_INK, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text(if (itemCount == 0L) copy.noItemsSelected else copy.itemsCountSuffix.format(itemCount), color = POS_MUTED, style = MaterialTheme.typography.labelMedium)
            }
            NativeSaleCustomerSelector(copy, cart, customers, internetAvailable, busy, onSearchCustomers, onSelectCustomer)
            OutlinedButton(
                onClick = { cartDrawerOpen = true },
                enabled = !busy && !cart.isEmpty,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
            ) {
                Text(if (cart.isEmpty) copy.cartEmptyShort else copy.viewCartDetail.format(itemCount))
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(copy.amountDueShort, color = POS_MUTED, style = MaterialTheme.typography.bodyMedium)
                Text(formatMoney(totalMinor, cart.currency), color = POS_INK, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            }
            message?.let {
                Text(
                    it,
                    color = if (it.startsWith(copy.cashOrderPrefix)) Color(0xFF16803A) else MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            Button(
                onClick = { if (checkoutSettings.taxReadyForCheckout()) checkoutOpen = true },
                enabled = !cart.isEmpty && !busy && taxReady,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(containerColor = POS_ACCENT),
            ) { Text(if (busy) copy.saving else copy.pay) }
        }
    }
    if (cartDrawerOpen) {
        NativeCartDrawer(copy,
            cart = cart,
            busy = busy,
            checkoutAllowed = taxReady,
            onDismiss = { cartDrawerOpen = false },
            onAddProduct = onAddProduct,
            onRemoveProduct = onRemoveProduct,
            onClearProduct = onClearProduct,
            onRemoveTicketItem = onRemoveTicketItem,
            onCheckout = {
                cartDrawerOpen = false
                if (checkoutSettings.taxReadyForCheckout()) checkoutOpen = true
            },
        )
    }
    if (checkoutOpen) {
        NativeCheckoutDialog(
            cart = cart,
            timeZone = timeZone,
            busy = busy,
            copy = copy,
            checkoutSettings = checkoutSettings,
            receiptPrinterConfigured = receiptPrinterConfigured,
            internetAvailable = internetAvailable,
            canManageSensitiveOperations = canManageSensitiveOperations,
            onRefreshPricing = onRefreshPricing,
            onDismiss = { checkoutOpen = false },
            onConfirm = { checkoutRequest ->
                checkoutOpen = false
                onCheckout(checkoutRequest)
            },
        )
    }
}

/** Compact checkout stays on the sales screen; all editable cart lines live in this drawer. */
@Composable
private fun NativeCartDrawer(
    copy: NativePosCopy,
    cart: NativePosCart,
    busy: Boolean,
    onDismiss: () -> Unit,
    onAddProduct: (NativeCartLine) -> Unit,
    onRemoveProduct: (NativeCartLine) -> Unit,
    onClearProduct: (String) -> Unit,
    onRemoveTicketItem: (String) -> Unit,
    onCheckout: () -> Unit,
    checkoutAllowed: Boolean,
) {
    Dialog(
        onDismissRequest = { if (!busy) onDismiss() },
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
            val targetWidth = when (nativePosScreenClass()) {
                NativePosScreenClass.Expanded -> 460.dp
                NativePosScreenClass.Medium -> 416.dp
                NativePosScreenClass.Compact -> 368.dp
            }
            Surface(
                modifier = Modifier
                    .fillMaxHeight()
                    .width(minOf(maxWidth, targetWidth))
                    .align(Alignment.CenterEnd),
                color = POS_PAGE_BACKGROUND,
                shadowElevation = 16.dp,
            ) {
                Column(
                    modifier = Modifier.fillMaxSize().systemBarsPadding().padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text(copy.cartDetail, color = POS_INK, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                            Text("${copy.itemsCountSuffix.format(cart.itemCount)} · ${formatMoney(cart.totalMinor, cart.currency)}", color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                        }
                        TextButton(onClick = onDismiss, enabled = !busy) { Text(copy.close) }
                    }
                    cart.customer?.let { customer ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(14.dp),
                            colors = CardDefaults.cardColors(containerColor = Color(0xFFF1EDF8)),
                        ) {
                            Text(copy.customerPrefixShort.format(customer.name), modifier = Modifier.padding(12.dp), color = POS_INK, style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                    LazyColumn(
                        modifier = Modifier.weight(1f).fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                        contentPadding = PaddingValues(bottom = 8.dp),
                    ) {
                        items(cart.products, key = { "product:${it.skuId}" }) { line ->
                            NativeCheckoutProductLine(
                                copy,
                                line = line,
                                busy = busy,
                                onAdd = { onAddProduct(line) },
                                onRemove = { onRemoveProduct(line) },
                                onDelete = { onClearProduct(line.skuId) },
                            )
                        }
                        items(cart.ticketItems, key = { "ticket-item:${it.ticketItemId}" }) { line ->
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(14.dp),
                                colors = CardDefaults.cardColors(containerColor = Color(0xFFF8F7FB)),
                            ) {
                                Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Text(line.name, color = POS_INK, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                                    Text("${line.ticketCode} · ×${line.quantity}", color = POS_MUTED, style = MaterialTheme.typography.labelSmall)
                                    TextButton(onClick = { onRemoveTicketItem(line.ticketItemId) }, enabled = !busy, contentPadding = PaddingValues(0.dp)) {
                                        Text(copy.removeServiceItem, color = MaterialTheme.colorScheme.error)
                                    }
                                }
                            }
                        }
                    }
                    if (!checkoutAllowed) Text(copy.checkoutSetupRequired, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                    Button(
                        onClick = onCheckout,
                        enabled = !cart.isEmpty && !busy && checkoutAllowed,
                        modifier = Modifier.fillMaxWidth().height(52.dp),
                        shape = RoundedCornerShape(16.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = POS_ACCENT),
                    ) { Text(copy.goToPayment) }
                }
            }
        }
    }
}

/** Mirrors POS Web's cart row: quantity can be changed or the line can be removed in one place. */
@Composable
private fun NativeCheckoutProductLine(
    copy: NativePosCopy,
    line: NativeCartLine,
    busy: Boolean,
    onAdd: () -> Unit,
    onRemove: () -> Unit,
    onDelete: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFFF8F7FB)),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(10.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(line.name, color = POS_INK, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(line.skuId, color = POS_MUTED, style = MaterialTheme.typography.labelSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                TextButton(onClick = onDelete, enabled = !busy, contentPadding = PaddingValues(horizontal = 4.dp, vertical = 0.dp)) {
                    Text(copy.delete, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.labelSmall)
                }
            }
            CartQuantityStepper(quantity = line.quantity, onAdd = onAdd, onRemove = onRemove)
        }
    }
}

/**
 * The checkout step deliberately mirrors POS Web: the cashier confirms the
 * tender on a dedicated cash screen instead of typing it into the cart. Exact
 * tender is preselected; free-form entry is only for a note that needs change.
 */
@Composable
internal fun NativeCheckoutDialog(
    cart: NativePosCart,
    timeZone: String,
    busy: Boolean,
    copy: NativePosCopy,
    checkoutSettings: NativeCheckoutSettings,
    receiptPrinterConfigured: Boolean,
    internetAvailable: Boolean,
    canManageSensitiveOperations: Boolean,
    onRefreshPricing: suspend (NativePosCart, String?, String?) -> NativeCartPricing,
    onDismiss: () -> Unit,
    onConfirm: (NativeCheckoutRequest) -> Unit,
) {
    var discountCode by remember(cart.checkoutId) { mutableStateOf("") }
    var discountReason by remember(cart.checkoutId) { mutableStateOf("") }
    var taxExemptionReason by remember(cart.checkoutId) { mutableStateOf("") }
    val taxReady = rememberNativeTaxCheckoutReady(checkoutSettings)
    val paymentOptions = buildList {
        if ("cash" in checkoutSettings.paymentMethodsEnabled) add("cash")
        if (internetAvailable && "app" in checkoutSettings.paymentMethodsEnabled) {
            checkoutSettings.mobileMoneyProvidersEnabled.filter { it in setOf("wave", "orange_money") }.forEach(::add)
        }
        if (internetAvailable && cart.customer != null && canManageSensitiveOperations) add("later")
    }
    val preferredPayment = when (checkoutSettings.defaultPaymentMethod) {
        "app" -> paymentOptions.firstOrNull { it == "wave" || it == "orange_money" }
        else -> paymentOptions.firstOrNull { it == checkoutSettings.defaultPaymentMethod }
    } ?: paymentOptions.firstOrNull().orEmpty()
    var paymentMethod by remember(cart.checkoutId, preferredPayment) { mutableStateOf(preferredPayment) }
    var externalReference by remember(cart.checkoutId) { mutableStateOf("") }
    var balanceDueAtText by remember(cart.checkoutId) { mutableStateOf("") }
    var unpaidReason by remember(cart.checkoutId) { mutableStateOf("") }
    val cashPayment = paymentMethod == "cash"
    val deferredPayment = paymentMethod == "later"
    var pricing by remember(cart.checkoutId) {
        mutableStateOf(calculateNativeLocalPricing(cart, checkoutSettings, null))
    }
    var pricingLoading by remember(cart.checkoutId) { mutableStateOf(internetAvailable) }
    var pricingError by remember(cart.checkoutId) { mutableStateOf<String?>(null) }
    val normalizedDiscountCode = discountCode.trim().takeIf { it.isNotEmpty() }
    val normalizedTaxExemption = taxExemptionReason.trim().takeIf { it.isNotEmpty() }

    LaunchedEffect(
        cart.checkoutId,
        cart.products,
        cart.ticketItems,
        cart.customer,
        internetAvailable,
        normalizedDiscountCode,
        normalizedTaxExemption,
    ) {
        pricingLoading = true
        pricingError = null
        runCatching {
            onRefreshPricing(cart, normalizedDiscountCode, normalizedTaxExemption)
        }.onSuccess { refreshed ->
            pricing = refreshed
        }.onFailure { error ->
            pricingError = error.userMessage(copy)
        }
        pricingLoading = false
    }

    var cashRoundingStep by remember(pricing.totalMinor) {
        mutableStateOf(checkoutSettings.cashRoundingStep.takeIf { it > 1 } ?: 5)
    }
    val totalMinor = if (cashPayment) applyNativeCashRounding(pricing.totalMinor, cashRoundingStep) else pricing.totalMinor
    val cashRoundingDiscountMinor = pricing.totalMinor - totalMinor
    var selectedTenderedMinor by remember(totalMinor) { mutableStateOf(totalMinor) }
    var customTenderedText by remember(totalMinor) { mutableStateOf("") }
    var useCustomTender by remember(totalMinor) { mutableStateOf(false) }
    var receiptDelivery by remember(receiptPrinterConfigured, checkoutSettings.autoPrintReceipt) {
        mutableStateOf(
            if (receiptPrinterConfigured && checkoutSettings.autoPrintReceipt) {
                NativeReceiptDelivery.Print
            } else {
                NativeReceiptDelivery.None
            },
        )
    }
    val customTenderedMinor = customTenderedText.takeIf { it.isNotBlank() }?.let(::parseMoney)
    val tenderedMinor = if (!cashPayment) totalMinor else if (useCustomTender) customTenderedMinor else selectedTenderedMinor
    val isTenderValid = !cashPayment || (tenderedMinor != null && tenderedMinor >= totalMinor)
    val changeMinor = tenderedMinor?.let { (it - totalMinor).coerceAtLeast(0) } ?: 0
    val discountValid = normalizedDiscountCode == null || discountReason.trim().length >= 3
    val pricingReady = !pricingLoading && pricingError == null
    val balanceDueAt = if (deferredPayment) localTicketDateTimeToIso(balanceDueAtText, timeZone) else null
    val paymentDetailsValid = when (paymentMethod) {
        "cash" -> true
        "wave", "orange_money" -> internetAvailable && externalReference.trim().length >= 3
        "later" -> internetAvailable && cart.customer != null && unpaidReason.trim().length >= 3 &&
            balanceDueAt != null && runCatching { java.time.Instant.parse(balanceDueAt).toEpochMilli() > NativeServerClock.now() }.getOrDefault(false)
        else -> false
    }

    Dialog(onDismissRequest = { if (!busy) onDismiss() }) {
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(24.dp),
            color = POS_PAGE_BACKGROUND,
            shadowElevation = 12.dp,
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text(copy.confirmPayment, color = POS_INK, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                        Text(if (internetAvailable) copy.paymentChoiceHint else copy.cashOnlyNotice, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                    }
                    TextButton(onClick = onDismiss, enabled = !busy) { Text(copy.back) }
                }

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(18.dp),
                    colors = CardDefaults.cardColors(containerColor = POS_PANEL_BACKGROUND),
                ) {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Text(copy.amountDue, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                        Text(formatMoney(totalMinor, cart.currency), color = POS_INK, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                        Text(copy.itemsCashSuffix.format(cart.itemCount), color = POS_MUTED, style = MaterialTheme.typography.labelMedium)
                    }
                }

                NativeTaxReadinessNotice(copy, checkoutSettings, if (canManageSensitiveOperations) "manager" else "cashier", busy)
                if (paymentOptions.isEmpty()) {
                    Text(copy.noPaymentMethods, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                } else {
                    Text(copy.paymentMethodLabel, color = POS_INK, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    paymentOptions.chunked(2).forEach { row ->
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            row.forEach { option ->
                                OutlinedButton(
                                    onClick = { paymentMethod = option },
                                    enabled = !busy,
                                    modifier = Modifier.weight(1f),
                                ) { Text((if (paymentMethod == option) "✓ " else "") + when (option) {
                                    "cash" -> copy.cashCollection
                                    "wave" -> "Wave"
                                    "orange_money" -> "Orange Money"
                                    else -> copy.payLater
                                }) }
                            }
                        }
                    }
                }
                if (paymentMethod == "wave" || paymentMethod == "orange_money") {
                    NativePosInput(
                        value = externalReference,
                        onValueChange = { externalReference = it },
                        label = { Text(copy.paymentReference) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Text(copy.manualPaymentPendingHint, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                }
                if (deferredPayment) {
                    NativePosInput(value = balanceDueAtText, onValueChange = { balanceDueAtText = it }, label = { Text(copy.balanceDueAt) }, placeholder = { Text("2026-10-05 18:00") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    NativePosInput(value = unpaidReason, onValueChange = { unpaidReason = it }, label = { Text(copy.unpaidReason) }, modifier = Modifier.fillMaxWidth())
                }

                if (pricingLoading) {
                    Text(copy.verifyingPricing, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                } else if (pricingError != null) {
                    Text(copy.pricingFailed.format(pricingError), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                } else {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(18.dp),
                        colors = CardDefaults.cardColors(containerColor = POS_PANEL_BACKGROUND),
                    ) {
                        Column(
                            modifier = Modifier.fillMaxWidth().padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(7.dp),
                        ) {
                            NativeCheckoutAmountRow(copy.productsAndServices, pricing.subtotalMinor, cart.currency)
                            pricing.discounts.forEach { discount ->
                                NativeCheckoutAmountRow(discount.title, -discount.amountMinor, cart.currency, Color(0xFF16803A))
                            }
                            // One row per rate, as the receipt prints them: a basket of
                            // standard-rated and exempt items shows only the tax it pays.
                            pricing.taxBreakdown.filter { it.taxMinor != 0L }.forEach { entry ->
                                val components = pricing.taxComponents.filter { it.parentRate == entry.taxRate }
                                if (components.isNotEmpty()) {
                                    components.forEach { component ->
                                        NativeCheckoutAmountRow("${component.name} ${formatNativeTaxRate(component.rate)}" + if (pricing.pricesIncludeTax) copy.taxIncluded else "", component.taxMinor, cart.currency)
                                    }
                                } else {
                                    val taxLabel = (pricing.taxLabel?.let { "$it ${formatNativeTaxRate(entry.taxRate)}" }
                                        ?: copy.taxLabelWithRate.format(formatNativeTaxRate(entry.taxRate))) + if (pricing.pricesIncludeTax) copy.taxIncluded else ""
                                    NativeCheckoutAmountRow(taxLabel, entry.taxMinor, cart.currency)
                                }
                            }
                            if (pricing.roundingAdjustmentMinor != 0L) {
                                NativeCheckoutAmountRow(copy.systemRounding, pricing.roundingAdjustmentMinor, cart.currency)
                            }
                            if (cashRoundingDiscountMinor > 0L) {
                                NativeCheckoutAmountRow(copy.cashRoundingLine, -cashRoundingDiscountMinor, cart.currency, Color(0xFF16803A))
                            }
                        }
                    }
                }

                if (canManageSensitiveOperations) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(copy.discountsAndTax, color = POS_INK, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        NativePosInput(
                            value = discountCode,
                            onValueChange = { discountCode = it },
                            label = { Text(copy.discountCodeOptional) },
                            singleLine = true,
                            enabled = !busy && internetAvailable,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        if (normalizedDiscountCode != null) {
                            NativePosInput(
                                value = discountReason,
                                onValueChange = { discountReason = it },
                                label = { Text(copy.discountReason) },
                                singleLine = true,
                                enabled = !busy && internetAvailable,
                                modifier = Modifier.fillMaxWidth(),
                            )
                        }
                        if (pricing.taxMinor != 0L) {
                            NativePosInput(
                                value = taxExemptionReason,
                                onValueChange = { taxExemptionReason = it },
                                label = { Text(copy.taxExemptReason) },
                                singleLine = true,
                                enabled = !busy && internetAvailable,
                                modifier = Modifier.fillMaxWidth(),
                            )
                        }
                        if (!internetAvailable) {
                            Text(copy.noOfflineDiscounts, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }

                if (cashPayment) Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(copy.cashRoundingLine, color = POS_INK, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text(copy.cashRoundingHint, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                    listOf(1, 5, 10, 25, 50, 100).chunked(3).forEach { row ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            row.forEach { step ->
                                val selected = cashRoundingStep == step
                                Button(
                                    onClick = { cashRoundingStep = step },
                                    enabled = !busy && pricingReady,
                                    modifier = Modifier.weight(1f),
                                    shape = RoundedCornerShape(12.dp),
                                    colors = if (selected) ButtonDefaults.buttonColors(containerColor = POS_ACCENT) else ButtonDefaults.buttonColors(containerColor = POS_PANEL_BACKGROUND, contentColor = POS_INK),
                                ) { Text(if (step == 1) copy.noRounding else "$step") }
                            }
                        }
                    }
                }

                if (cashPayment) Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(copy.cashReceivedTitle, color = POS_INK, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text(copy.chooseTenderedAmount, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                    cashTenderPresets(totalMinor, cart.currency).chunked(2).forEach { row ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            row.forEach { amount ->
                                val selected = !useCustomTender && selectedTenderedMinor == amount
                                Button(
                                    onClick = {
                                        selectedTenderedMinor = amount
                                        customTenderedText = ""
                                        useCustomTender = false
                                    },
                                    enabled = !busy,
                                    modifier = Modifier.weight(1f),
                                    shape = RoundedCornerShape(14.dp),
                                    colors = if (selected) {
                                        ButtonDefaults.buttonColors(containerColor = POS_ACCENT)
                                    } else {
                                        ButtonDefaults.buttonColors(
                                            containerColor = POS_PANEL_BACKGROUND,
                                            contentColor = POS_INK,
                                        )
                                    },
                                ) { Text(formatMoney(amount, cart.currency)) }
                            }
                        }
                    }
                    OutlinedButton(
                        onClick = { useCustomTender = true },
                        enabled = !busy,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp),
                    ) { Text(copy.otherAmount) }
                    if (useCustomTender) {
                        NativePosInput(
                            value = customTenderedText,
                            onValueChange = { customTenderedText = it.filter { char -> char.isDigit() || char == '.' } },
                            label = { Text(copy.enterCashReceived) },
                            placeholder = { Text(copy.amountPlaceholder) },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                }

                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(copy.receiptDelivery, color = POS_INK, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        NativeReceiptDeliveryButton(copy,
                            label = copy.receiptPrint,
                            selected = receiptDelivery == NativeReceiptDelivery.Print,
                            enabled = !busy && receiptPrinterConfigured,
                            onClick = { receiptDelivery = NativeReceiptDelivery.Print },
                            modifier = Modifier.weight(1f),
                        )
                        NativeReceiptDeliveryButton(copy,
                            label = copy.noSend,
                            selected = receiptDelivery == NativeReceiptDelivery.None,
                            enabled = !busy,
                            onClick = { receiptDelivery = NativeReceiptDelivery.None },
                            modifier = Modifier.weight(1f),
                        )
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        NativeReceiptDeliveryButton(copy,
                            label = if (checkoutSettings.emailReceiptEnabled) copy.emailReceipt else copy.emailNotConfigured,
                            selected = receiptDelivery == NativeReceiptDelivery.Email,
                            enabled = !busy && checkoutSettings.emailReceiptEnabled,
                            onClick = { receiptDelivery = NativeReceiptDelivery.Email },
                            modifier = Modifier.weight(1f),
                        )
                        NativeReceiptDeliveryButton(copy,
                            label = copy.smsNotConfigured,
                            selected = receiptDelivery == NativeReceiptDelivery.Sms,
                            enabled = false,
                            onClick = { receiptDelivery = NativeReceiptDelivery.Sms },
                            modifier = Modifier.weight(1f),
                        )
                    }
                    if (!receiptPrinterConfigured) {
                        Text(copy.bindDefaultPrinterFirst, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                    }
                }

                if (cashPayment) Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(18.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFE7F6EC)),
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(copy.changeLabel, color = Color(0xFF16803A), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Text(
                            formatMoney(changeMinor, cart.currency),
                            color = Color(0xFF16803A),
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }

                if (cashPayment && useCustomTender && customTenderedMinor == null) {
                    Text(copy.enterValidTender, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                } else if (tenderedMinor != null && tenderedMinor < totalMinor) {
                    Text(copy.tenderBelowTotal, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                }

                Button(
                    onClick = {
                        tenderedMinor?.let { tendered ->
                            onConfirm(
                                NativeCheckoutRequest(
                                    expectedTotalMinor = totalMinor,
                                    tenderedMinor = tendered,
                                    paymentMethod = paymentMethod,
                                    externalReference = externalReference.trim().takeIf { it.isNotEmpty() },
                                    balanceDueAt = balanceDueAt,
                                    unpaidReason = unpaidReason.trim().takeIf { it.isNotEmpty() },
                                    discountCode = normalizedDiscountCode,
                                    discountReason = discountReason.trim().takeIf { it.isNotEmpty() },
                                    taxExemptionReason = normalizedTaxExemption,
                                    cashRoundingStep = cashRoundingStep.takeIf { cashPayment && it > 1 },
                                    receiptDelivery = receiptDelivery,
                                    pricing = pricing,
                                ),
                            )
                        }
                    },
                    enabled = !busy && taxReady && pricingReady && isTenderValid && discountValid && paymentDetailsValid,
                    modifier = Modifier.fillMaxWidth().height(54.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = POS_ACCENT),
                ) { Text(if (busy) copy.saving else copy.confirmCollection) }
            }
        }
    }
}

@Composable
private fun NativeCheckoutAmountRow(label: String, amountMinor: Long, currency: String, color: Color = POS_MUTED) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, color = color, style = MaterialTheme.typography.bodySmall)
        Text(
            text = if (amountMinor < 0) "−${formatMoney(-amountMinor, currency)}" else formatMoney(amountMinor, currency),
            color = color,
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
private fun NativeReceiptDeliveryButton(
    copy: NativePosCopy,
    label: String,
    selected: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier,
        shape = RoundedCornerShape(12.dp),
        colors = if (selected) {
            ButtonDefaults.buttonColors(containerColor = POS_ACCENT)
        } else {
            ButtonDefaults.buttonColors(containerColor = POS_PANEL_BACKGROUND, contentColor = POS_INK)
        },
    ) { Text(label, maxLines = 1, overflow = TextOverflow.Ellipsis) }
}

private fun List<NativeCartLine>.upsert(product: NativeProduct, quantity: Long): List<NativeCartLine> {
    val line = NativeCartLine(product.skuId, product.name, product.amountMinor, quantity, product.taxRate)
    return if (any { it.skuId == product.skuId }) map { if (it.skuId == product.skuId) line else it } else this + line
}

private fun JSONArray?.toNativeHardwareDevices(): List<NativeHardwareDevice> = buildList {
    if (this@toNativeHardwareDevices == null) return@buildList
    for (index in 0 until this@toNativeHardwareDevices.length()) {
        val value = this@toNativeHardwareDevices.optJSONObject(index) ?: continue
        val id = value.optString("id").takeIf { it.isNotBlank() } ?: continue
        val name = value.optString("name").takeIf { it.isNotBlank() } ?: continue
        add(
            NativeHardwareDevice(
                id = id,
                name = name,
                deviceType = value.optString("deviceType", "other"),
                connectionType = value.optString("connectionType", "other"),
                provisioningMode = value.optString("provisioningMode", "manual"),
                hardwareKey = value.optString("hardwareKey").takeIf { it.isNotBlank() && it != "null" },
                status = value.optString("status", "inactive"),
                config = value.optJSONObject("config") ?: JSONObject(),
                version = value.optInt("version", 1),
            ),
        )
    }
}

private fun List<NativeHardwareDevice>.defaultReceiptPrinterId(): String? = firstNotNullOfOrNull { device ->
    if (device.deviceType != "printer" || device.status != "active") return@firstNotNullOfOrNull null
    if (device.config.optString("printerPurpose", "receipt") == "label") return@firstNotNullOfOrNull null
    if (!device.config.optBoolean("printerIsDefault")) return@firstNotNullOfOrNull null
    device.config.optString("printerId").trim().takeIf { it.isNotEmpty() && it != "null" }
}

private fun JSONArray?.toNativeMoreOrders(): List<NativeMoreOrder> = buildList {
    if (this@toNativeMoreOrders == null) return@buildList
    for (index in 0 until this@toNativeMoreOrders.length()) {
        val value = this@toNativeMoreOrders.optJSONObject(index) ?: continue
        val id = value.optString("id").takeIf { it.isNotBlank() } ?: continue
        add(NativeMoreOrder(
            id = id,
            customerName = value.optString("customerName").takeIf { it.isNotBlank() && it != "null" },
            totalAmount = value.optString("totalAmount", "0"),
            currency = value.optString("currency", ""),
            status = value.optString("status", "unknown"),
            paymentStatus = value.optString("paymentStatus", "unknown"),
            itemCount = value.optInt("itemCount", 0),
            createdAt = value.optString("createdAt", ""),
        ))
    }
}

internal fun JSONObject.toNativeMoreOrderDetail(paymentsPayload: JSONArray?): NativeMoreOrderDetail {
    val items = optJSONArray("items").toNativeMoreOrderItems()
    return NativeMoreOrderDetail(
        id = optString("id"),
        customerName = optString("customerName").takeIf { it.isNotBlank() && it != "null" },
        totalAmount = optString("totalAmount", "0"),
        paidAmount = optString("paidAmount", "0"),
        currency = optString("currency", "XOF"),
        status = optString("status", "unknown"),
        paymentStatus = optString("paymentStatus", "unknown"),
        version = optInt("version", 1),
        items = items,
        payments = paymentsPayload.toNativeMorePayments(),
        orderType = optString("orderType", "manual"),
        subtotalAmount = optString("subtotalAmount", "0"),
        discountAmount = optString("discountAmount", "0"),
        taxableAmount = optString("taxableAmount", "0"),
        taxAmount = optString("taxAmount", "0"),
        taxRate = optString("taxRateSnapshot", "0"),
        taxLabel = optionalNativeString("taxLabelSnapshot"),
        pricesIncludeTax = optBoolean("pricesIncludeTax", true),
        taxNumber = optionalNativeString("taxRegistrationNumberSnapshot"),
        taxExemptionReason = optionalNativeString("taxExemptionReason"),
        roundingAmount = optString("roundingAdjustmentAmount", "0"),
        createdAt = optionalNativeString("createdAt"),
        updatedAt = optionalNativeString("updatedAt"),
        dueAt = optionalNativeString("balanceDueAt"),
        notes = optionalNativeString("notes"),
        unpaidReason = optionalNativeString("unpaidReason"),
        taxLines = nativeOrderTaxLines(),
        discounts = nativeOrderDiscounts(),
        tickets = nativeOrderTicketReferences(),
    )
}

private fun JSONArray?.toNativeMoreOrderItems(): List<NativeMoreOrderItem> = buildList {
    if (this@toNativeMoreOrderItems == null) return@buildList
    for (index in 0 until this@toNativeMoreOrderItems.length()) {
        val value = this@toNativeMoreOrderItems.optJSONObject(index) ?: continue
        add(NativeMoreOrderItem(
            id = value.optString("id"),
            name = value.optString("itemName").ifBlank { nativePosCopy(null).orderItemFallback },
            quantity = value.optString("quantity", "1"),
            lineAmount = value.optString("lineAmount", "0"),
            unitAmount = value.optString("chargedUnitAmount", value.optString("unitAmount", "0")),
            sku = value.optionalNativeString("sku"),
            variantName = value.optionalNativeString("variantName"),
            weight = value.optionalNativeString("weight"),
            bagCount = if (value.isNull("bagCount") || !value.has("bagCount")) null else value.optInt("bagCount"),
            notes = listOfNotNull(value.optionalNativeString("itemColor"), value.optionalNativeString("defectNotes"), value.optionalNativeString("specialRequest"), value.optionalNativeString("itemIdentifier")).joinToString(" · ").takeIf { it.isNotBlank() },
            taxAmount = value.optString("taxAmount", "0"),
        ))
    }
}

private fun JSONArray?.toNativeMorePayments(): List<NativeMorePayment> = buildList {
    if (this@toNativeMorePayments == null) return@buildList
    for (index in 0 until this@toNativeMorePayments.length()) {
        val value = this@toNativeMorePayments.optJSONObject(index) ?: continue
        add(NativeMorePayment(
            id = value.optString("id"),
            method = value.optString("paymentMethod", "cash"),
            amount = value.optString("amount", "0"),
            tenderedAmount = value.optString("tenderedAmount").takeIf { it.isNotBlank() && it != "null" },
            changeAmount = value.optString("changeAmount").takeIf { it.isNotBlank() && it != "null" },
            status = value.optString("paymentStatus", "unknown"),
            provider = value.optString("provider").takeIf { it.isNotBlank() && it != "null" },
            externalReference = value.optString("externalReference").takeIf { it.isNotBlank() && it != "null" },
            createdAt = value.optString("createdAt", ""),
        ))
    }
}

private fun JSONArray?.toNativeMorePaymentAdjustments(): List<NativeMorePaymentAdjustment> = buildList {
    if (this@toNativeMorePaymentAdjustments == null) return@buildList
    for (index in 0 until this@toNativeMorePaymentAdjustments.length()) {
        val value = this@toNativeMorePaymentAdjustments.optJSONObject(index) ?: continue
        value.toNativeMorePaymentAdjustment()?.let(::add)
    }
}

private fun JSONObject.toNativeMorePaymentAdjustment(): NativeMorePaymentAdjustment? {
    val id = optString("id").takeIf { it.isNotBlank() } ?: return null
    return NativeMorePaymentAdjustment(
        id = id,
        originalPaymentId = optString("originalPaymentId").takeIf { it.isNotBlank() && it != "null" },
        type = optString("adjustmentType"),
        status = optString("status"),
        amount = optString("amount", "0"),
        reason = optString("reason"),
    )
}

private fun JSONObject.toNativeMoreSearchResults(): List<NativeMoreSearchResult> = buildList {
    val groups = optJSONObject("groups") ?: return@buildList
    listOf("tickets", "orders", "customers").forEach { group ->
        val entries = groups.optJSONArray(group) ?: return@forEach
        for (index in 0 until entries.length()) {
            val value = entries.optJSONObject(index) ?: continue
            val id = value.optString("id").takeIf { it.isNotBlank() } ?: continue
            add(NativeMoreSearchResult(
                id = id,
                type = value.optString("type", group.removeSuffix("s")),
                title = value.optString("title").ifBlank { id },
                subtitle = value.optString("subtitle").takeIf { it.isNotBlank() && it != "null" },
                badge = value.optString("badge").takeIf { it.isNotBlank() && it != "null" },
            ))
        }
    }
}

private fun JSONObject.toNativeMoreTicket(currency: String): NativeServiceTicket = NativeServiceTicket(
    id = optString("id"),
    ticketNo = optString("ticketNo").takeIf { it.isNotBlank() && it != "null" },
    customerId = optString("customerId"),
    customerName = optString("customerName").ifBlank { nativePosCopy(null).customerFallback },
    ticketType = optString("ticketType", "laundry"),
    ticketStatus = optString("ticketStatus", "pending"),
    priority = optString("priority", "normal"),
    itemCount = optLong("itemCount", 0),
    totalMinor = parseMoney(optString("totalAmount", "0")) ?: 0,
    currency = optString("currency").ifBlank { currency },
    expectedPickupAt = optString("expectedPickupAt").takeIf { it.isNotBlank() && it != "null" },
    createdAt = optString("createdAt", ""),
    updatedAt = optString("updatedAt", optString("createdAt", "")),
    version = optLong("version", 1),
)

private fun JSONObject.toNativeMoreCustomer(): NativeCustomer = NativeCustomer(
    id = optString("id"),
    accountId = optString("customerAccountId"),
    fullName = optString("fullName").ifBlank { nativePosCopy(null).customerFallback },
    accountName = optString("accountName").ifBlank { optString("fullName", nativePosCopy(null).customerFallback) },
    phone = optString("phone").takeIf { it.isNotBlank() && it != "null" },
    email = optString("email").takeIf { it.isNotBlank() && it != "null" },
    status = optString("status", "active"),
)

private fun toNativeMoreShiftData(
    copy: NativePosCopy,
    shift: JSONObject,
    register: JSONObject,
    reconciliation: JSONObject,
    movements: JSONObject,
    reports: JSONObject,
): NativeMoreShiftData {
    val registerSession = register.optJSONObject("registerSession")
    val cashSession = register.optJSONObject("cashSession")
    return NativeMoreShiftData(
        shiftStatus = shift.optString("status").takeIf { it.isNotBlank() && it != "null" },
        openingFloat = shift.optString("openingFloat").takeIf { it.isNotBlank() && it != "null" },
        cashHandlingMode = register.optString("cashHandlingMode", "none"),
        cashTrackingEnabled = register.optBoolean("cashTrackingEnabled", false),
        requireOpeningFloat = register.optBoolean("requireOpeningFloat", false),
        requireClosingCount = register.optBoolean("requireClosingCount", false),
        registerOpen = registerSession?.optString("status") == "open",
        cashSessionOpen = cashSession?.optString("status") == "open",
        currency = registerSession?.optString("currency").takeIf { !it.isNullOrBlank() } ?: "XOF",
        expectedCash = reconciliation.optString("expectedCash").takeIf { it.isNotBlank() && it != "null" },
        netSales = reconciliation.optString("netSales").takeIf { it.isNotBlank() && it != "null" },
        outstandingOrders = reconciliation.optInt("outstandingOrders", 0),
        movements = movements.optJSONArray("data").toNativeMoreCashMovements(),
        zReports = reports.optJSONArray("data").toNativeMoreZReports(),
    )
}

private fun JSONArray?.toNativeMoreCashMovements(): List<NativeMoreCashMovement> = buildList {
    if (this@toNativeMoreCashMovements == null) return@buildList
    for (index in 0 until this@toNativeMoreCashMovements.length()) {
        val value = this@toNativeMoreCashMovements.optJSONObject(index) ?: continue
        add(NativeMoreCashMovement(
            id = value.optString("id"),
            type = value.optString("movementType", "pay_out"),
            amount = value.optString("amount", "0"),
            currency = value.optString("currency", "XOF"),
            reason = value.optString("reason", ""),
            createdAt = value.optString("createdAt", ""),
        ))
    }
}

private fun JSONArray?.toNativeMoreZReports(): List<NativeMoreZReport> = buildList {
    if (this@toNativeMoreZReports == null) return@buildList
    for (index in 0 until this@toNativeMoreZReports.length()) {
        val value = this@toNativeMoreZReports.optJSONObject(index) ?: continue
        add(NativeMoreZReport(
            id = value.optString("id"),
            cutoffAt = value.optString("cutoffAt", ""),
            netSales = value.optString("netSales", "0"),
            expectedCash = value.optString("expectedCash", "0"),
            countedCash = value.optString("countedCash", "0"),
            variance = value.optString("variance", "0"),
            currency = value.optString("currency", "XOF"),
            orderCount = value.optInt("orderCount"),
            taxableAmount = value.optString("taxableAmount").takeIf { it.isNotBlank() && it != "null" },
            taxAmount = value.optString("taxAmount").takeIf { it.isNotBlank() && it != "null" },
            taxComponents = buildList {
                value.optJSONArray("taxComponents")?.let { components ->
                    for (componentIndex in 0 until components.length()) {
                        val component = components.optJSONObject(componentIndex) ?: continue
                        add(NativeMoreZTaxComponent(
                            name = component.optString("name"),
                            rate = component.optString("rate"),
                            taxAmount = component.optString("taxAmount", "0"),
                        ))
                    }
                }
            },
            refundAmount = value.optString("refundAmount", "0"),
            discountAmount = value.optString("discountAmount", "0"),
            paymentBreakdown = buildList {
                value.optJSONArray("paymentBreakdown")?.let { payments ->
                    for (paymentIndex in 0 until payments.length()) {
                        val payment = payments.optJSONObject(paymentIndex) ?: continue
                        add(NativeMoreZPayment(
                            method = payment.optString("method"),
                            provider = payment.optString("provider").takeIf { it.isNotBlank() && it != "null" },
                            netAmount = payment.optString("netAmount", "0"),
                        ))
                    }
                }
            },
        ))
    }
}

private fun buildNativeZReportCsv(report: NativeMoreZReport): String {
    val rows = listOf(
        listOf("Z Report", report.id),
        listOf("Date", report.cutoffAt),
        listOf("Currency", report.currency),
        listOf("Orders", report.orderCount.toString()),
        listOf("Taxable amount", report.taxableAmount.orEmpty()),
        listOf("Tax amount", report.taxAmount.orEmpty()),
        listOf("Discount", report.discountAmount),
        listOf("Refund", report.refundAmount),
        listOf("Net sales", report.netSales),
        listOf("Expected cash", report.expectedCash),
        listOf("Counted cash", report.countedCash),
        listOf("Variance", report.variance),
    ) + report.taxComponents.map { component ->
        listOf("${component.name} ${formatNativeTaxRate(component.rate)}", component.taxAmount)
    } + report.paymentBreakdown.map { payment ->
        listOf("${payment.method}${payment.provider?.let { " / $it" }.orEmpty()}", payment.netAmount)
    }
    fun escape(value: String): String = if (value.any { it == ',' || it == '"' || it == '\r' || it == '\n' }) {
        "\"${value.replace("\"", "\"\"")}\""
    } else value
    return "\uFEFF" + rows.joinToString("\r\n") { row -> row.joinToString(",") { escape(it) } } + "\r\n"
}

private fun JSONObject.toNativeMoreStatistics(): NativeMoreStatistics {
    val orders = optJSONObject("orders") ?: JSONObject()
    val tickets = optJSONObject("tickets") ?: JSONObject()
    val customers = optJSONObject("customers") ?: JSONObject()
    return NativeMoreStatistics(
        orderCount = orders.optInt("orderCount", 0),
        paidAmount = orders.optString("paidAmount", "0"),
        unpaidCount = orders.optInt("unpaidCount", 0),
        ticketTotal = tickets.optInt("total", 0),
        ticketOverdue = tickets.optInt("overdueCount", 0),
        customerTotal = customers.optInt("totalCount", 0),
        todayNewCustomers = customers.optInt("todayNewCount", 0),
    )
}

private fun JSONArray?.toNativeMoreNotifications(): List<NativeMoreNotification> = buildList {
    if (this@toNativeMoreNotifications == null) return@buildList
    for (index in 0 until this@toNativeMoreNotifications.length()) {
        val value = this@toNativeMoreNotifications.optJSONObject(index) ?: continue
        val deliveryId = value.optString("id").takeIf { it.isNotBlank() } ?: continue
        add(NativeMoreNotification(
            deliveryId = deliveryId,
            title = value.optString("title", nativePosCopy(null).notificationFallback),
            content = value.optString("content", ""),
            priority = value.optString("priority", "normal"),
            readStatus = value.optString("readStatus", "unread"),
            createdAt = value.optString("createdAt", ""),
            relatedType = value.optString("relatedType").takeIf { it.isNotBlank() && it != "null" },
            relatedId = value.optString("relatedId").takeIf { it.isNotBlank() && it != "null" },
        ))
    }
}

private fun JSONObject.toNativeTerminalSettingsSummary(branch: JSONObject? = null): NativeTerminalSettingsSummary = NativeTerminalSettingsSummary(
    label = optString("label").takeIf { it.isNotBlank() && it != "null" },
    cashHandlingMode = optString("cashHandlingMode", "unknown"),
    roundingRule = optString("roundingRule", "none"),
    lockTimeoutSeconds = optInt("lockTimeoutSeconds", 0),
    autoPrintReceipt = optBoolean("autoPrintReceipt"),
    printCopies = optInt("printCopies", 1),
    syncStatus = optString("syncStatus", "unknown"),
    lastSyncError = optString("lastSyncError").takeIf { it.isNotBlank() && it != "null" },
    branchAddress = branch?.optString("address")?.takeIf { it.isNotBlank() && it != "null" },
    branchPhone = branch?.optString("phone")?.takeIf { it.isNotBlank() && it != "null" },
)

private fun canAddOffline(product: NativeProduct, quantity: Long): Boolean =
    !product.trackInventory ||
        product.allowNegativeStock ||
        (product.availableQuantity != null &&
            product.availableQuantity - product.offlineStockBuffer - product.reservedOfflineQuantity >= quantity)
private fun canAddOnline(product: NativeProduct, quantity: Long): Boolean = !product.trackInventory || product.allowNegativeStock || (product.availableQuantity ?: 0) >= quantity
private fun parseMoney(value: String): Long? = runCatching { java.math.BigDecimal(value).movePointRight(2).setScale(0, java.math.RoundingMode.UNNECESSARY).longValueExact() }.getOrNull()
private fun refundMinorToMoney(value: Long): String = java.math.BigDecimal.valueOf(value, 2).toPlainString()

/** Same server price-preview endpoint that POS Web calls before it enables checkout. */
private fun previewNativeCartPricing(
    api: NativePosApiClient,
    cart: NativePosCart,
    branchId: String,
    discountCode: String?,
    taxExemptionReason: String?,
): NativeCartPricing {
    val response = api.post("/pos/carts/preview", JSONObject().apply {
        put("branchId", branchId)
        cart.customer?.let { put("customerId", it.id) }
        put("items", JSONArray().apply {
            cart.products.forEach { line ->
                put(JSONObject().apply {
                    put("productSkuId", line.skuId)
                    put("quantity", line.quantity.toString())
                })
            }
            cart.ticketItems.forEach { line ->
                put(JSONObject().apply {
                    put("ticketId", line.ticketId)
                    put("ticketItemId", line.ticketItemId)
                })
            }
        })
        discountCode?.takeIf { it.isNotBlank() }?.let { put("discountCode", it) }
        taxExemptionReason?.takeIf { it.isNotBlank() }?.let { put("taxExemptionReason", it) }
    })
    return response.toNativeCartPricing()
}

/** Order snapshots can differ from the preview even when an inclusive total stays unchanged. */
internal fun JSONObject.toNativeConfirmedPricing(): NativeCartPricing = JSONObject(toString()).apply {
    put("taxRate", optString("taxRateSnapshot", "0"))
    put("taxLabel", opt("taxLabelSnapshot"))
    put("taxRegistrationNumber", opt("taxRegistrationNumberSnapshot"))
    put("taxComponents", optJSONArray("taxComponentsSnapshot"))
    put("discounts", optJSONArray("discountApplications"))
}.toNativeCartPricing()

private fun JSONObject.toNativeCartPricing(): NativeCartPricing = NativeCartPricing(
    subtotalMinor = parseMoney(optString("subtotalAmount", "0")) ?: 0,
    discounts = buildList {
        val source = optJSONArray("discounts") ?: return@buildList
        for (index in 0 until source.length()) {
            val entry = source.optJSONObject(index) ?: continue
            add(
                NativeCartPricingDiscount(
                    title = entry.optString("title").ifBlank { entry.optString("code", nativePosCopy(null).discountFallback) },
                    amountMinor = parseMoney(entry.optString("amount", "0")) ?: 0,
                ),
            )
        }
    },
    discountMinor = parseMoney(optString("discountAmount", "0")) ?: 0,
    taxableMinor = parseMoney(optString("taxableAmount", "0")) ?: 0,
    taxMinor = parseMoney(optString("taxAmount", "0")) ?: 0,
    taxRate = optString("taxRate", "0.0000"),
    taxBreakdown = buildList {
        val source = optJSONArray("taxBreakdown") ?: return@buildList
        for (index in 0 until source.length()) {
            val entry = source.optJSONObject(index) ?: continue
            add(
                NativeTaxBreakdownEntry(
                    taxRate = entry.optString("taxRate", "0.0000"),
                    taxableMinor = parseMoney(entry.optString("taxableAmount", "0")) ?: 0,
                    taxMinor = parseMoney(entry.optString("taxAmount", "0")) ?: 0,
                ),
            )
        }
    },
    taxLabel = if (isNull("taxLabel")) null else optString("taxLabel").ifBlank { null },
    taxComponents = buildList {
        val source = optJSONArray("taxComponents") ?: return@buildList
        for (index in 0 until source.length()) {
            val entry = source.optJSONObject(index) ?: continue
            add(NativeTaxComponent(
                name = entry.optString("name"),
                rate = entry.optString("rate", "0.0000"),
                parentRate = entry.optString("parentRate"),
                taxableMinor = parseMoney(entry.optString("taxableAmount", "0")) ?: 0,
                taxMinor = parseMoney(entry.optString("taxAmount", "0")) ?: 0,
            ))
        }
    },
    pricesIncludeTax = optBoolean("pricesIncludeTax", true),
    taxRegistrationNumber = if (isNull("taxRegistrationNumber")) null else optString("taxRegistrationNumber").ifBlank { null },
    roundingAdjustmentMinor = parseSignedMoney(optString("roundingAdjustmentAmount", "0")),
    totalMinor = parseMoney(optString("totalAmount", "0")) ?: 0,
)

private fun applyNativeCashRounding(totalMinor: Long, cashRoundingStep: Int?): Long {
    val step = cashRoundingStep?.takeIf { it > 1 }?.toLong()?.times(100L) ?: return totalMinor
    return (totalMinor / step) * step
}

private fun parseSignedMoney(value: String): Long = runCatching {
    java.math.BigDecimal(value).movePointRight(2).setScale(0, java.math.RoundingMode.UNNECESSARY).longValueExact()
}.getOrDefault(0)

/** Suggested notes are rounded up from the amount due, while exact tender is always first. */
private fun cashTenderPresets(totalMinor: Long, currency: String): List<Long> {
    if (totalMinor <= 0) return listOf(0)
    val notesInMajor = nativeCashNoteLadder(currency)
    return buildList {
        add(totalMinor)
        notesInMajor.forEach { note ->
            val noteMinor = note * 100L
            add(((totalMinor + noteMinor - 1L) / noteMinor) * noteMinor)
        }
    }.distinct().take(4)
}

private fun isPositiveDecimal(value: String): Boolean = runCatching {
    java.math.BigDecimal(value).compareTo(java.math.BigDecimal.ZERO) > 0
}.getOrDefault(false)

private fun isAtLeast(value: String, minimum: String): Boolean = runCatching {
    java.math.BigDecimal(value).compareTo(java.math.BigDecimal(minimum)) >= 0
}.getOrDefault(false)

private fun outstandingAmount(total: String, paid: String): String = runCatching {
    java.math.BigDecimal(total).subtract(java.math.BigDecimal(paid)).max(java.math.BigDecimal.ZERO)
        .setScale(2, java.math.RoundingMode.HALF_UP)
        .toPlainString()
}.getOrDefault("0.00")

/** Converts the clerk's local input in the tenant business timezone to the API's ISO timestamp. */
internal fun localTicketDateTimeToIso(value: String, timeZone: String): String? = runCatching {
    val local = java.time.LocalDateTime.parse(value.trim().replace(' ', 'T'))
    local.atZone(java.time.ZoneId.of(timeZone)).toInstant().toString()
}.getOrNull()

private fun buildNativeReceiptDraft(
    copy: NativePosCopy,
    terminal: NativeTerminal?,
    cart: NativePosCart,
    pricing: NativeCartPricing,
    amountDueMinor: Long,
    tenderedMinor: Long,
    paymentMethod: String,
    externalReference: String?,
    balanceDueAt: String?,
    taxExemptionReason: String?,
    printSettings: NativeReceiptPrintSettings,
    receiptProfile: NativeReceiptProfile,
): NativeReceiptPrintDraft {
    val total = amountDueMinor
    val change = (tenderedMinor - total).coerceAtLeast(0)
    val terminalName = terminal?.terminalId?.takeLast(8)?.uppercase() ?: copy.thisTerminalFallback
    val issuedAt = runCatching {
        java.time.ZonedDateTime.now(java.time.ZoneId.of(terminal?.timeZone ?: "UTC"))
            .toLocalDateTime()
            .toString()
    }.getOrElse { java.time.Instant.now().toString() }
    return NativeReceiptPrintDraft(
        copies = printSettings.printCopies,
        content = buildList {
            add(terminal?.merchantName?.ifBlank { "CleanHub" } ?: "CleanHub")
            if (receiptProfile.shows("branch_name")) add(receiptProfile.name ?: terminal?.branchName.orEmpty())
            if (receiptProfile.shows("receipt_address")) receiptProfile.address?.let(::add)
            if (receiptProfile.shows("receipt_phone")) receiptProfile.phone?.let(::add)
            if (receiptProfile.shows("receipt_title")) add(if (paymentMethod == "cash") copy.cashReceipt else copy.paymentReceipt)
            if (receiptProfile.shows("receipt_number")) add(copy.receiptNumberLine.format(cart.checkoutId.takeLast(8).uppercase()))
            if (receiptProfile.shows("order_number")) add(copy.orderLinePrefix.format(cart.checkoutId.takeLast(8).uppercase()))
            if (receiptProfile.shows("terminal_name")) add(copy.terminalLinePrefix.format(terminalName))
            if (receiptProfile.shows("issued_at")) add(copy.timeLinePrefix.format(issuedAt))
            if (receiptProfile.shows("customer_name")) cart.customer?.let { add(copy.receiptCustomerPrefix.format(it.name)) }
            add("------------------------------")
            if (receiptProfile.shows("item_name")) {
                cart.products.forEach { line ->
                    add("${line.name}${if (receiptProfile.shows("item_quantity")) " ×${line.quantity}" else ""}${if (receiptProfile.shows("item_line_total")) "  ${formatMoney(line.amountMinor * line.quantity, cart.currency)}" else ""}")
                }
                cart.ticketItems.forEach { line ->
                    add("${line.name}${if (receiptProfile.shows("item_quantity")) " ×${line.quantity}" else ""}${if (receiptProfile.shows("item_line_total")) "  ${formatMoney(line.lineAmountMinor, cart.currency)}" else ""}")
                }
            }
            add("------------------------------")
            if (receiptProfile.shows("subtotal")) add(copy.receiptSubtotalPrefix.format(formatMoney(pricing.subtotalMinor, cart.currency)))
            if (receiptProfile.shows("discount")) pricing.discounts.forEach { discount ->
                add("${discount.title}  -${formatMoney(discount.amountMinor, cart.currency)}")
            }
            // Tax and registration number remain visible when present: they are
            // part of the fiscal record even if a legacy field list hides them.
            pricing.taxBreakdown.forEach { entry ->
                add(copy.receiptTaxableLine.format(
                    formatNativeTaxRate(entry.taxRate),
                    formatMoney(entry.taxableMinor, cart.currency),
                ))
                val components = pricing.taxComponents.filter { it.parentRate == entry.taxRate }
                if (components.isNotEmpty()) {
                    components.forEach { component ->
                        add("${component.name} ${formatNativeTaxRate(component.rate)}: ${formatMoney(component.taxMinor, cart.currency)}" + if (pricing.pricesIncludeTax) copy.taxIncluded else "")
                    }
                } else {
                    val label = pricing.taxLabel?.let { "$it ${formatNativeTaxRate(entry.taxRate)}" }
                        ?: copy.taxLabelWithRate.format(formatNativeTaxRate(entry.taxRate))
                    add("$label: ${formatMoney(entry.taxMinor, cart.currency)}" + if (pricing.pricesIncludeTax) copy.taxIncluded else "")
                }
            }
            // System rounding plus any cash rounding the cashier chose: the
            // amount due is what was actually collected against the total.
            val roundingMinor = total - (pricing.totalMinor - pricing.roundingAdjustmentMinor)
            if (roundingMinor != 0L && receiptProfile.shows("rounding")) {
                add(copy.receiptRoundingPrefix.format(formatSignedMoney(roundingMinor, cart.currency)))
            }
            add(copy.receiptDuePrefix.format(formatMoney(total, cart.currency)))
            if (paymentMethod == "cash") {
                if (receiptProfile.shows("cash_tendered")) add(copy.receiptTenderedPrefix.format(formatMoney(tenderedMinor, cart.currency)))
                if (change > 0 && receiptProfile.shows("change")) add(copy.receiptChangePrefix.format(formatMoney(change, cart.currency)))
            } else if (paymentMethod == "later") {
                add(copy.receiptPayLater.format(balanceDueAt.orEmpty()))
            } else {
                add(copy.receiptPendingPayment.format(paymentMethod, externalReference.orEmpty()))
            }
            pricing.taxRegistrationNumber?.let { add(copy.receiptTaxNumberPrefix.format(it)) }
            taxExemptionReason?.takeIf { it.isNotBlank() }?.let {
                add(copy.receiptTaxExemptionPrefix.format(it))
            }
            if (receiptProfile.shows("thank_you_message")) add(receiptProfile.thankYouMessage ?: copy.thankYou)
            add("")
        }.filter { it.isNotBlank() }.joinToString("\n"),
    )
}

internal fun formatMoney(minor: Long, currency: String): String = "%s %d.%02d".format(java.util.Locale.ROOT, currency, minor / 100, minor % 100)

private fun formatSignedMoney(minor: Long, currency: String): String =
    if (minor < 0) "-${formatMoney(-minor, currency)}" else formatMoney(minor, currency)

private fun formatNativeActivityTime(value: String): String {
    if (value.isBlank()) return nativePosCopy(null).justUpdated
    return runCatching {
        java.time.Instant.parse(value)
            .atZone(java.time.ZoneId.systemDefault())
            .format(java.time.format.DateTimeFormatter.ofPattern("MM-dd HH:mm"))
    }.getOrDefault(value)
}

private fun JSONArray?.toSetupBranches(): List<NativeSetupBranch> = buildList {
    if (this@toSetupBranches == null) return@buildList
    for (index in 0 until this@toSetupBranches.length()) {
        val branch = this@toSetupBranches.optJSONObject(index) ?: continue
        if (branch.optString("status") == "active") add(NativeSetupBranch(branch.getString("id"), branch.getString("name")))
    }
}
private fun Throwable.administratorLoginMessage(copy: NativePosCopy = nativePosCopy(null)): String {
    if (this is NativePosApiException) {
        return when (code) {
            "INVALID_CREDENTIALS" -> copy.invalidCredentials
            "ACCOUNT_LOCKED" -> copy.accountLocked
            else -> userMessage()
        }
    }
    return userMessage()
}

/**
 * A message the cashier can act on.
 *
 * `copy` carries the terminal's language. A server-supplied `message` is passed
 * through as-is: the API is not localised per terminal, so translating only the
 * device's own failures is the honest half of the job -- the rest is listed in
 * the review as still outstanding.
 */
private fun Throwable.userMessage(copy: NativePosCopy = nativePosCopy(null)): String = when (this) {
    // A transport failure now arrives as a NETWORK_ERROR rather than a raw
    // IOException, so it has to be recognised here or the cashier sees the
    // underlying socket message instead of something actionable.
    is NativePosApiException -> when {
        code == "INVALID_CREDENTIALS" -> copy.pinIncorrectShort
        code == "NETWORK_ERROR" -> copy.networkError
        else -> message ?: copy.cannotReachPos
    }
    is IOException -> copy.networkError
    is NativePosValidationException -> message ?: copy.invalidInput
    else -> copy.genericFailure
}
