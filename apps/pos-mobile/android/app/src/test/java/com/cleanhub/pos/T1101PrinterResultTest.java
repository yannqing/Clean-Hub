package com.cleanhub.pos;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class T1101PrinterResultTest {

    @Test
    public void mapsActionablePrinterFailures() {
        assertEquals("PRINTER_NO_PAPER", T1101PrinterResult.code(-1203));
        assertEquals("PRINTER_COVER_OPEN", T1101PrinterResult.code(-1201));
        assertEquals("PRINTER_OVERHEATED", T1101PrinterResult.code(-1204));
        assertEquals("DEVICE_DISCONNECTED", T1101PrinterResult.code(-1101));
    }

    @Test
    public void preservesUnknownVendorCodeInMessage() {
        assertEquals("VENDOR_ERROR", T1101PrinterResult.code(-1999));
        assertTrue(T1101PrinterResult.message(-1999, "T1101").contains("-1999"));
    }
}
