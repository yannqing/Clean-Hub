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
    val printerName: String?,
    val scannerId: String?,
    val scannerHardwareKey: String?,
    val scannerName: String?,
) {
    T1101(
        host = "pos-t1101",
        displayName = "POS-T1101",
        printerPackage = "net.nyx.printerservice",
        printerAction = "net.nyx.printerservice.IPrinterService",
        printerId = "t1101:built-in",
        printerHardwareKey = "t1101:built-in:printer",
        printerName = "POS-T1101 内置热敏打印机",
        scannerId = "t1101:built-in",
        scannerHardwareKey = "t1101:built-in:scanner",
        scannerName = "POS-T1101 内置扫码器",
    ),
    T8(
        host = "pos-t8",
        displayName = "POS-T8",
        printerPackage = "com.incar.printerservice",
        printerAction = "com.incar.printerservice.IPrinterService",
        printerId = "t8:built-in",
        printerHardwareKey = "t8:built-in:printer",
        printerName = "POS-T8 内置热敏打印机",
        scannerId = "t8:built-in",
        scannerHardwareKey = "t8:built-in:scanner",
        scannerName = "POS-T8 内置扫码器",
    ),
    Unsupported(
        host = "android",
        displayName = "Android POS",
        printerPackage = null,
        printerAction = null,
        printerId = null,
        printerHardwareKey = null,
        printerName = null,
        scannerId = null,
        scannerHardwareKey = null,
        scannerName = null,
    ),
}

internal class NativePosHardware(context: Context) {
    private val appContext = context.applicationContext
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
            baseStatus(false, null, "硬件服务已断开")
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
            throw NativePosValidationException("请先允许“附近设备”权限，才能读取已配对的蓝牙打印机。")
        }
        val adapter = BluetoothAdapter.getDefaultAdapter()
            ?: throw NativePosValidationException("当前设备不支持蓝牙。")
        if (!adapter.isEnabled) {
            throw NativePosValidationException("蓝牙未开启，请先在系统设置中打开蓝牙。")
        }
        return try {
            adapter.bondedDevices
                .filterNot(::isBuiltInBluetoothAlias)
                .map { device ->
                    NativeBluetoothPrinter(
                        id = "$BLUETOOTH_PRINTER_PREFIX${device.address}",
                        name = device.name?.trim().takeUnless { it.isNullOrBlank() }
                            ?: "蓝牙设备 ${device.address}",
                    )
                }
                .sortedBy { it.name.lowercase() }
        } catch (_: SecurityException) {
            throw NativePosValidationException("没有权限读取已配对蓝牙设备。")
        }
    }

    /** Check the selected print route before claiming a durable receipt job. */
    fun printerReadiness(printerId: String?): NativeHardwareOperationResult {
        if (printerId.isNullOrBlank()) {
            return NativeHardwareOperationResult(false, "请先由店主或经理登记并设定默认收据打印机。")
        }
        if (isBluetoothPrinterId(printerId)) {
            if (!hasBluetoothConnectPermission()) {
                return NativeHardwareOperationResult(false, "请先允许“附近设备”权限，才能连接蓝牙打印机。")
            }
            val adapter = BluetoothAdapter.getDefaultAdapter()
                ?: return NativeHardwareOperationResult(false, "当前设备不支持蓝牙。")
            if (!adapter.isEnabled) return NativeHardwareOperationResult(false, "蓝牙未开启，请先在系统设置中打开蓝牙。")
            return try {
                val address = printerId.removePrefix(BLUETOOTH_PRINTER_PREFIX)
                val device = adapter.getRemoteDevice(address)
                if (device.bondState != BluetoothDevice.BOND_BONDED) {
                    NativeHardwareOperationResult(false, "已绑定的蓝牙打印机未处于系统配对状态。")
                } else {
                    NativeHardwareOperationResult(true, "蓝牙打印机已就绪。")
                }
            } catch (_: IllegalArgumentException) {
                NativeHardwareOperationResult(false, "蓝牙打印机地址无效，请重新绑定。")
            } catch (_: SecurityException) {
                NativeHardwareOperationResult(false, "没有权限连接蓝牙打印机。")
            }
        }
        val service = printerService
            ?: return NativeHardwareOperationResult(false, "${profile.displayName} 打印服务未连接。")
        if (printerId != profile.printerId) {
            return NativeHardwareOperationResult(false, "当前设备不是后台登记的默认收据打印机，收据继续保留在本地队列。")
        }
        return try {
            val code = service.printerStatus
            if (code == 0) NativeHardwareOperationResult(true, "内置打印机已就绪。")
            else NativeHardwareOperationResult(false, printerErrorMessage(code))
        } catch (_: RemoteException) {
            printerService = null
            NativeHardwareOperationResult(false, "打印服务已断开，请刷新硬件状态后重试。")
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
            return NativeHardwareOperationResult(false, "所选打印机不是当前设备支持的打印机。")
        }
        val service = printerService
            ?: return NativeHardwareOperationResult(false, "${profile.displayName} 打印服务未连接。")
        if (content.isBlank()) return NativeHardwareOperationResult(false, "打印内容不能为空。")
        if (copies !in 1..5) return NativeHardwareOperationResult(false, "打印份数应为 1–5。")
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
            NativeHardwareOperationResult(true, "收据已发送到 ${profile.printerName}。")
        } catch (_: RemoteException) {
            printerService = null
            NativeHardwareOperationResult(false, "打印服务已断开，请刷新硬件状态后重试。")
        }
    }

    /** Call on a worker dispatcher. */
    fun requestScan(): NativeHardwareOperationResult {
        if (profile == NativeHardwareProfile.T8) {
            return when {
                keyboardScannerAvailable() -> NativeHardwareOperationResult(true, "内置扫码器已就绪，请使用扫描头扫描条码。")
                scannerActivityIntent() != null -> NativeHardwareOperationResult(false, "POS-T8 扫码需要从当前界面启动系统扫码器。")
                else -> NativeHardwareOperationResult(false, "未检测到可用的内置扫码器或摄像头。")
            }
        }
        val service = printerService
            ?: return NativeHardwareOperationResult(false, "${profile.displayName} 扫码服务未连接。")
        return try {
            val result = service.triggerQscScan()
            if (result == 0) {
                NativeHardwareOperationResult(true, "扫码器已启动，请扫描条码。")
            } else {
                NativeHardwareOperationResult(false, printerErrorMessage(result))
            }
        } catch (_: RemoteException) {
            printerService = null
            NativeHardwareOperationResult(false, "扫码服务已断开，请刷新硬件状态后重试。")
        }
    }

    /** Call only after the server has authorised the manual drawer action. */
    fun openCashDrawer(): NativeHardwareOperationResult {
        val service = printerService
            ?: return NativeHardwareOperationResult(false, "${profile.displayName} 钱箱服务未连接。")
        return try {
            val result = service.openCashBox()
            if (result == 0) {
                NativeHardwareOperationResult(true, "钱箱已打开。")
            } else {
                NativeHardwareOperationResult(false, printerErrorMessage(result))
            }
        } catch (_: RemoteException) {
            printerService = null
            NativeHardwareOperationResult(false, "钱箱服务已断开，请刷新硬件状态后重试。")
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
        if (content.isBlank()) return NativeHardwareOperationResult(false, "打印内容不能为空。")
        if (content.length > MAX_PRINT_CONTENT_LENGTH) return NativeHardwareOperationResult(false, "打印内容超过允许长度。")
        if (copies !in 1..5) return NativeHardwareOperationResult(false, "打印份数应为 1–5。")
        val readiness = printerReadiness(printerId)
        if (!readiness.success) return readiness
        val address = printerId.removePrefix(BLUETOOTH_PRINTER_PREFIX)
        return try {
            val adapter = BluetoothAdapter.getDefaultAdapter()
                ?: return NativeHardwareOperationResult(false, "当前设备不支持蓝牙。")
            val device = adapter.getRemoteDevice(address)
            val width = if ((device.name ?: "").contains("M810", ignoreCase = true)) 576 else 384
            device.createRfcommSocketToServiceRecord(SERIAL_PORT_PROFILE_UUID).use { socket ->
                socket.connect()
                socket.outputStream.use { output ->
                    repeat(copies) { writeEscPosReceipt(output, content, width) }
                }
            }
            NativeHardwareOperationResult(true, "收据已发送到 ${device.name ?: "蓝牙打印机"}。")
        } catch (_: IllegalArgumentException) {
            NativeHardwareOperationResult(false, "蓝牙打印机地址无效，请重新绑定。")
        } catch (_: SecurityException) {
            NativeHardwareOperationResult(false, "没有权限连接蓝牙打印机。")
        } catch (_: IOException) {
            NativeHardwareOperationResult(false, "无法连接蓝牙打印机，请确认设备已开机且仍保持配对。")
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
        printerName = profile.printerName,
        printerHardwareKey = profile.printerHardwareKey,
        scannerId = profile.scannerId,
        scannerName = profile.scannerName,
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
        0 -> "就绪"
        -1201 -> "打印机仓盖未关闭"
        -1203 -> "打印机缺纸"
        -1204 -> "打印机温度过高"
        -1206 -> "打印机忙"
        -1209 -> "设备电量过低"
        else -> "硬件状态异常（$code）"
    }

    private fun printerErrorMessage(code: Int): String = when (code) {
        -1201 -> "打印机仓盖未关闭。"
        -1203 -> "打印机缺纸，请装入热敏纸后重试。"
        -1204 -> "打印机温度过高，请稍后重试。"
        -1206 -> "打印机正在处理其他任务，请稍后重试。"
        -1209 -> "设备电量过低，暂时无法打印。"
        -1003 -> "硬件响应超时，请检查设备后重试。"
        -1099, -1104 -> "当前设备不支持此硬件功能。"
        -1100, -1101, -1103, -1105, -1106 -> "${profile.displayName} 硬件服务未连接。"
        else -> "${profile.displayName} 硬件操作失败（$code）。"
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
