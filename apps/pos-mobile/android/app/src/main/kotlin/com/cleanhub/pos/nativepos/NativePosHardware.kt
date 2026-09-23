package com.cleanhub.pos.nativepos

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.hardware.camera2.CameraManager
import android.os.Build
import android.os.IBinder
import android.os.RemoteException
import android.view.InputDevice
import androidx.core.content.ContextCompat
import net.nyx.printerservice.print.IPrinterService
import net.nyx.printerservice.print.PrintTextFormat
import java.io.IOException
import java.io.OutputStream
import java.util.UUID

/**
 * Direct Android adapter for the built-in peripherals used by the existing
 * POS Web Capacitor bridge. This keeps the installed Compose APK independent
 * of a WebView while preserving the same device ids and API hardware keys.
 */
internal data class NativeHardwareStatus(
    val host: String,
    val hardwareModel: String,
    val printerConnected: Boolean,
    val scannerConnected: Boolean,
    val cashDrawerConnected: Boolean,
    val printerStatus: String?,
    val printerStatusCode: Int?,
    val printerId: String?,
    val printerName: String?,
    val printerHardwareKey: String?,
    val scannerId: String?,
    val scannerName: String?,
    val scannerHardwareKey: String?,
)

internal data class NativeHardwareOperationResult(
    val success: Boolean,
    val message: String,
)

/** A printer already paired in Android system settings; pairing itself remains a system-owned action. */
internal data class NativeBluetoothPrinter(
    val id: String,
    val name: String,
)

private enum class NativeHardwareProfile(
    val host: String,
    val displayName: String,
    val printerPackage: String?,
    val printerAction: String?,
    val printerId: String?,
    val printerHardwareKey: String?,
    val scannerId: String?,
    val scannerHardwareKey: String?,
) {
    T1101(
        host = "pos-t1101",
        displayName = "POS-T1101",
        printerPackage = "net.nyx.printerservice",
        printerAction = "net.nyx.printerservice.IPrinterService",
        printerId = "t1101:built-in",
        printerHardwareKey = "t1101:built-in:printer",
        scannerId = "t1101:built-in",
        scannerHardwareKey = "t1101:built-in:scanner",
    ),
    T8(
        host = "pos-t8",
        displayName = "POS-T8",
        printerPackage = "com.incar.printerservice",
        printerAction = "com.incar.printerservice.IPrinterService",
        printerId = "t8:built-in",
        printerHardwareKey = "t8:built-in:printer",
        scannerId = "t8:built-in",
        scannerHardwareKey = "t8:built-in:scanner",
    ),
    Unsupported(
        host = "android",
        displayName = "Android POS",
        printerPackage = null,
        printerAction = null,
        printerId = null,
        printerHardwareKey = null,
        scannerId = null,
        scannerHardwareKey = null,
    ),
}

internal class NativePosHardware(
    context: Context,
    /**
     * Read per call rather than captured: the hardware object is remembered
     * for the life of the app, but the cashier can change language at the PIN
     * screen at any point, and a jammed printer must say so in the language
     * the person holding it chose.
     */
    private val languageCode: () -> String? = { null },
) {
    private val appContext = context.applicationContext
    private val copy: NativePosCopy get() = nativePosCopy(languageCode())
    private val profile = resolveProfile()
    private val scanListeners = linkedSetOf<(String) -> Unit>()

    @Volatile
    private var printerService: IPrinterService? = null
    private var serviceBound = false
    private var scannerReceiverRegistered = false
    private var closed = false

    private val printerConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            printerService = IPrinterService.Stub.asInterface(service)
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            printerService = null
            serviceBound = false
            bindPrinterService()
        }

        override fun onBindingDied(name: ComponentName?) {
            printerService = null
            serviceBound = false
            bindPrinterService()
        }
    }

    private val scannerReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val value = intent?.getStringExtra(SCANNER_VALUE)?.trim().orEmpty()
            if (value.isBlank() || value.length > MAX_SCAN_LENGTH) return
            val listeners = synchronized(scanListeners) { scanListeners.toList() }
            listeners.forEach { listener -> listener(value) }
        }
    }

    init {
        registerScannerReceiver()
        bindPrinterService()
    }

    fun addScanListener(listener: (String) -> Unit): () -> Unit {
        synchronized(scanListeners) { scanListeners += listener }
        return { synchronized(scanListeners) { scanListeners -= listener } }
    }

    /**
     * T8 terminals expose scanning through their system scanner activity rather
     * than the printer Binder interface. The caller must launch this from the
     * foreground Activity and pass its result back to [activityScanValue].
     */
    fun scannerActivityIntent(): Intent? {
        if (profile != NativeHardwareProfile.T8 || !hasCameraForSystemScanner()) return null
        val intent = Intent().setComponent(ComponentName(T8_SCANNER_PACKAGE, T8_SCANNER_ACTIVITY))
        return intent.takeIf { it.resolveActivity(appContext.packageManager) != null }
    }

    /** The NB55's actual built-in scan head is exposed as a USB keyboard wedge. */
    fun keyboardScannerAvailable(): Boolean = InputDevice.getDeviceIds().any { id ->
        InputDevice.getDevice(id)?.name?.let(::isKeyboardScannerName) == true
    }

    fun activityScanValue(data: Intent?): String? = data
        ?.getStringExtra(T8_SCANNER_RESULT)
        ?.trim()
        ?.takeIf { it.isNotEmpty() && it.length <= MAX_SCAN_LENGTH }

    /** Call on a worker dispatcher: vendor service queries are Binder RPCs. */
    fun status(): NativeHardwareStatus {
        val service = printerService
        if (service == null) {
            return baseStatus(false, null, null)
        }
        return try {
            val code = service.printerStatus
            baseStatus(true, code, printerStatusText(code))
        } catch (_: RemoteException) {
            printerService = null
            baseStatus(false, null, copy.hardwareServiceDisconnected)
        }
    }

    /** Permissions that must be requested from the foreground Activity before Bluetooth use. */
    fun missingBluetoothPermissions(): List<String> = buildList {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !hasBluetoothConnectPermission()) {
            add(Manifest.permission.BLUETOOTH_CONNECT)
        }
    }

    /** Call on a worker dispatcher. This is passive and never scans or pairs nearby devices. */
    fun pairedBluetoothPrinters(): List<NativeBluetoothPrinter> {
        if (!hasBluetoothConnectPermission()) {
            throw NativePosValidationException(copy.nearbyDevicesForPaired)
        }
        val adapter = BluetoothAdapter.getDefaultAdapter()
            ?: throw NativePosValidationException(copy.bluetoothUnsupported)
        if (!adapter.isEnabled) {
            throw NativePosValidationException(copy.bluetoothOff)
        }
        return try {
            adapter.bondedDevices
                .filterNot(::isBuiltInBluetoothAlias)
                .map { device ->
                    NativeBluetoothPrinter(
                        id = "$BLUETOOTH_PRINTER_PREFIX${device.address}",
                        name = device.name?.trim().takeUnless { it.isNullOrBlank() }
                            ?: copy.bluetoothDeviceFallback.format(device.address),
                    )
                }
                .sortedBy { it.name.lowercase() }
        } catch (_: SecurityException) {
            throw NativePosValidationException(copy.noPermissionReadPaired)
        }
    }

    /** Check the selected print route before claiming a durable receipt job. */
    fun printerReadiness(printerId: String?): NativeHardwareOperationResult {
        if (printerId.isNullOrBlank()) {
            return NativeHardwareOperationResult(false, copy.needDefaultPrinterRegistered)
        }
        if (isBluetoothPrinterId(printerId)) {
            if (!hasBluetoothConnectPermission()) {
                return NativeHardwareOperationResult(false, copy.nearbyDevicesToConnect)
            }
            val adapter = BluetoothAdapter.getDefaultAdapter()
                ?: return NativeHardwareOperationResult(false, copy.bluetoothUnsupported)
            if (!adapter.isEnabled) return NativeHardwareOperationResult(false, copy.bluetoothOff)
            return try {
                val address = printerId.removePrefix(BLUETOOTH_PRINTER_PREFIX)
                val device = adapter.getRemoteDevice(address)
                if (device.bondState != BluetoothDevice.BOND_BONDED) {
                    NativeHardwareOperationResult(false, copy.boundPrinterNotPaired)
                } else {
                    NativeHardwareOperationResult(true, copy.bluetoothPrinterReady)
                }
            } catch (_: IllegalArgumentException) {
                NativeHardwareOperationResult(false, copy.bluetoothAddressInvalid)
            } catch (_: SecurityException) {
                NativeHardwareOperationResult(false, copy.noPermissionConnectBluetooth)
            }
        }
        val service = printerService
            ?: return NativeHardwareOperationResult(false, copy.printServiceNotConnected.format(profile.displayName))
        if (printerId != profile.printerId) {
            return NativeHardwareOperationResult(false, copy.notDefaultPrinterQueued)
        }
        return try {
            val code = service.printerStatus
            if (code == 0) NativeHardwareOperationResult(true, copy.builtInPrinterReady)
            else NativeHardwareOperationResult(false, printerErrorMessage(code))
        } catch (_: RemoteException) {
            printerService = null
            NativeHardwareOperationResult(false, copy.printServiceDisconnected)
        }
    }

    /** Call on a worker dispatcher. */
    fun printReceipt(
        content: String,
        copies: Int,
        printerId: String? = profile.printerId,
    ): NativeHardwareOperationResult {
        if (isBluetoothPrinterId(printerId)) return printBluetoothReceipt(content, copies, printerId.orEmpty())
        if (printerId != profile.printerId) {
            return NativeHardwareOperationResult(false, copy.printerNotSupported)
        }
        val service = printerService
            ?: return NativeHardwareOperationResult(false, copy.printServiceNotConnected.format(profile.displayName))
        if (content.isBlank()) return NativeHardwareOperationResult(false, copy.printContentEmpty)
        if (copies !in 1..5) return NativeHardwareOperationResult(false, copy.printCopiesRange)
        return try {
            val printerStatus = service.printerStatus
            if (printerStatus != 0) {
                return NativeHardwareOperationResult(false, printerErrorMessage(printerStatus))
            }
            val format = PrintTextFormat().apply {
                setTextSize(24)
                setLineSpacing(2f)
            }
            val printable = if (content.endsWith("\n")) content else "$content\n"
            repeat(copies) {
                val printResult = service.printText(printable, format)
                if (printResult != 0) return NativeHardwareOperationResult(false, printerErrorMessage(printResult))
                val finishResult = service.printEndAutoOut()
                if (finishResult != 0) return NativeHardwareOperationResult(false, printerErrorMessage(finishResult))
            }
            NativeHardwareOperationResult(true, copy.receiptSentTo.format(copy.builtInThermalPrinterOf.format(profile.displayName)))
        } catch (_: RemoteException) {
            printerService = null
            NativeHardwareOperationResult(false, copy.printServiceDisconnected)
        }
    }

    /** Call on a worker dispatcher. */
    fun requestScan(): NativeHardwareOperationResult {
        if (profile == NativeHardwareProfile.T8) {
            return when {
                keyboardScannerAvailable() -> NativeHardwareOperationResult(true, copy.builtInScannerReady)
                scannerActivityIntent() != null -> NativeHardwareOperationResult(false, copy.scannerNeedsForeground)
                else -> NativeHardwareOperationResult(false, copy.noScannerOrCamera)
            }
        }
        val service = printerService
            ?: return NativeHardwareOperationResult(false, copy.scanServiceNotConnected.format(profile.displayName))
        return try {
            val result = service.triggerQscScan()
            if (result == 0) {
                NativeHardwareOperationResult(true, copy.scannerStarted)
            } else {
                NativeHardwareOperationResult(false, printerErrorMessage(result))
            }
        } catch (_: RemoteException) {
            printerService = null
            NativeHardwareOperationResult(false, copy.scanServiceDisconnected)
        }
    }

    /** Call only after the server has authorised the manual drawer action. */
    fun openCashDrawer(): NativeHardwareOperationResult {
        val service = printerService
            ?: return NativeHardwareOperationResult(false, copy.drawerServiceNotConnected.format(profile.displayName))
        return try {
            val result = service.openCashBox()
            if (result == 0) {
                NativeHardwareOperationResult(true, copy.drawerOpened)
            } else {
                NativeHardwareOperationResult(false, printerErrorMessage(result))
            }
        } catch (_: RemoteException) {
            printerService = null
            NativeHardwareOperationResult(false, copy.drawerServiceDisconnected)
        }
    }

    fun close() {
        closed = true
        unregisterScannerReceiver()
        if (serviceBound) {
            runCatching { appContext.unbindService(printerConnection) }
            serviceBound = false
        }
        printerService = null
        synchronized(scanListeners) { scanListeners.clear() }
    }

    private fun printBluetoothReceipt(
        content: String,
        copies: Int,
        printerId: String,
    ): NativeHardwareOperationResult {
        if (content.isBlank()) return NativeHardwareOperationResult(false, copy.printContentEmpty)
        if (content.length > MAX_PRINT_CONTENT_LENGTH) return NativeHardwareOperationResult(false, copy.printContentTooLong)
        if (copies !in 1..5) return NativeHardwareOperationResult(false, copy.printCopiesRange)
        val readiness = printerReadiness(printerId)
        if (!readiness.success) return readiness
        val address = printerId.removePrefix(BLUETOOTH_PRINTER_PREFIX)
        return try {
            val adapter = BluetoothAdapter.getDefaultAdapter()
                ?: return NativeHardwareOperationResult(false, copy.bluetoothUnsupported)
            val device = adapter.getRemoteDevice(address)
            val width = if ((device.name ?: "").contains("M810", ignoreCase = true)) 576 else 384
            device.createRfcommSocketToServiceRecord(SERIAL_PORT_PROFILE_UUID).use { socket ->
                socket.connect()
                socket.outputStream.use { output ->
                    repeat(copies) { writeEscPosReceipt(output, content, width) }
                }
            }
            NativeHardwareOperationResult(true, copy.receiptSentTo.format(device.name ?: copy.bluetoothPrinterFallback))
        } catch (_: IllegalArgumentException) {
            NativeHardwareOperationResult(false, copy.bluetoothAddressInvalid)
        } catch (_: SecurityException) {
            NativeHardwareOperationResult(false, copy.noPermissionConnectBluetooth)
        } catch (_: IOException) {
            NativeHardwareOperationResult(false, copy.cannotConnectBluetoothPrinter)
        }
    }

    /** Raster text keeps Chinese receipts independent of an ESC/POS printer's code page. */
    @Throws(IOException::class)
    private fun writeEscPosReceipt(output: OutputStream, content: String, width: Int) {
        writeBluetoothBytes(output, byteArrayOf(0x1b.toByte(), 0x40.toByte()))
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.BLACK
            textSize = 24f
        }
        val metrics = paint.fontMetrics
        val lineHeight = maxOf(32, kotlin.math.ceil((metrics.descent - metrics.ascent).toDouble()).toInt() + 6)
        val availableWidth = width - 8f
        content.replace("\r\n", "\n").replace('\r', '\n').split('\n').forEach { sourceLine ->
            if (sourceLine.isEmpty()) {
                writeBluetoothBytes(output, byteArrayOf('\n'.code.toByte()))
            } else {
                var start = 0
                while (start < sourceLine.length) {
                    var count = paint.breakText(sourceLine, start, sourceLine.length, true, availableWidth, null)
                    if (count <= 0) count = 1
                    var end = (start + count).coerceAtMost(sourceLine.length)
                    if (end < sourceLine.length && end > start && Character.isHighSurrogate(sourceLine[end - 1])) end -= 1
                    if (end <= start) end = (start + 1).coerceAtMost(sourceLine.length)
                    writeRasterLine(output, sourceLine.substring(start, end), paint, metrics, width, lineHeight)
                    start = end
                }
            }
        }
        writeBluetoothBytes(output, byteArrayOf('\n'.code.toByte(), '\n'.code.toByte(), '\n'.code.toByte(), '\n'.code.toByte(), '\n'.code.toByte()))
        output.flush()
    }

    @Throws(IOException::class)
    private fun writeRasterLine(
        output: OutputStream,
        line: String,
        paint: Paint,
        metrics: Paint.FontMetrics,
        width: Int,
        height: Int,
    ) {
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        try {
            Canvas(bitmap).apply {
                drawColor(Color.WHITE)
                drawText(line, 4f, 3f - metrics.ascent, paint)
            }
            writeEscPosRasterBitmap(output, bitmap)
            writeBluetoothBytes(output, byteArrayOf('\n'.code.toByte()))
        } finally {
            bitmap.recycle()
        }
    }

    @Throws(IOException::class)
    private fun writeEscPosRasterBitmap(output: OutputStream, bitmap: Bitmap) {
        val width = bitmap.width
        val height = bitmap.height
        val widthBytes = (width + 7) / 8
        val raster = ByteArray(widthBytes * height)
        val pixels = IntArray(width * height)
        bitmap.getPixels(pixels, 0, width, 0, 0, width, height)
        for (y in 0 until height) for (x in 0 until width) {
            val pixel = pixels[y * width + x]
            val luminance = (Color.red(pixel) * 299 + Color.green(pixel) * 587 + Color.blue(pixel) * 114) / 1000
            if (luminance < 160) {
                val offset = y * widthBytes + x / 8
                raster[offset] = (raster[offset].toInt() or (0x80 shr (x % 8))).toByte()
            }
        }
        writeBluetoothBytes(output, byteArrayOf(
            0x1d.toByte(), 0x76.toByte(), 0x30.toByte(), 0x00,
            (widthBytes and 0xff).toByte(), ((widthBytes shr 8) and 0xff).toByte(),
            (height and 0xff).toByte(), ((height shr 8) and 0xff).toByte(),
        ))
        writeBluetoothBytes(output, raster)
    }

    @Throws(IOException::class)
    private fun writeBluetoothBytes(output: OutputStream, bytes: ByteArray) {
        var offset = 0
        while (offset < bytes.size) {
            val length = minOf(BLUETOOTH_WRITE_CHUNK_BYTES, bytes.size - offset)
            output.write(bytes, offset, length)
            output.flush()
            offset += length
            if (offset < bytes.size) Thread.sleep(BLUETOOTH_CHUNK_DELAY_MS)
        }
    }

    private fun baseStatus(
        connected: Boolean,
        printerStatusCode: Int?,
        printerStatus: String?,
    ) = NativeHardwareStatus(
        host = profile.host,
        hardwareModel = profile.displayName,
        printerConnected = connected,
        scannerConnected = when (profile) {
            NativeHardwareProfile.T8 -> keyboardScannerAvailable() || scannerActivityIntent() != null
            NativeHardwareProfile.T1101 -> connected
            NativeHardwareProfile.Unsupported -> false
        },
        cashDrawerConnected = connected,
        printerStatus = printerStatus,
        printerStatusCode = printerStatusCode,
        printerId = profile.printerId,
        // Built from the catalogue rather than a constant: the device name is
        // shown on the hardware screen, so a French cashier must not meet
        // "POS-T1101 内置热敏打印机" there.
        printerName = profile.printerId?.let { copy.builtInThermalPrinterOf.format(profile.displayName) },
        printerHardwareKey = profile.printerHardwareKey,
        scannerId = profile.scannerId,
        scannerName = profile.scannerId?.let { copy.builtInScannerOf.format(profile.displayName) },
        scannerHardwareKey = profile.scannerHardwareKey,
    )

    private fun bindPrinterService() {
        if (closed || serviceBound || profile == NativeHardwareProfile.Unsupported) return
        val action = profile.printerAction ?: return
        val packageName = profile.printerPackage ?: return
        serviceBound = runCatching {
            appContext.bindService(
                Intent(action).setPackage(packageName),
                printerConnection,
                Context.BIND_AUTO_CREATE,
            )
        }.getOrDefault(false)
    }

    private fun registerScannerReceiver() {
        if (scannerReceiverRegistered || profile == NativeHardwareProfile.Unsupported) return
        runCatching {
            ContextCompat.registerReceiver(
                appContext,
                scannerReceiver,
                IntentFilter(SCANNER_ACTION),
                ContextCompat.RECEIVER_EXPORTED,
            )
            scannerReceiverRegistered = true
        }
    }

    private fun unregisterScannerReceiver() {
        if (!scannerReceiverRegistered) return
        runCatching { appContext.unregisterReceiver(scannerReceiver) }
        scannerReceiverRegistered = false
    }

    private fun resolveProfile(): NativeHardwareProfile = when {
        packageInstalled(T8_PRINTER_PACKAGE) -> NativeHardwareProfile.T8
        packageInstalled(T1101_PRINTER_PACKAGE) -> NativeHardwareProfile.T1101
        else -> NativeHardwareProfile.Unsupported
    }

    private fun hasCameraForSystemScanner(): Boolean = runCatching {
        val manager = appContext.getSystemService(Context.CAMERA_SERVICE) as? CameraManager
        manager?.cameraIdList?.isNotEmpty() == true
    }.getOrDefault(false)

    private fun isKeyboardScannerName(name: String): Boolean {
        val normalized = name.lowercase()
        return normalized.contains("usbscn") || normalized.contains("barcode") || normalized.contains("scanner")
    }

    @Suppress("DEPRECATION")
    private fun packageInstalled(packageName: String): Boolean = try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            appContext.packageManager.getPackageInfo(
                packageName,
                PackageManager.PackageInfoFlags.of(0),
            )
        } else {
            appContext.packageManager.getPackageInfo(packageName, 0)
        }
        true
    } catch (_: PackageManager.NameNotFoundException) {
        false
    }

    private fun printerStatusText(code: Int): String = when (code) {
        0 -> copy.hardwareReady
        -1201 -> copy.printerCoverOpenShort
        -1203 -> copy.printerOutOfPaperShort
        -1204 -> copy.printerOverheatedShort
        -1206 -> copy.printerBusyShort
        -1209 -> copy.batteryLowShort
        else -> copy.hardwareStatusAbnormal.format(code)
    }

    private fun printerErrorMessage(code: Int): String = when (code) {
        -1201 -> copy.printerCoverOpen
        -1203 -> copy.printerOutOfPaper
        -1204 -> copy.printerOverheated
        -1206 -> copy.printerBusy
        -1209 -> copy.batteryLowNoPrint
        -1003 -> copy.hardwareTimeout
        -1099, -1104 -> copy.hardwareUnsupported
        -1100, -1101, -1103, -1105, -1106 -> copy.hardwareServiceNotConnected.format(profile.displayName)
        else -> copy.hardwareOperationFailed.format(profile.displayName, code)
    }

    private companion object {
        const val T1101_PRINTER_PACKAGE = "net.nyx.printerservice"
        const val T8_PRINTER_PACKAGE = "com.incar.printerservice"
        const val T8_SCANNER_PACKAGE = "com.incar.scanner"
        const val T8_SCANNER_ACTIVITY = "net.nyx.scanner.ScannerActivity"
        const val T8_SCANNER_RESULT = "SCAN_RESULT"
        const val SCANNER_ACTION = "com.android.NYX_QSC_DATA"
        const val SCANNER_VALUE = "qsc"
        const val MAX_SCAN_LENGTH = 512
        const val MAX_PRINT_CONTENT_LENGTH = 65_536
        const val BLUETOOTH_PRINTER_PREFIX = "bluetooth:"
        const val BLUETOOTH_WRITE_CHUNK_BYTES = 2_048
        const val BLUETOOTH_CHUNK_DELAY_MS = 20L
        val SERIAL_PORT_PROFILE_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    }

    private fun isBluetoothPrinterId(printerId: String?): Boolean =
        printerId?.startsWith(BLUETOOTH_PRINTER_PREFIX) == true && printerId.length > BLUETOOTH_PRINTER_PREFIX.length

    private fun isBuiltInBluetoothAlias(device: BluetoothDevice): Boolean =
        profile == NativeHardwareProfile.T8 && (
            device.name?.equals("InnerPrinter", ignoreCase = true) == true ||
                device.address.equals("00:11:22:33:44:55", ignoreCase = true)
            )

    private fun hasBluetoothConnectPermission(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
            ContextCompat.checkSelfPermission(appContext, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
}
