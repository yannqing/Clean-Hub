package com.cleanhub.pos;

import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.ServiceConnection;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.RemoteException;
import android.util.Log;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import net.nyx.printerservice.print.IPrinterService;
import net.nyx.printerservice.print.PrintTextFormat;

/** Native bridge for the built-in POS-T1101 printer, scanner and cash drawer. */
@CapacitorPlugin(name = "T1101Hardware")
public class T1101HardwarePlugin extends Plugin {

    private static final String TAG = "CleanHubT1101";
    private static final String PRINTER_PACKAGE = "net.nyx.printerservice";
    private static final String PRINTER_ACTION = "net.nyx.printerservice.IPrinterService";
    private static final String SCANNER_ACTION = "com.android.NYX_QSC_DATA";
    private static final String SCANNER_VALUE = "qsc";
    private static final String BUILT_IN_PRINTER_ID = "t1101:built-in";
    private static final int MAX_CONTENT_LENGTH = 65_536;
    private static final int MAX_SCAN_LENGTH = 512;
    private static final int MAX_COPIES = 5;
    private static final int MAX_TRACKED_PRINT_JOBS = 128;
    private static final long REBIND_DELAY_MS = 2_000L;
    private static final String PRINT_PROGRESS_PREFIX = "print_progress:";
    private static final String PRINT_TIME_PREFIX = "print_time:";

    private final ExecutorService hardwareExecutor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private volatile IPrinterService printerService;
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
            result.put("scanner", connected);
            result.put("printer", connected);
            result.put("cashDrawer", connected);
            result.put("cardTerminal", false);
            result.put("secureTerminalCredential", false);
            result.put("host", "pos-t1101");
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
                    result.put("connected", false);
                    result.put("scanner", false);
                    result.put("printer", false);
                    result.put("cashDrawer", false);
                    result.put("printerStatus", "DEVICE_DISCONNECTED");
                }
            }
            call.resolve(result);
        });
    }

    @PluginMethod
    public void listPrinters(PluginCall call) {
        JSObject result = new JSObject();
        List<JSObject> printers = new ArrayList<>();
        if (printerService != null) {
            JSObject printer = new JSObject();
            printer.put("id", BUILT_IN_PRINTER_ID);
            printer.put("name", "POS-T1101 内置热敏打印机");
            printer.put("isDefault", true);
            printers.add(printer);
        }
        result.put("printers", new JSArray(printers));
        call.resolve(result);
    }

    @PluginMethod
    public void print(PluginCall call) {
        String jobId = normalized(call.getString("id"));
        String printerId = normalized(call.getString("printerId"));
        String content = call.getString("content");
        Integer requestedCopies = call.getInt("copies", 1);

        if (jobId == null || jobId.length() > 128) {
            call.reject("打印任务编号无效。", "INVALID_PRINT_JOB");
            return;
        }
        if (printerId == null || !BUILT_IN_PRINTER_ID.equals(printerId)) {
            call.reject("所选打印机不是当前设备的内置打印机。", "PRINTER_NOT_FOUND");
            return;
        }
        if (content == null || content.isEmpty() || content.length() > MAX_CONTENT_LENGTH) {
            call.reject("打印内容为空或超过 65536 个字符。", "INVALID_PRINT_CONTENT");
            return;
        }
        int copies = requestedCopies == null ? 1 : requestedCopies;
        if (copies < 1 || copies > MAX_COPIES) {
            call.reject("打印份数必须在 1 到 5 之间。", "INVALID_PRINT_COPIES");
            return;
        }

        hardwareExecutor.execute(() -> executePrint(call, jobId, content, copies));
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
                call.reject("POS-T1101 硬件服务未连接。", "DEVICE_DISCONNECTED");
                return;
            }
            try {
                int result = service.openCashBox();
                if (result != 0) {
                    call.reject(T1101PrinterResult.message(result), T1101PrinterResult.code(result));
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
        hardwareExecutor.execute(() -> {
            IPrinterService service = printerService;
            if (service == null) {
                call.reject("POS-T1101 扫码服务未连接。", "DEVICE_DISCONNECTED");
                return;
            }
            try {
                int result = service.triggerQscScan();
                if (result != 0) {
                    call.reject(T1101PrinterResult.message(result), T1101PrinterResult.code(result));
                    return;
                }
                call.resolve();
            } catch (RemoteException error) {
                call.reject("扫码服务连接已中断。", "DEVICE_DISCONNECTED", error);
            }
        });
    }

    private void executePrint(PluginCall call, String jobId, String content, int copies) {
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
            result.put("error", "POS-T1101 原生打印发生异常。");
            result.put("completedCopies", completedCopies);
            call.resolve(result);
        }
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
        result.put("error", T1101PrinterResult.message(vendorResult));
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
        Intent intent = new Intent(PRINTER_ACTION);
        intent.setPackage(PRINTER_PACKAGE);
        try {
            serviceBound = getContext().bindService(
                intent,
                printerConnection,
                Context.BIND_AUTO_CREATE
            );
        } catch (RuntimeException error) {
            serviceBound = false;
            Log.w(TAG, "Unable to bind POS-T1101 printer service", error);
        }
        if (!serviceBound) scheduleRebind();
    }

    private void safelyUnbindPrinterService() {
        if (!serviceBound) return;
        try {
            getContext().unbindService(printerConnection);
        } catch (RuntimeException error) {
            Log.w(TAG, "Unable to unbind POS-T1101 printer service", error);
        } finally {
            serviceBound = false;
            printerService = null;
        }
    }

    private void scheduleRebind() {
        if (destroyed) return;
        mainHandler.removeCallbacks(rebindPrinterService);
        mainHandler.postDelayed(rebindPrinterService, REBIND_DELAY_MS);
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
