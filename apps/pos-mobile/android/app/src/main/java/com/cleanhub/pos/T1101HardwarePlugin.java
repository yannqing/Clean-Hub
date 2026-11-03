package com.cleanhub.pos;

import android.Manifest;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.ServiceConnection;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.Build;
import android.os.RemoteException;
import android.util.Log;
import androidx.core.content.ContextCompat;
import androidx.activity.result.ActivityResult;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.IOException;
import java.io.OutputStream;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import net.nyx.printerservice.print.IPrinterService;
import net.nyx.printerservice.print.PrintTextFormat;

/** Native bridge for supported Android POS hardware and paired ESC/POS printers. */
@CapacitorPlugin(
    name = "T1101Hardware",
    permissions = {
        @Permission(
            alias = "bluetoothConnect",
            strings = { Manifest.permission.BLUETOOTH_CONNECT }
        ),
        @Permission(
            alias = "bluetoothScan",
            strings = { Manifest.permission.BLUETOOTH_SCAN }
        ),
        @Permission(
            alias = "bluetoothLegacyScan",
            strings = { Manifest.permission.ACCESS_FINE_LOCATION }
        )
    }
)
public class T1101HardwarePlugin extends Plugin {

    private static final String TAG = "CleanHubAndroidPOS";
    private static final String T1101_PRINTER_PACKAGE = "net.nyx.printerservice";
    private static final String T1101_PRINTER_ACTION = "net.nyx.printerservice.IPrinterService";
    private static final String T8_PRINTER_PACKAGE = "com.incar.printerservice";
    private static final String T8_PRINTER_ACTION = "com.incar.printerservice.IPrinterService";
    private static final String SCANNER_ACTION = "com.android.NYX_QSC_DATA";
    private static final String SCANNER_VALUE = "qsc";
    private static final String T8_SCANNER_PACKAGE = "com.incar.scanner";
    private static final String T8_SCANNER_ACTIVITY = "net.nyx.scanner.ScannerActivity";
    private static final String T8_SCANNER_RESULT = "SCAN_RESULT";
    private static final String BLUETOOTH_PRINTER_PREFIX = "bluetooth:";
    private static final UUID SERIAL_PORT_PROFILE_UUID = UUID.fromString(
        "00001101-0000-1000-8000-00805F9B34FB"
    );
    private static final int BLUETOOTH_58MM_WIDTH_DOTS = 384;
    private static final int BLUETOOTH_80MM_WIDTH_DOTS = 576;
    private static final float BLUETOOTH_TEXT_SIZE_PX = 24f;
    private static final int BLUETOOTH_QR_SIZE_DOTS = 240;
    private static final int BLUETOOTH_QR_STRIPE_HEIGHT_DOTS = 32;
    private static final int BLUETOOTH_WRITE_CHUNK_BYTES = 1_024;
    private static final long BLUETOOTH_CHUNK_DELAY_MS = 8L;
    private static final long BLUETOOTH_RASTER_LINE_DELAY_MS = 35L;
    private static final long BLUETOOTH_QR_DELAY_MS = 350L;
    private static final long BLUETOOTH_FINAL_DRAIN_DELAY_MS = 1_200L;
    private static final long BLUETOOTH_DISCOVERY_TIMEOUT_SECONDS = 15L;
    private static final long BLUETOOTH_PAIR_TIMEOUT_SECONDS = 45L;
    private static final int MAX_CONTENT_LENGTH = 65_536;
    private static final int MAX_SCAN_LENGTH = 512;
    private static final int MAX_COPIES = 5;
    private static final int MAX_TRACKED_PRINT_JOBS = 128;
    private static final long REBIND_DELAY_MS = 2_000L;
    private static final String PRINT_PROGRESS_PREFIX = "print_progress:";
    private static final String PRINT_TIME_PREFIX = "print_time:";

    private enum HardwareProfile {
        T1101(
            "pos-t1101",
            "POS-T1101",
            T1101_PRINTER_PACKAGE,
            T1101_PRINTER_ACTION,
            "t1101:built-in",
            "t1101:built-in:printer",
            "POS-T1101 内置热敏打印机",
            "t1101:built-in",
            "t1101:built-in:scanner",
            "POS-T1101 内置扫码器"
        ),
        T8(
            "pos-t8",
            "POS-T8",
            T8_PRINTER_PACKAGE,
            T8_PRINTER_ACTION,
            "t8:built-in",
            "t8:built-in:printer",
            "POS-T8 内置热敏打印机",
            "t8:built-in",
            "t8:built-in:scanner",
            "POS-T8 内置扫码器"
        ),
        UNSUPPORTED(
            "android",
            "Android POS",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
        );

        final String host;
        final String displayName;
        final String printerPackage;
        final String printerAction;
        final String builtInPrinterId;
        final String builtInPrinterHardwareKey;
        final String builtInPrinterName;
        final String builtInScannerId;
        final String builtInScannerHardwareKey;
        final String builtInScannerName;

        HardwareProfile(
            String host,
            String displayName,
            String printerPackage,
            String printerAction,
            String builtInPrinterId,
            String builtInPrinterHardwareKey,
            String builtInPrinterName,
            String builtInScannerId,
            String builtInScannerHardwareKey,
            String builtInScannerName
        ) {
            this.host = host;
            this.displayName = displayName;
            this.printerPackage = printerPackage;
            this.printerAction = printerAction;
            this.builtInPrinterId = builtInPrinterId;
            this.builtInPrinterHardwareKey = builtInPrinterHardwareKey;
            this.builtInPrinterName = builtInPrinterName;
            this.builtInScannerId = builtInScannerId;
            this.builtInScannerHardwareKey = builtInScannerHardwareKey;
            this.builtInScannerName = builtInScannerName;
        }

        boolean hasBuiltInHardware() {
            return printerPackage != null && printerAction != null;
        }
    }

    private final ExecutorService hardwareExecutor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private volatile IPrinterService printerService;
    private HardwareProfile hardwareProfile = HardwareProfile.UNSUPPORTED;
    private boolean serviceBound;
    private boolean destroyed;
    private boolean scannerReceiverRegistered;
    private SharedPreferences printState;

    private final Runnable rebindPrinterService = this::bindPrinterService;

    private final ServiceConnection printerConnection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
            printerService = IPrinterService.Stub.asInterface(service);
            notifyHardwareStatus();
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            printerService = null;
            notifyHardwareStatus();
        }

        @Override
        public void onBindingDied(ComponentName name) {
            printerService = null;
            safelyUnbindPrinterService();
            scheduleRebind();
            notifyHardwareStatus();
        }

        @Override
        public void onNullBinding(ComponentName name) {
            printerService = null;
            safelyUnbindPrinterService();
            scheduleRebind();
            notifyHardwareStatus();
        }
    };

    private final BroadcastReceiver scannerReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (!SCANNER_ACTION.equals(intent.getAction())) return;
            String rawValue = intent.getStringExtra(SCANNER_VALUE);
            if (rawValue == null) return;
            String value = rawValue.replace("\u0000", "").trim();
            if (value.isEmpty() || value.length() > MAX_SCAN_LENGTH) return;

            JSObject event = new JSObject();
            event.put("value", value);
            event.put("scannedAt", nowIso8601());
            notifyListeners("scan", event);
        }
    };

    @Override
    public void load() {
        hardwareProfile = resolveHardwareProfile();
        printState = getContext().getSharedPreferences(
            "cleanhub_t1101_print_state",
            Context.MODE_PRIVATE
        );
        registerScannerReceiver();
        bindPrinterService();
    }

    @Override
    protected void handleOnResume() {
        registerScannerReceiver();
        if (!serviceBound) bindPrinterService();
    }

    @Override
    protected void handleOnPause() {
        unregisterScannerReceiver();
    }

    @Override
    protected void handleOnDestroy() {
        destroyed = true;
        mainHandler.removeCallbacks(rebindPrinterService);
        unregisterScannerReceiver();
        safelyUnbindPrinterService();
        hardwareExecutor.shutdownNow();
    }

    @PluginMethod
    public void getCapabilities(PluginCall call) {
        hardwareExecutor.execute(() -> {
            IPrinterService service = printerService;
            JSObject result = new JSObject();
            boolean connected = service != null;
            boolean bluetoothPrinting = BluetoothAdapter.getDefaultAdapter() != null;
            result.put("printer", connected || bluetoothPrinting);
            result.put("cashDrawer", connected);
            result.put("cardTerminal", false);
            result.put("secureTerminalCredential", false);
            result.put("host", hardwareProfile.host);
            result.put("hardwareModel", hardwareProfile.displayName);
            result.put("connected", connected);

            if (connected) {
                try {
                    int status = service.getPrinterStatus();
                    result.put("printerStatusCode", status);
                    result.put("printerStatus", T1101PrinterResult.code(status));
                    result.put("serviceVersion", service.getServiceVersion());

                    String[] model = new String[1];
                    if (service.getPrinterModel(model) == 0 && model[0] != null) {
                        result.put("printerModel", model[0]);
                    }
                } catch (RemoteException error) {
                    connected = false;
                    result.put("connected", false);
                    result.put("scanner", false);
                    result.put("printer", bluetoothPrinting);
                    result.put("cashDrawer", false);
                    result.put("printerStatus", "DEVICE_DISCONNECTED");
                }
            }
            result.put("scanner", builtInScannerAvailable(connected));
            result.put("builtInDevices", builtInHardwareJson(connected));
            call.resolve(result);
        });
    }

    /**
     * Report only peripherals physically owned by this Android POS. This is a
     * passive inventory check: it never scans nearby Bluetooth devices, pairs,
     * prints, or triggers the scanner.
     */
    private JSArray builtInHardwareJson(boolean available) {
        List<JSObject> devices = new ArrayList<>();
        if (!hardwareProfile.hasBuiltInHardware()) return new JSArray(devices);

        JSObject printer = new JSObject();
        printer.put("hardwareKey", hardwareProfile.builtInPrinterHardwareKey);
        printer.put("name", hardwareProfile.builtInPrinterName);
        printer.put("deviceType", "printer");
        printer.put("localDeviceId", hardwareProfile.builtInPrinterId);
        printer.put("available", available);
        printer.put("deviceModel", hardwareProfile.displayName);
        devices.add(printer);

        JSObject scanner = new JSObject();
        scanner.put("hardwareKey", hardwareProfile.builtInScannerHardwareKey);
        scanner.put("name", hardwareProfile.builtInScannerName);
        scanner.put("deviceType", "scanner");
        scanner.put("localDeviceId", hardwareProfile.builtInScannerId);
        scanner.put("available", builtInScannerAvailable(available));
        scanner.put("deviceModel", hardwareProfile.displayName);
        devices.add(scanner);

        return new JSArray(devices);
    }

    @PluginMethod
    public void listPrinters(PluginCall call) {
        if (!hasBluetoothConnectPermission()) {
            requestPermissionForAlias(
                "bluetoothConnect",
                call,
                "bluetoothPermissionCallback"
            );
            return;
        }
        resolvePrinterList(call);
    }

    @PluginMethod
    public void discoverPrinters(PluginCall call) {
        if (!hasBluetoothConnectPermission() || !hasBluetoothScanPermission()) {
            String[] aliases = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                ? new String[] { "bluetoothConnect", "bluetoothScan" }
                : new String[] { "bluetoothLegacyScan" };
            requestPermissionForAliases(
                aliases,
                call,
                "bluetoothDiscoveryPermissionCallback"
            );
            return;
        }
        hardwareExecutor.execute(() -> executeBluetoothDiscovery(call));
    }

    @PluginMethod
    public void pairPrinter(PluginCall call) {
        String printerId = normalized(call.getString("printerId"));
        if (printerId == null || !isBluetoothPrinterId(printerId)) {
            call.reject("请选择有效的蓝牙打印机。", "BLUETOOTH_DEVICE_INVALID");
            return;
        }
        if (!hasBluetoothConnectPermission()) {
            requestPermissionForAlias(
                "bluetoothConnect",
                call,
                "bluetoothPairPermissionCallback"
            );
            return;
        }
        hardwareExecutor.execute(() -> executeBluetoothPair(call, printerId));
    }

    @PermissionCallback
    private void bluetoothPermissionCallback(PluginCall call) {
        if (!hasBluetoothConnectPermission()) {
            call.reject("需要蓝牙连接权限才能检测已配对打印机。", "BLUETOOTH_PERMISSION_DENIED");
            return;
        }
        String operation = normalized(call.getString("printerId"));
        if (operation != null) {
            print(call);
            return;
        }
        resolvePrinterList(call);
    }

    @PermissionCallback
    private void bluetoothDiscoveryPermissionCallback(PluginCall call) {
        if (!hasBluetoothConnectPermission() || !hasBluetoothScanPermission()) {
            call.reject("需要附近设备权限才能扫描蓝牙打印机。", "BLUETOOTH_PERMISSION_DENIED");
            return;
        }
        hardwareExecutor.execute(() -> executeBluetoothDiscovery(call));
    }

    @PermissionCallback
    private void bluetoothPairPermissionCallback(PluginCall call) {
        if (!hasBluetoothConnectPermission()) {
            call.reject("需要附近设备权限才能配对蓝牙打印机。", "BLUETOOTH_PERMISSION_DENIED");
            return;
        }
        String printerId = normalized(call.getString("printerId"));
        if (printerId == null || !isBluetoothPrinterId(printerId)) {
            call.reject("请选择有效的蓝牙打印机。", "BLUETOOTH_DEVICE_INVALID");
            return;
        }
        hardwareExecutor.execute(() -> executeBluetoothPair(call, printerId));
    }

    private void resolvePrinterList(PluginCall call) {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        List<BluetoothDevice> bondedDevices = new ArrayList<>();
        if (adapter != null && adapter.isEnabled()) {
            try {
                bondedDevices.addAll(adapter.getBondedDevices());
            } catch (SecurityException error) {
                call.reject("没有权限读取已配对蓝牙设备。", "BLUETOOTH_PERMISSION_DENIED", error);
                return;
            }
        }
        resolveBluetoothPrinterList(call, bondedDevices);
    }

    private void executeBluetoothDiscovery(PluginCall call) {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) {
            call.reject("当前设备不支持蓝牙。", "BLUETOOTH_UNAVAILABLE");
            return;
        }
        if (!adapter.isEnabled()) {
            call.reject("蓝牙未开启，请先打开蓝牙后重试。", "BLUETOOTH_DISABLED");
            return;
        }

        Map<String, BluetoothDevice> discoveredDevices = new ConcurrentHashMap<>();
        CountDownLatch discoveryFinished = new CountDownLatch(1);
        BroadcastReceiver discoveryReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String action = intent.getAction();
                if (BluetoothAdapter.ACTION_DISCOVERY_FINISHED.equals(action)) {
                    discoveryFinished.countDown();
                    return;
                }
                if (!BluetoothDevice.ACTION_FOUND.equals(action)) return;
                BluetoothDevice device = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                    ? intent.getParcelableExtra(
                        BluetoothDevice.EXTRA_DEVICE,
                        BluetoothDevice.class
                    )
                    : intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                if (device == null) return;
                try {
                    String address = device.getAddress();
                    if (address != null && !address.isEmpty()) {
                        discoveredDevices.put(address, device);
                    }
                } catch (SecurityException ignored) {
                    // Permission can be revoked while a scan is active.
                }
            }
        };

        boolean receiverRegistered = false;
        try {
            for (BluetoothDevice device : adapter.getBondedDevices()) {
                String address = device.getAddress();
                if (address != null && !address.isEmpty()) {
                    discoveredDevices.put(address, device);
                }
            }
            if (adapter.isDiscovering()) adapter.cancelDiscovery();

            IntentFilter filter = new IntentFilter();
            filter.addAction(BluetoothDevice.ACTION_FOUND);
            filter.addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED);
            ContextCompat.registerReceiver(
                getContext(),
                discoveryReceiver,
                filter,
                ContextCompat.RECEIVER_EXPORTED
            );
            receiverRegistered = true;

            if (!adapter.startDiscovery()) {
                call.reject("无法启动蓝牙扫描，请关闭并重新打开蓝牙后重试。", "BLUETOOTH_SCAN_FAILED");
                return;
            }
            discoveryFinished.await(BLUETOOTH_DISCOVERY_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            resolveBluetoothPrinterList(call, discoveredDevices.values());
        } catch (SecurityException error) {
            call.reject("没有权限扫描附近的蓝牙设备。", "BLUETOOTH_PERMISSION_DENIED", error);
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            call.reject("蓝牙扫描已中断，请重试。", "BLUETOOTH_SCAN_INTERRUPTED", error);
        } finally {
            try {
                if (adapter.isDiscovering()) adapter.cancelDiscovery();
            } catch (SecurityException ignored) {
                // Permission can be revoked while a scan is active.
            }
            if (receiverRegistered) {
                try {
                    getContext().unregisterReceiver(discoveryReceiver);
                } catch (IllegalArgumentException ignored) {
                    // Receiver was already removed during host teardown.
                }
            }
        }
    }

    private void executeBluetoothPair(PluginCall call, String printerId) {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) {
            call.reject("当前设备不支持蓝牙。", "BLUETOOTH_UNAVAILABLE");
            return;
        }
        if (!adapter.isEnabled()) {
            call.reject("蓝牙未开启，请先打开蓝牙后重试。", "BLUETOOTH_DISABLED");
            return;
        }

        String address = printerId.substring(BLUETOOTH_PRINTER_PREFIX.length());
        CountDownLatch pairingFinished = new CountDownLatch(1);
        AtomicBoolean pairingFailed = new AtomicBoolean(false);
        BroadcastReceiver pairingReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (!BluetoothDevice.ACTION_BOND_STATE_CHANGED.equals(intent.getAction())) return;
                BluetoothDevice changedDevice = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                    ? intent.getParcelableExtra(
                        BluetoothDevice.EXTRA_DEVICE,
                        BluetoothDevice.class
                    )
                    : intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                if (changedDevice == null || !address.equals(changedDevice.getAddress())) return;
                int state = intent.getIntExtra(
                    BluetoothDevice.EXTRA_BOND_STATE,
                    BluetoothDevice.BOND_NONE
                );
                int previousState = intent.getIntExtra(
                    BluetoothDevice.EXTRA_PREVIOUS_BOND_STATE,
                    BluetoothDevice.BOND_NONE
                );
                if (state == BluetoothDevice.BOND_BONDED) {
                    pairingFinished.countDown();
                } else if (
                    state == BluetoothDevice.BOND_NONE &&
                    previousState == BluetoothDevice.BOND_BONDING
                ) {
                    pairingFailed.set(true);
                    pairingFinished.countDown();
                }
            }
        };

        boolean receiverRegistered = false;
        try {
            BluetoothDevice device = adapter.getRemoteDevice(address);
            if (device.getBondState() == BluetoothDevice.BOND_BONDED) {
                resolvePairedPrinter(call, device);
                return;
            }
            if (adapter.isDiscovering()) adapter.cancelDiscovery();

            IntentFilter filter = new IntentFilter(BluetoothDevice.ACTION_BOND_STATE_CHANGED);
            ContextCompat.registerReceiver(
                getContext(),
                pairingReceiver,
                filter,
                ContextCompat.RECEIVER_EXPORTED
            );
            receiverRegistered = true;

            if (!device.createBond()) {
                call.reject("无法发起蓝牙配对，请确认打印机处于可配对状态。", "BLUETOOTH_PAIR_FAILED");
                return;
            }
            boolean completed = pairingFinished.await(
                BLUETOOTH_PAIR_TIMEOUT_SECONDS,
                TimeUnit.SECONDS
            );
            if (!completed) {
                call.reject("蓝牙配对等待超时，请确认打印机仍处于配对模式。", "BLUETOOTH_PAIR_TIMEOUT");
                return;
            }
            if (pairingFailed.get() || device.getBondState() != BluetoothDevice.BOND_BONDED) {
                call.reject("蓝牙配对未完成，请确认配对码后重试。", "BLUETOOTH_PAIR_FAILED");
                return;
            }
            resolvePairedPrinter(call, device);
        } catch (IllegalArgumentException error) {
            call.reject("蓝牙打印机地址无效，请重新扫描。", "BLUETOOTH_DEVICE_INVALID", error);
        } catch (SecurityException error) {
            call.reject("没有权限配对蓝牙打印机。", "BLUETOOTH_PERMISSION_DENIED", error);
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            call.reject("蓝牙配对已中断，请重试。", "BLUETOOTH_PAIR_INTERRUPTED", error);
        } finally {
            if (receiverRegistered) {
                try {
                    getContext().unregisterReceiver(pairingReceiver);
                } catch (IllegalArgumentException ignored) {
                    // Receiver was already removed during host teardown.
                }
            }
        }
    }

    private void resolvePairedPrinter(PluginCall call, BluetoothDevice device) {
        JSObject result = new JSObject();
        result.put("printer", bluetoothPrinterJson(device));
        call.resolve(result);
    }

    private void resolveBluetoothPrinterList(
        PluginCall call,
        Iterable<BluetoothDevice> bluetoothDevices
    ) {
        JSObject result = new JSObject();
        List<JSObject> printers = new ArrayList<>();
        if (printerService != null && hardwareProfile.hasBuiltInHardware()) {
            JSObject printer = new JSObject();
            printer.put("id", hardwareProfile.builtInPrinterId);
            printer.put("name", hardwareProfile.builtInPrinterName);
            printer.put("isDefault", true);
            printer.put("connectionType", "built_in");
            printer.put("isPaired", true);
            printers.add(printer);
        }

        List<BluetoothDevice> sortedDevices = new ArrayList<>();
        for (BluetoothDevice device : bluetoothDevices) sortedDevices.add(device);
        sortedDevices.sort(
            Comparator.comparing(device -> bluetoothDeviceName(device).toLowerCase(Locale.ROOT))
        );
        for (BluetoothDevice device : sortedDevices) {
            try {
                if (isBuiltInBluetoothAlias(device)) continue;
                printers.add(bluetoothPrinterJson(device));
            } catch (SecurityException ignored) {
                // Skip devices that became inaccessible after permission revocation.
            }
        }
        result.put("printers", new JSArray(printers));
        call.resolve(result);
    }

    private JSObject bluetoothPrinterJson(BluetoothDevice device) {
        String address = device.getAddress();
        JSObject printer = new JSObject();
        printer.put("id", BLUETOOTH_PRINTER_PREFIX + address);
        printer.put("name", bluetoothDeviceName(device));
        printer.put("isDefault", false);
        printer.put("connectionType", "bluetooth");
        printer.put("isPaired", device.getBondState() == BluetoothDevice.BOND_BONDED);
        return printer;
    }

    private String bluetoothDeviceName(BluetoothDevice device) {
        String name = normalized(device.getName());
        return name == null ? "蓝牙设备 " + device.getAddress() : name;
    }

    @PluginMethod
    public void print(PluginCall call) {
        String jobId = normalized(call.getString("id"));
        String printerId = normalized(call.getString("printerId"));
        String content = call.getString("content");
        String qrCodeContent = normalized(call.getString("qrCodeContent"));
        Integer requestedCopies = call.getInt("copies", 1);

        if (jobId == null || jobId.length() > 128) {
            call.reject("打印任务编号无效。", "INVALID_PRINT_JOB");
            return;
        }
        String builtInPrinterId = hardwareProfile.builtInPrinterId;
        if (
            printerId == null ||
            (!(builtInPrinterId != null && builtInPrinterId.equals(printerId)) &&
                !isBluetoothPrinterId(printerId))
        ) {
            call.reject("所选打印机不是当前设备支持的打印机。", "PRINTER_NOT_FOUND");
            return;
        }
        if (content == null || content.isEmpty() || content.length() > MAX_CONTENT_LENGTH) {
            call.reject("打印内容为空或超过 65536 个字符。", "INVALID_PRINT_CONTENT");
            return;
        }
        if (qrCodeContent != null && qrCodeContent.length() > MAX_SCAN_LENGTH) {
            call.reject("二维码内容超过 512 个字符。", "INVALID_QR_CONTENT");
            return;
        }
        int copies = requestedCopies == null ? 1 : requestedCopies;
        if (copies < 1 || copies > MAX_COPIES) {
            call.reject("打印份数必须在 1 到 5 之间。", "INVALID_PRINT_COPIES");
            return;
        }

        if (isBluetoothPrinterId(printerId) && !hasBluetoothConnectPermission()) {
            requestPermissionForAlias(
                "bluetoothConnect",
                call,
                "bluetoothPermissionCallback"
            );
            return;
        }

        hardwareExecutor.execute(() -> {
            if (printerId.equals(hardwareProfile.builtInPrinterId)) {
                executePrint(call, jobId, content, qrCodeContent, copies);
            } else {
                executeBluetoothPrint(
                    call,
                    jobId,
                    printerId.substring(BLUETOOTH_PRINTER_PREFIX.length()),
                    content,
                    qrCodeContent,
                    copies
                );
            }
        });
    }

    @PluginMethod
    public void openCashDrawer(PluginCall call) {
        if (!isAuthorizedDrawerRequest(call)) {
            call.reject("开钱箱请求缺少有效原因或授权来源。", "INVALID_DRAWER_REQUEST");
            return;
        }
        hardwareExecutor.execute(() -> {
            IPrinterService service = printerService;
            if (service == null) {
                call.reject(hardwareProfile.displayName + " 硬件服务未连接。", "DEVICE_DISCONNECTED");
                return;
            }
            try {
                int result = service.openCashBox();
                if (result != 0) {
                    call.reject(
                        T1101PrinterResult.message(result, hardwareProfile.displayName),
                        T1101PrinterResult.code(result)
                    );
                    return;
                }
                call.resolve();
            } catch (RemoteException error) {
                call.reject("钱箱服务连接已中断。", "DEVICE_DISCONNECTED", error);
            }
        });
    }

    @PluginMethod
    public void triggerScanner(PluginCall call) {
        if (hardwareProfile == HardwareProfile.T8) {
            launchT8CameraScanner(call);
            return;
        }

        hardwareExecutor.execute(() -> {
            IPrinterService service = printerService;
            if (service == null) {
                call.reject(hardwareProfile.displayName + " 扫码服务未连接。", "DEVICE_DISCONNECTED");
                return;
            }
            try {
                int result = service.triggerQscScan();
                if (result != 0) {
                    call.reject(
                        T1101PrinterResult.message(result, hardwareProfile.displayName),
                        T1101PrinterResult.code(result)
                    );
                    return;
                }
                call.resolve();
            } catch (RemoteException error) {
                call.reject("扫码服务连接已中断。", "DEVICE_DISCONNECTED", error);
            }
        });
    }

    private void launchT8CameraScanner(PluginCall call) {
        Intent intent = t8CameraScannerIntent();
        if (intent.resolveActivity(getContext().getPackageManager()) == null) {
            call.reject(
                hardwareProfile.displayName + " 系统扫码器不可用。",
                "SCANNER_UNAVAILABLE"
            );
            return;
        }
        startActivityForResult(call, intent, "t8CameraScannerResult");
    }

    @ActivityCallback
    private void t8CameraScannerResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null) {
            call.reject("扫码测试已取消，设备没有登记。", "SCAN_CANCELLED");
            return;
        }

        String value = normalized(data.getStringExtra(T8_SCANNER_RESULT));
        if (value == null || value.length() > MAX_SCAN_LENGTH) {
            call.reject("系统扫码器没有返回有效内容。", "SCAN_RESULT_INVALID");
            return;
        }

        JSObject event = new JSObject();
        event.put("value", value);
        event.put("scannedAt", nowIso8601());
        notifyListeners("scan", event);

        JSObject response = new JSObject();
        response.put("value", value);
        call.resolve(response);
    }

    private void executePrint(
        PluginCall call,
        String jobId,
        String content,
        String qrCodeContent,
        int copies
    ) {
        IPrinterService service = printerService;
        if (service == null) {
            resolvePrintFailure(call, jobId, -1100, 0);
            return;
        }

        int completedCopies = Math.min(copies, printState.getInt(progressKey(jobId), 0));
        if (completedCopies >= copies) {
            resolvePrintSuccess(call, jobId, completedCopies, true);
            return;
        }

        try {
            int status = service.getPrinterStatus();
            if (status != 0) {
                resolvePrintFailure(call, jobId, status, completedCopies);
                return;
            }

            PrintTextFormat format = new PrintTextFormat();
            format.setTextSize(24);
            format.setLineSpacing(2f);
            String printableContent = content.endsWith("\n") ? content : content + "\n";

            for (int copy = completedCopies; copy < copies; copy++) {
                int result = service.printText(printableContent, format);
                if (result == 0 && qrCodeContent != null) {
                    result = service.printQrCode(qrCodeContent, 300, 300, 1);
                }
                if (result == 0) result = service.printEndAutoOut();
                if (result != 0) {
                    resolvePrintFailure(call, jobId, result, copy);
                    return;
                }
                completedCopies = copy + 1;
                rememberPrintProgress(jobId, completedCopies);
            }
            resolvePrintSuccess(call, jobId, completedCopies, false);
        } catch (RemoteException error) {
            Log.w(TAG, "Printer service disconnected while printing", error);
            resolvePrintFailure(call, jobId, -1101, completedCopies);
        } catch (RuntimeException error) {
            Log.e(TAG, "Unexpected print failure", error);
            JSObject result = basePrintResult(jobId, "failed");
            result.put("errorCode", "NATIVE_PRINT_ERROR");
            result.put("error", hardwareProfile.displayName + " 原生打印发生异常。");
            result.put("completedCopies", completedCopies);
            call.resolve(result);
        }
    }

    private void executeBluetoothPrint(
        PluginCall call,
        String jobId,
        String address,
        String content,
        String qrCodeContent,
        int copies
    ) {
        int completedCopies = Math.min(copies, printState.getInt(progressKey(jobId), 0));
        if (completedCopies >= copies) {
            resolvePrintSuccess(call, jobId, completedCopies, true);
            return;
        }

        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) {
            resolveHostPrintFailure(
                call,
                jobId,
                "BLUETOOTH_UNAVAILABLE",
                "当前设备不支持蓝牙。",
                completedCopies
            );
            return;
        }
        if (!adapter.isEnabled()) {
            resolveHostPrintFailure(
                call,
                jobId,
                "BLUETOOTH_DISABLED",
                "蓝牙未开启，请先在系统设置中打开蓝牙。",
                completedCopies
            );
            return;
        }

        try {
            BluetoothDevice device = adapter.getRemoteDevice(address);
            try (
                BluetoothSocket socket = device.createRfcommSocketToServiceRecord(
                    SERIAL_PORT_PROFILE_UUID
                )
            ) {
                socket.connect();
                OutputStream output = socket.getOutputStream();
                int paperWidthDots = bluetoothPaperWidthDots(device.getName());
                for (int copy = completedCopies; copy < copies; copy++) {
                    writeEscPosDocument(
                        output,
                        content,
                        qrCodeContent,
                        paperWidthDots
                    );
                    completedCopies = copy + 1;
                    rememberPrintProgress(jobId, completedCopies);
                }
            }
            resolvePrintSuccess(call, jobId, completedCopies, false);
        } catch (IllegalArgumentException error) {
            resolveHostPrintFailure(
                call,
                jobId,
                "BLUETOOTH_DEVICE_INVALID",
                "蓝牙打印机地址无效，请重新检测并绑定。",
                completedCopies
            );
        } catch (SecurityException error) {
            resolveHostPrintFailure(
                call,
                jobId,
                "BLUETOOTH_PERMISSION_DENIED",
                "没有蓝牙连接权限，请在系统设置中允许后重试。",
                completedCopies
            );
        } catch (IOException error) {
            Log.w(TAG, "Bluetooth ESC/POS print failed", error);
            resolveHostPrintFailure(
                call,
                jobId,
                "BLUETOOTH_CONNECTION_FAILED",
                "无法连接蓝牙打印机，请确认设备已开机并已在系统中配对。",
                completedCopies
            );
        }
    }

    private void writeEscPosDocument(
        OutputStream output,
        String content,
        String qrCodeContent,
        int paperWidthDots
    ) throws IOException {
        writeBluetoothBytes(output, new byte[] { 0x1b, 0x40 });
        writeRasterizedText(output, content, paperWidthDots);
        if (qrCodeContent != null) {
            writeRasterizedQrCode(output, qrCodeContent, paperWidthDots);
        }
        writeBluetoothBytes(output, new byte[] { '\n', '\n', '\n', '\n', '\n' });
        output.flush();
        pauseBluetoothOutput(BLUETOOTH_FINAL_DRAIN_DELAY_MS);
    }

    /**
     * Render text with Android fonts before sending it to ESC/POS. Bluetooth
     * receipt printers frequently ship with different active code pages, so
     * sending GB18030/UTF-8 bytes directly produces mojibake on otherwise
     * compatible units. Raster output keeps Chinese and accented Latin text
     * independent of the printer firmware's selected character table.
     */
    private void writeRasterizedText(
        OutputStream output,
        String content,
        int paperWidthDots
    ) throws IOException {
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setColor(Color.BLACK);
        paint.setTextSize(BLUETOOTH_TEXT_SIZE_PX);
        Paint.FontMetrics metrics = paint.getFontMetrics();
        int lineHeight = Math.max(
            32,
            (int) Math.ceil(metrics.descent - metrics.ascent) + 6
        );
        float availableWidth = paperWidthDots - 8f;
        String normalizedContent = content.replace("\r\n", "\n").replace('\r', '\n');
        String[] sourceLines = normalizedContent.split("\n", -1);

        for (String sourceLine : sourceLines) {
            if (sourceLine.isEmpty()) {
                writeBluetoothBytes(output, new byte[] { '\n' });
                continue;
            }
            int start = 0;
            while (start < sourceLine.length()) {
                int count = paint.breakText(
                    sourceLine,
                    start,
                    sourceLine.length(),
                    true,
                    availableWidth,
                    null
                );
                if (count <= 0) count = 1;
                int end = Math.min(sourceLine.length(), start + count);
                if (
                    end < sourceLine.length() &&
                    end > start &&
                    Character.isHighSurrogate(sourceLine.charAt(end - 1))
                ) {
                    end -= 1;
                }
                if (end <= start) end = Math.min(sourceLine.length(), start + 1);
                writeEscPosRasterLine(
                    output,
                    sourceLine.substring(start, end),
                    paint,
                    metrics,
                    paperWidthDots,
                    lineHeight
                );
                start = end;
            }
        }
    }

    private void writeEscPosRasterLine(
        OutputStream output,
        String line,
        Paint paint,
        Paint.FontMetrics metrics,
        int width,
        int height
    ) throws IOException {
        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        try {
            Canvas canvas = new Canvas(bitmap);
            canvas.drawColor(Color.WHITE);
            canvas.drawText(line, 4f, 3f - metrics.ascent, paint);

            writeEscPosRasterBitmap(output, bitmap);
            writeBluetoothBytes(output, new byte[] { '\n' });
            pauseBluetoothOutput(BLUETOOTH_RASTER_LINE_DELAY_MS);
        } finally {
            bitmap.recycle();
        }
    }

    private void writeRasterizedQrCode(
        OutputStream output,
        String value,
        int paperWidthDots
    ) throws IOException {
        int qrSize = Math.min(BLUETOOTH_QR_SIZE_DOTS, paperWidthDots - 32);
        EnumMap<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
        hints.put(EncodeHintType.CHARACTER_SET, "UTF-8");
        hints.put(EncodeHintType.MARGIN, 2);

        try {
            BitMatrix matrix = new QRCodeWriter().encode(
                value,
                BarcodeFormat.QR_CODE,
                qrSize,
                qrSize,
                hints
            );
            Bitmap bitmap = Bitmap.createBitmap(
                paperWidthDots,
                qrSize + 16,
                Bitmap.Config.ARGB_8888
            );
            try {
                Canvas canvas = new Canvas(bitmap);
                canvas.drawColor(Color.WHITE);
                int left = (paperWidthDots - qrSize) / 2;
                for (int y = 0; y < qrSize; y++) {
                    for (int x = 0; x < qrSize; x++) {
                        if (matrix.get(x, y)) {
                            bitmap.setPixel(left + x, y + 8, Color.BLACK);
                        }
                    }
                }
                for (int top = 0; top < bitmap.getHeight(); top += BLUETOOTH_QR_STRIPE_HEIGHT_DOTS) {
                    int stripeHeight = Math.min(
                        BLUETOOTH_QR_STRIPE_HEIGHT_DOTS,
                        bitmap.getHeight() - top
                    );
                    Bitmap stripe = Bitmap.createBitmap(
                        bitmap,
                        0,
                        top,
                        bitmap.getWidth(),
                        stripeHeight
                    );
                    try {
                        writeEscPosRasterBitmap(output, stripe);
                        pauseBluetoothOutput(BLUETOOTH_RASTER_LINE_DELAY_MS);
                    } finally {
                        stripe.recycle();
                    }
                }
                writeBluetoothBytes(output, new byte[] { '\n' });
                pauseBluetoothOutput(BLUETOOTH_QR_DELAY_MS);
            } finally {
                bitmap.recycle();
            }
        } catch (WriterException error) {
            throw new IOException("Unable to render receipt QR code", error);
        }
    }

    private void writeEscPosRasterBitmap(
        OutputStream output,
        Bitmap bitmap
    ) throws IOException {
        int width = bitmap.getWidth();
        int height = bitmap.getHeight();
        int widthBytes = (width + 7) / 8;
        byte[] raster = new byte[widthBytes * height];
        int[] pixels = new int[width * height];
        bitmap.getPixels(pixels, 0, width, 0, 0, width, height);
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int pixel = pixels[y * width + x];
                int luminance = (
                    Color.red(pixel) * 299 +
                    Color.green(pixel) * 587 +
                    Color.blue(pixel) * 114
                ) / 1000;
                if (luminance < 160) {
                    int offset = y * widthBytes + x / 8;
                    raster[offset] |= (byte) (0x80 >> (x % 8));
                }
            }
        }

        writeBluetoothBytes(
            output,
            new byte[] {
                0x1d,
                0x76,
                0x30,
                0x00,
                (byte) (widthBytes & 0xff),
                (byte) ((widthBytes >> 8) & 0xff),
                (byte) (height & 0xff),
                (byte) ((height >> 8) & 0xff),
            }
        );
        writeBluetoothBytes(output, raster);
    }

    private int bluetoothPaperWidthDots(String printerName) {
        String normalizedName = printerName == null
            ? ""
            : printerName.toUpperCase(Locale.ROOT);
        return normalizedName.contains("M810")
            ? BLUETOOTH_80MM_WIDTH_DOTS
            : BLUETOOTH_58MM_WIDTH_DOTS;
    }

    private void writeBluetoothBytes(OutputStream output, byte[] data) throws IOException {
        for (int offset = 0; offset < data.length; offset += BLUETOOTH_WRITE_CHUNK_BYTES) {
            int length = Math.min(BLUETOOTH_WRITE_CHUNK_BYTES, data.length - offset);
            output.write(data, offset, length);
            output.flush();
            if (offset + length < data.length) {
                pauseBluetoothOutput(BLUETOOTH_CHUNK_DELAY_MS);
            }
        }
    }

    private void pauseBluetoothOutput(long delayMillis) throws IOException {
        try {
            Thread.sleep(delayMillis);
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new IOException("Bluetooth print interrupted", error);
        }
    }

    private void resolveHostPrintFailure(
        PluginCall call,
        String jobId,
        String errorCode,
        String error,
        int completedCopies
    ) {
        JSObject result = basePrintResult(jobId, "failed");
        result.put("errorCode", errorCode);
        result.put("error", error);
        result.put("completedCopies", completedCopies);
        call.resolve(result);
    }

    private boolean isBluetoothPrinterId(String printerId) {
        return printerId.startsWith(BLUETOOTH_PRINTER_PREFIX) &&
            printerId.length() > BLUETOOTH_PRINTER_PREFIX.length();
    }

    private boolean isBuiltInBluetoothAlias(BluetoothDevice device) {
        if (hardwareProfile != HardwareProfile.T8) return false;
        String name = normalized(device.getName());
        String address = normalized(device.getAddress());
        return (name != null && "InnerPrinter".equalsIgnoreCase(name)) ||
            "00:11:22:33:44:55".equalsIgnoreCase(address);
    }

    private boolean hasBluetoothConnectPermission() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
            getPermissionState("bluetoothConnect") == PermissionState.GRANTED;
    }

    private boolean hasBluetoothScanPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return getPermissionState("bluetoothScan") == PermissionState.GRANTED;
        }
        return ContextCompat.checkSelfPermission(
            getContext(),
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED;
    }

    private void resolvePrintSuccess(
        PluginCall call,
        String jobId,
        int completedCopies,
        boolean duplicate
    ) {
        JSObject result = basePrintResult(jobId, "printed");
        result.put("completedCopies", completedCopies);
        result.put("idempotent", duplicate);
        call.resolve(result);
    }

    private void resolvePrintFailure(
        PluginCall call,
        String jobId,
        int vendorResult,
        int completedCopies
    ) {
        JSObject result = basePrintResult(jobId, "failed");
        result.put("errorCode", T1101PrinterResult.code(vendorResult));
        result.put(
            "error",
            T1101PrinterResult.message(vendorResult, hardwareProfile.displayName)
        );
        result.put("vendorResult", vendorResult);
        result.put("completedCopies", completedCopies);
        call.resolve(result);
    }

    private JSObject basePrintResult(String jobId, String status) {
        JSObject result = new JSObject();
        result.put("jobId", jobId);
        result.put("status", status);
        return result;
    }

    private void rememberPrintProgress(String jobId, int completedCopies) {
        printState
            .edit()
            .putInt(progressKey(jobId), completedCopies)
            .putLong(timeKey(jobId), System.currentTimeMillis())
            .commit();
        prunePrintProgress();
    }

    private void prunePrintProgress() {
        Map<String, ?> entries = printState.getAll();
        List<Map.Entry<String, ?>> timestamps = new ArrayList<>();
        for (Map.Entry<String, ?> entry : entries.entrySet()) {
            if (entry.getKey().startsWith(PRINT_TIME_PREFIX) && entry.getValue() instanceof Long) {
                timestamps.add(entry);
            }
        }
        if (timestamps.size() <= MAX_TRACKED_PRINT_JOBS) return;

        timestamps.sort(Comparator.comparingLong(entry -> (Long) entry.getValue()));
        SharedPreferences.Editor editor = printState.edit();
        int removeCount = timestamps.size() - MAX_TRACKED_PRINT_JOBS;
        for (int index = 0; index < removeCount; index++) {
            String timestampKey = timestamps.get(index).getKey();
            String jobId = timestampKey.substring(PRINT_TIME_PREFIX.length());
            editor.remove(timestampKey);
            editor.remove(progressKey(jobId));
        }
        editor.apply();
    }

    private String progressKey(String jobId) {
        return PRINT_PROGRESS_PREFIX + jobId;
    }

    private String timeKey(String jobId) {
        return PRINT_TIME_PREFIX + jobId;
    }

    private boolean isAuthorizedDrawerRequest(PluginCall call) {
        String reason = normalized(call.getString("reason"));
        JSObject trigger = call.getObject("trigger");
        if (reason == null || trigger == null) return false;
        String type = normalized(trigger.getString("type"));
        if ("cash_payment".equals(type)) {
            return normalized(trigger.getString("paymentId")) != null;
        }
        if ("manual".equals(type)) {
            return normalized(trigger.getString("authorizationId")) != null;
        }
        return false;
    }

    private String normalized(String value) {
        if (value == null) return null;
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private void bindPrinterService() {
        if (destroyed || serviceBound) return;
        if (!hardwareProfile.hasBuiltInHardware()) return;
        Intent intent = new Intent(hardwareProfile.printerAction);
        intent.setPackage(hardwareProfile.printerPackage);
        try {
            serviceBound = getContext().bindService(
                intent,
                printerConnection,
                Context.BIND_AUTO_CREATE
            );
        } catch (RuntimeException error) {
            serviceBound = false;
            Log.w(TAG, "Unable to bind " + hardwareProfile.displayName + " printer service", error);
        }
        if (!serviceBound) scheduleRebind();
    }

    private void safelyUnbindPrinterService() {
        if (!serviceBound) return;
        try {
            getContext().unbindService(printerConnection);
        } catch (RuntimeException error) {
            Log.w(TAG, "Unable to unbind " + hardwareProfile.displayName + " printer service", error);
        } finally {
            serviceBound = false;
            printerService = null;
        }
    }

    private void scheduleRebind() {
        if (destroyed || !hardwareProfile.hasBuiltInHardware()) return;
        mainHandler.removeCallbacks(rebindPrinterService);
        mainHandler.postDelayed(rebindPrinterService, REBIND_DELAY_MS);
    }

    private HardwareProfile resolveHardwareProfile() {
        if (isPackageInstalled(T8_PRINTER_PACKAGE)) {
            return HardwareProfile.T8;
        }
        if (isPackageInstalled(T1101_PRINTER_PACKAGE)) {
            return HardwareProfile.T1101;
        }
        return HardwareProfile.UNSUPPORTED;
    }

    @SuppressWarnings("deprecation")
    private boolean isPackageInstalled(String packageName) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                getContext().getPackageManager().getPackageInfo(
                    packageName,
                    PackageManager.PackageInfoFlags.of(0)
                );
            } else {
                getContext().getPackageManager().getPackageInfo(packageName, 0);
            }
            return true;
        } catch (PackageManager.NameNotFoundException ignored) {
            return false;
        }
    }

    private boolean builtInScannerAvailable(boolean printerServiceAvailable) {
        if (hardwareProfile == HardwareProfile.T8) {
            return t8CameraScannerIntent()
                .resolveActivity(getContext().getPackageManager()) != null;
        }
        return printerServiceAvailable && hardwareProfile.hasBuiltInHardware();
    }

    private Intent t8CameraScannerIntent() {
        Intent intent = new Intent();
        intent.setComponent(new ComponentName(T8_SCANNER_PACKAGE, T8_SCANNER_ACTIVITY));
        return intent;
    }

    private String nowIso8601() {
        SimpleDateFormat format = new SimpleDateFormat(
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            Locale.US
        );
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        return format.format(new Date());
    }

    private void registerScannerReceiver() {
        if (scannerReceiverRegistered || destroyed) return;
        IntentFilter filter = new IntentFilter(SCANNER_ACTION);
        ContextCompat.registerReceiver(
            getContext(),
            scannerReceiver,
            filter,
            ContextCompat.RECEIVER_EXPORTED
        );
        scannerReceiverRegistered = true;
    }

    private void unregisterScannerReceiver() {
        if (!scannerReceiverRegistered) return;
        try {
            getContext().unregisterReceiver(scannerReceiver);
        } catch (IllegalArgumentException error) {
            Log.w(TAG, "Scanner receiver was already unregistered", error);
        } finally {
            scannerReceiverRegistered = false;
        }
    }

    private void notifyHardwareStatus() {
        JSObject status = new JSObject();
        boolean connected = printerService != null;
        status.put("connected", connected);
        status.put("printer", connected);
        status.put("scanner", connected);
        status.put("cashDrawer", connected);
        notifyListeners("hardwareStatus", status);
    }
}
