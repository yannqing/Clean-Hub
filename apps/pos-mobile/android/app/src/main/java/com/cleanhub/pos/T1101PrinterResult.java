package com.cleanhub.pos;

final class T1101PrinterResult {

    private T1101PrinterResult() {}

    static String code(int result) {
        switch (result) {
            case 0:
                return "OK";
            case -1001:
                return "VENDOR_SEND_FAILED";
            case -1002:
            case -1202:
                return "INVALID_PARAMETER";
            case -1003:
                return "VENDOR_TIMEOUT";
            case -1004:
                return "VENDOR_RECEIVE_FAILED";
            case -1006:
                return "VENDOR_COMMAND_MISMATCH";
            case -1015:
            case -1215:
                return "VENDOR_UNKNOWN_COMMAND";
            case -1099:
            case -1104:
                return "FEATURE_UNSUPPORTED";
            case -1100:
            case -1101:
            case -1103:
            case -1105:
            case -1106:
                return "DEVICE_DISCONNECTED";
            case -1107:
                return "DEVICE_PERMISSION_DENIED";
            case -1201:
                return "PRINTER_COVER_OPEN";
            case -1203:
                return "PRINTER_NO_PAPER";
            case -1204:
                return "PRINTER_OVERHEATED";
            case -1206:
                return "PRINTER_BUSY";
            case -1209:
                return "PRINTER_LOW_BATTERY";
            case -1290:
            case -1291:
            case -1292:
                return "PRINTER_LABEL_ERROR";
            default:
                return "VENDOR_ERROR";
        }
    }

    static String message(int result, String hardwareName) {
        String deviceName = hardwareName == null || hardwareName.trim().isEmpty()
            ? "POS"
            : hardwareName.trim();
        switch (result) {
            case 0:
                return "操作成功。";
            case -1201:
                return "打印机仓盖未关闭。";
            case -1203:
                return "打印机缺纸，请装入热敏纸后重试。";
            case -1204:
                return "打印机温度过高，请稍后重试。";
            case -1206:
                return "打印机正在处理其他任务，请稍后重试。";
            case -1209:
                return "设备电量过低，暂时无法打印。";
            case -1003:
                return "硬件响应超时，请检查设备后重试。";
            case -1099:
            case -1104:
                return "当前 " + deviceName + " 不支持此硬件功能。";
            case -1107:
                return "应用没有访问硬件的权限。";
            case -1100:
            case -1101:
            case -1103:
            case -1105:
            case -1106:
                return deviceName + " 硬件服务未连接。";
            case -1002:
            case -1202:
                return "提交给硬件的参数无效。";
            case -1290:
            case -1291:
            case -1292:
                return "打印机无法定位或检测标签纸。";
            default:
                return deviceName + " 硬件操作失败（" + result + "）。";
        }
    }
}
