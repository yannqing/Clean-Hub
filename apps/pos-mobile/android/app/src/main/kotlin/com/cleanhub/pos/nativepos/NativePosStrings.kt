package com.cleanhub.pos.nativepos

/**
 * Cashier-facing copy for the native POS.
 *
 * The app was written in Chinese throughout, with a three-language picker that
 * reached only the PIN screen -- so a French cashier signed in through French
 * copy and then met Chinese for everything after it. Tenants already run in
 * French, so this is not hypothetical.
 *
 * Every string is held in a map rather than as constructor parameters. The
 * first version of this file was a data class with one parameter per string;
 * past roughly 254 of them the JVM refuses to load the class at all
 * ("Too many arguments in method signature"), which the Kotlin compiler
 * accepts silently and only a running terminal discovers. A map has no such
 * ceiling, and NativePosCopyTest checks every language carries every key so
 * the completeness the data class enforced by construction is still enforced,
 * just by a test instead of by the compiler.
 *
 * Android string resources are not an option here: they cannot be switched per
 * terminal at runtime without recreating the Activity.
 */
internal class NativePosCopy(
    private val languageCode: String,
    private val values: Map<String, String>,
) {
    /**
     * A key with no entry is a programming error, not something a cashier
     * should discover as a blank label -- fail loudly in debug, and fall back
     * to Chinese rather than to empty space.
     */
    private fun get(key: String): String =
        values[key] ?: COPY_ZH_VALUES[key] ?: error("Missing copy key: $key ($languageCode)")

    /** Keys every language must define; the test reads this. */
    internal fun keys(): Set<String> = values.keys

    val online: String get() = get("online")
    val offline: String get() = get("offline")
    val offlineMode: String get() = get("offlineMode")
    val syncing: String get() = get("syncing")
    val synchronize: String get() = get("synchronize")
    val pendingSalesSuffix: String get() = get("pendingSalesSuffix")
    val catalogTitle: String get() = get("catalogTitle")
    val cartEmpty: String get() = get("cartEmpty")
    val amountDue: String get() = get("amountDue")
    val checkout: String get() = get("checkout")
    val cashTendered: String get() = get("cashTendered")
    val changeDue: String get() = get("changeDue")
    val subtotal: String get() = get("subtotal")
    val tax: String get() = get("tax")
    val rounding: String get() = get("rounding")
    val total: String get() = get("total")
    val receiptPrint: String get() = get("receiptPrint")
    val receiptNone: String get() = get("receiptNone")
    val receiptQueued: String get() = get("receiptQueued")
    val saleSubmittedOnline: String get() = get("saleSubmittedOnline")
    val saleQueuedOffline: String get() = get("saleQueuedOffline")
    val cashPaymentRecorded: String get() = get("cashPaymentRecorded")
    val tenderBelowTotal: String get() = get("tenderBelowTotal")
    val cartIsEmpty: String get() = get("cartIsEmpty")
    val priceChanged: String get() = get("priceChanged")
    val shiftAndDrawerRequired: String get() = get("shiftAndDrawerRequired")
    val requiresNetwork: String get() = get("requiresNetwork")
    val networkError: String get() = get("networkError")
    val genericFailure: String get() = get("genericFailure")
    val staleCatalogWarning: String get() = get("staleCatalogWarning")
    val printerNotConnected: String get() = get("printerNotConnected")
    val printerOutOfPaper: String get() = get("printerOutOfPaper")
    val printerCoverOpen: String get() = get("printerCoverOpen")
    val printerOverheated: String get() = get("printerOverheated")
    val drawerOpened: String get() = get("drawerOpened")
    val drawerDisconnected: String get() = get("drawerDisconnected")
    val tabWorkspace: String get() = get("tabWorkspace")
    val tabSale: String get() = get("tabSale")
    val tabIntake: String get() = get("tabIntake")
    val tabTickets: String get() = get("tabTickets")
    val tabMore: String get() = get("tabMore")
    val menuMore: String get() = get("menuMore")
    val menuCustomers: String get() = get("menuCustomers")
    val menuCatalog: String get() = get("menuCatalog")
    val menuScan: String get() = get("menuScan")
    val menuOrders: String get() = get("menuOrders")
    val menuOrderDetail: String get() = get("menuOrderDetail")
    val menuStatistics: String get() = get("menuStatistics")
    val menuNotifications: String get() = get("menuNotifications")
    val menuShift: String get() = get("menuShift")
    val menuSettings: String get() = get("menuSettings")
    val menuHardware: String get() = get("menuHardware")
    val ticketDraft: String get() = get("ticketDraft")
    val ticketPending: String get() = get("ticketPending")
    val ticketInProgress: String get() = get("ticketInProgress")
    val ticketReadyToPick: String get() = get("ticketReadyToPick")
    val ticketPickedUp: String get() = get("ticketPickedUp")
    val ticketCancelled: String get() = get("ticketCancelled")
    val ticketUnknown: String get() = get("ticketUnknown")
    val itemPendingWash: String get() = get("itemPendingWash")
    val itemWashing: String get() = get("itemWashing")
    val itemDone: String get() = get("itemDone")
    val itemReadyToPick: String get() = get("itemReadyToPick")
    val typeCloth: String get() = get("typeCloth")
    val typeCar: String get() = get("typeCar")
    val typeShoe: String get() = get("typeShoe")
    val typeCarpet: String get() = get("typeCarpet")
    val priorityCritical: String get() = get("priorityCritical")
    val priorityUrgent: String get() = get("priorityUrgent")
    val priorityNormal: String get() = get("priorityNormal")
    val devicePrinter: String get() = get("devicePrinter")
    val deviceScanner: String get() = get("deviceScanner")
    val deviceCashDrawer: String get() = get("deviceCashDrawer")
    val moreNeedsNetwork: String get() = get("moreNeedsNetwork")
    val workspaceTitle: String get() = get("workspaceTitle")
    val workspaceOnlineHint: String get() = get("workspaceOnlineHint")
    val workspaceOfflineHint: String get() = get("workspaceOfflineHint")
    val metricCatalog: String get() = get("metricCatalog")
    val metricPendingOrders: String get() = get("metricPendingOrders")
    val metricFailedOrders: String get() = get("metricFailedOrders")
    val cashSectionTitle: String get() = get("cashSectionTitle")
    val cashReadyOffline: String get() = get("cashReadyOffline")
    val cashCheckedOnline: String get() = get("cashCheckedOnline")
    val cashNeedsSync: String get() = get("cashNeedsSync")
    val openTill: String get() = get("openTill")
    val synchronizing: String get() = get("synchronizing")
    val intakeTitle: String get() = get("intakeTitle")
    val intakeOnlineHint: String get() = get("intakeOnlineHint")
    val intakeOfflineHint: String get() = get("intakeOfflineHint")
    val newCustomer: String get() = get("newCustomer")
    val newCustomerShort: String get() = get("newCustomerShort")
    val lookupTitle: String get() = get("lookupTitle")
    val lookupHint: String get() = get("lookupHint")
    val lookupLabel: String get() = get("lookupLabel")
    val lookupPlaceholder: String get() = get("lookupPlaceholder")
    val search: String get() = get("search")
    val customerRecord: String get() = get("customerRecord")
    val change: String get() = get("change")
    val contactDetails: String get() = get("contactDetails")
    val noContactDetails: String get() = get("noContactDetails")
    val customerStatusActive: String get() = get("customerStatusActive")
    val customerStatusPrefix: String get() = get("customerStatusPrefix")
    val recentWork: String get() = get("recentWork")
    val newestFirst: String get() = get("newestFirst")
    val noCachedTickets: String get() = get("noCachedTickets")
    val newOrder: String get() = get("newOrder")
    val intakeEmptyTitle: String get() = get("intakeEmptyTitle")
    val intakeEmptyDescription: String get() = get("intakeEmptyDescription")
    val intakeNoMatchTitle: String get() = get("intakeNoMatchTitle")
    val intakeNoMatchDescription: String get() = get("intakeNoMatchDescription")
    val matchingCustomers: String get() = get("matchingCustomers")
    val matchingCustomersCount: String get() = get("matchingCustomersCount")
    val noPhoneOnFile: String get() = get("noPhoneOnFile")
    val select: String get() = get("select")
    val serviceOrder: String get() = get("serviceOrder")
    val itemsCountSuffix: String get() = get("itemsCountSuffix")
    val expectedPickup: String get() = get("expectedPickup")
    val continueProcessing: String get() = get("continueProcessing")
    val ticketsTitle: String get() = get("ticketsTitle")
    val ticketsEmpty: String get() = get("ticketsEmpty")
    val serviceTicket: String get() = get("serviceTicket")
    val syncLocalData: String get() = get("syncLocalData")
    val backToMore: String get() = get("backToMore")
    val refreshing: String get() = get("refreshing")
    val refreshStatus: String get() = get("refreshStatus")
    val shiftTitle: String get() = get("shiftTitle")
    val shiftIntro: String get() = get("shiftIntro")
    val shiftOfflineNotice: String get() = get("shiftOfflineNotice")
    val shiftLoading: String get() = get("shiftLoading")
    val shiftLoadFailed: String get() = get("shiftLoadFailed")
    val reload: String get() = get("reload")
    val staffShift: String get() = get("staffShift")
    val shiftOpen: String get() = get("shiftOpen")
    val shiftOnBreak: String get() = get("shiftOnBreak")
    val shiftClosed: String get() = get("shiftClosed")
    val clockingIn: String get() = get("clockingIn")
    val clockIn: String get() = get("clockIn")
    val breakStarting: String get() = get("breakStarting")
    val breakStart: String get() = get("breakStart")
    val clockOut: String get() = get("clockOut")
    val breakEnding: String get() = get("breakEnding")
    val breakEnd: String get() = get("breakEnd")
    val registerTitle: String get() = get("registerTitle")
    val cashModeNone: String get() = get("cashModeNone")
    val cashModeUntracked: String get() = get("cashModeUntracked")
    val cashModePersonal: String get() = get("cashModePersonal")
    val cashModeShared: String get() = get("cashModeShared")
    val openingFloatRequired: String get() = get("openingFloatRequired")
    val openingFloatOptional: String get() = get("openingFloatOptional")
    val openingFloatNeeded: String get() = get("openingFloatNeeded")
    val registerOpening: String get() = get("registerOpening")
    val openMyCashSession: String get() = get("openMyCashSession")
    val openRegister: String get() = get("openRegister")
    val registerStatus: String get() = get("registerStatus")
    val thisTerminal: String get() = get("thisTerminal")
    val opened: String get() = get("opened")
    val notOpened: String get() = get("notOpened")
    val cashSession: String get() = get("cashSession")
    val myPersonalCash: String get() = get("myPersonalCash")
    val sharedDrawer: String get() = get("sharedDrawer")
    val expectedCash: String get() = get("expectedCash")
    val thisRegister: String get() = get("thisRegister")
    val netSales: String get() = get("netSales")
    val outstandingOrders: String get() = get("outstandingOrders")
    val awaitingProcessing: String get() = get("awaitingProcessing")
    val cashInOut: String get() = get("cashInOut")
    val amountLabel: String get() = get("amountLabel")
    val reasonLabel: String get() = get("reasonLabel")
    val recording: String get() = get("recording")
    val payIn: String get() = get("payIn")
    val payOut: String get() = get("payOut")
    val countAndCloseMyCash: String get() = get("countAndCloseMyCash")
    val closeRegisterZReport: String get() = get("closeRegisterZReport")
    val closeRegisterHint: String get() = get("closeRegisterHint")
    val countedCashRequired: String get() = get("countedCashRequired")
    val countedCashOptional: String get() = get("countedCashOptional")
    val handoverNotes: String get() = get("handoverNotes")
    val countedCashNeeded: String get() = get("countedCashNeeded")
    val closing: String get() = get("closing")
    val confirmClose: String get() = get("confirmClose")
    val notYet: String get() = get("notYet")
    val closeNeedsManager: String get() = get("closeNeedsManager")
    val recentZReports: String get() = get("recentZReports")
    val varianceLabel: String get() = get("varianceLabel")
    val localData: String get() = get("localData")
    val cachedSummary: String get() = get("cachedSummary")
    val confirmClockOutTitle: String get() = get("confirmClockOutTitle")
    val confirmClockOutBody: String get() = get("confirmClockOutBody")
    val checkAgain: String get() = get("checkAgain")
    val confirmClockOut: String get() = get("confirmClockOut")
    val readyOnlineCash: String get() = get("readyOnlineCash")
    val readyOfflineCash: String get() = get("readyOfflineCash")
    val cashDisabledStore: String get() = get("cashDisabledStore")
    val cashNeedsShiftOnline: String get() = get("cashNeedsShiftOnline")
    val cashNeedsShiftOffline: String get() = get("cashNeedsShiftOffline")
    val startMyShift: String get() = get("startMyShift")
    val shiftStarted: String get() = get("shiftStarted")
    val drawerOpeningCash: String get() = get("drawerOpeningCash")
    val openDrawerAndSync: String get() = get("openDrawerAndSync")
    val newCustomerTitle: String get() = get("newCustomerTitle")
    val newCustomerHint: String get() = get("newCustomerHint")
    val back: String get() = get("back")
    val customerInfo: String get() = get("customerInfo")
    val customerName: String get() = get("customerName")
    val customerNamePlaceholder: String get() = get("customerNamePlaceholder")
    val phoneNumber: String get() = get("phoneNumber")
    val phonePlaceholder: String get() = get("phonePlaceholder")
    val saving: String get() = get("saving")
    val saveCustomer: String get() = get("saveCustomer")
    val newTicketTitle: String get() = get("newTicketTitle")
    val newTicketHint: String get() = get("newTicketHint")
    val ticketCustomer: String get() = get("ticketCustomer")
    val ticketType: String get() = get("ticketType")
    val typeLaundry: String get() = get("typeLaundry")
    val typeCarWash: String get() = get("typeCarWash")
    val priorityTitle: String get() = get("priorityTitle")
    val expectedPickupField: String get() = get("expectedPickupField")
    val remarkOptional: String get() = get("remarkOptional")
    val remarkPlaceholder: String get() = get("remarkPlaceholder")
    val ticketNeedsNetwork: String get() = get("ticketNeedsNetwork")
    val creating: String get() = get("creating")
    val createTicket: String get() = get("createTicket")
    val backToTickets: String get() = get("backToTickets")
    val serviceItemsCount: String get() = get("serviceItemsCount")
    val ticketOfflineNotice: String get() = get("ticketOfflineNotice")
    val ticketFlow: String get() = get("ticketFlow")
    val cancelReasonRequired: String get() = get("cancelReasonRequired")
    val confirmPickedUp: String get() = get("confirmPickedUp")
    val updateToStatus: String get() = get("updateToStatus")
    val serviceItems: String get() = get("serviceItems")
    val noServiceItems: String get() = get("noServiceItems")
    val alreadyBilled: String get() = get("alreadyBilled")
    val pendingSyncNoBill: String get() = get("pendingSyncNoBill")
    val appendServiceItem: String get() = get("appendServiceItem")
    val noCachedServices: String get() = get("noCachedServices")
    val noServicesForType: String get() = get("noServicesForType")
    val pendingService: String get() = get("pendingService")
    val itemTypePrefix: String get() = get("itemTypePrefix")
    val changeItemType: String get() = get("changeItemType")
    val weightKg: String get() = get("weightKg")
    val bagCount: String get() = get("bagCount")
    val quantityPieces: String get() = get("quantityPieces")
    val categoryOptional: String get() = get("categoryOptional")
    val colorOptional: String get() = get("colorOptional")
    val brandOptional: String get() = get("brandOptional")
    val materialOptional: String get() = get("materialOptional")
    val defectsOptional: String get() = get("defectsOptional")
    val specialRequestOptional: String get() = get("specialRequestOptional")
    val itemNoteOptional: String get() = get("itemNoteOptional")
    val adding: String get() = get("adding")
    val confirmAddItem: String get() = get("confirmAddItem")
    val pickTypeThenService: String get() = get("pickTypeThenService")
    val pickedTypeNowService: String get() = get("pickedTypeNowService")
    val addToCartTitle: String get() = get("addToCartTitle")
    val addToCartHint: String get() = get("addToCartHint")
    val linkedToOrder: String get() = get("linkedToOrder")
    val awaitingSync: String get() = get("awaitingSync")
    val inCart: String get() = get("inCart")
    val selected: String get() = get("selected")
    val notSelected: String get() = get("notSelected")
    val somePaymentsQueued: String get() = get("somePaymentsQueued")
    val addingTotalHint: String get() = get("addingTotalHint")
    val addingToCart: String get() = get("addingToCart")
    val nothingToCharge: String get() = get("nothingToCharge")
    val bagsSuffix: String get() = get("bagsSuffix")
    val piecesSuffix: String get() = get("piecesSuffix")
    val defectsPrefix: String get() = get("defectsPrefix")
    val specialRequestPrefix: String get() = get("specialRequestPrefix")
    val notePrefix: String get() = get("notePrefix")
    val editItem: String get() = get("editItem")
    val deleteItem: String get() = get("deleteItem")
    val deleteReasonRequired: String get() = get("deleteReasonRequired")
    val confirmDeleteItem: String get() = get("confirmDeleteItem")
    val editServiceItem: String get() = get("editServiceItem")
    val editServiceItemHint: String get() = get("editServiceItemHint")
    val saveItem: String get() = get("saveItem")
    val cancelEdit: String get() = get("cancelEdit")
    val scanLabel: String get() = get("scanLabel")
    val productsServices: String get() = get("productsServices")
    val statisticsShort: String get() = get("statisticsShort")
    val settingsShort: String get() = get("settingsShort")
    val customersCachedHint: String get() = get("customersCachedHint")
    val nameAccountOrPhone: String get() = get("nameAccountOrPhone")
    val newServiceTicket: String get() = get("newServiceTicket")
    val customerRegistration: String get() = get("customerRegistration")
    val createCustomer: String get() = get("createCustomer")
    val noCachedMatches: String get() = get("noCachedMatches")
    val noContactOnFile: String get() = get("noContactOnFile")
    val tapToStartIntake: String get() = get("tapToStartIntake")
    val productsHeading: String get() = get("productsHeading")
    val syncedSellOffline: String get() = get("syncedSellOffline")
    val usingLocalCatalog: String get() = get("usingLocalCatalog")
    val addToTillList: String get() = get("addToTillList")
    val servicePrices: String get() = get("servicePrices")
    val scanIntro: String get() = get("scanIntro")
    val scanOrType: String get() = get("scanOrType")
    val searching: String get() = get("searching")
    val searchOnline: String get() = get("searchOnline")
    val startBuiltInScanner: String get() = get("startBuiltInScanner")
    val scanEmptyHint: String get() = get("scanEmptyHint")
    val ticketPrefix: String get() = get("ticketPrefix")
    val productAddToTill: String get() = get("productAddToTill")
    val customerPrefix: String get() = get("customerPrefix")
    val onlineSearchResults: String get() = get("onlineSearchResults")
    val noMatchFound: String get() = get("noMatchFound")
    val archiveNotification: String get() = get("archiveNotification")
    val loading: String get() = get("loading")
    val refreshOrders: String get() = get("refreshOrders")
    val noOrdersToShow: String get() = get("noOrdersToShow")
    val orderPrefix: String get() = get("orderPrefix")
    val walkInCustomer: String get() = get("walkInCustomer")
    val tapToProcessOrder: String get() = get("tapToProcessOrder")
    val openOrderWhenOnline: String get() = get("openOrderWhenOnline")
    val customerLabel: String get() = get("customerLabel")
    val orderStatus: String get() = get("orderStatus")
    val orderAmount: String get() = get("orderAmount")
    val paidPrefix: String get() = get("paidPrefix")
    val cashCollection: String get() = get("cashCollection")
    val outstandingHint: String get() = get("outstandingHint")
    val tenderedForChange: String get() = get("tenderedForChange")
    val chargeOutstanding: String get() = get("chargeOutstanding")
    val defaultChargeOutstanding: String get() = get("defaultChargeOutstanding")
    val enterTenderAndChange: String get() = get("enterTenderAndChange")
    val confirmTakeCash: String get() = get("confirmTakeCash")
    val orderProcessing: String get() = get("orderProcessing")
    val confirmReceived: String get() = get("confirmReceived")
    val confirmDelivered: String get() = get("confirmDelivered")
    val orderItems: String get() = get("orderItems")
    val quantityPrefix: String get() = get("quantityPrefix")
    val paymentRecords: String get() = get("paymentRecords")
    val periodToday: String get() = get("periodToday")
    val periodWeek: String get() = get("periodWeek")
    val periodMonth: String get() = get("periodMonth")
    val periodAll: String get() = get("periodAll")
    val refreshData: String get() = get("refreshData")
    val ordersLabel: String get() = get("ordersLabel")
    val ordersSummary: String get() = get("ordersSummary")
    val ticketsLabel: String get() = get("ticketsLabel")
    val ticketsSummary: String get() = get("ticketsSummary")
    val customersSummary: String get() = get("customersSummary")
    val statisticsWhenOnline: String get() = get("statisticsWhenOnline")
    val refreshNotifications: String get() = get("refreshNotifications")
    val noNotifications: String get() = get("noNotifications")
    val archive: String get() = get("archive")
    val refreshTerminalSettings: String get() = get("refreshTerminalSettings")
    val terminalLabel: String get() = get("terminalLabel")
    val printerDrawerScanner: String get() = get("printerDrawerScanner")
    val hardwareSettingsHint: String get() = get("hardwareSettingsHint")
    val openHardwareSettings: String get() = get("openHardwareSettings")
    val cashHandlingMode: String get() = get("cashHandlingMode")
    val terminalPreferences: String get() = get("terminalPreferences")
    val terminalName: String get() = get("terminalName")
    val autoLockSeconds: String get() = get("autoLockSeconds")
    val autoPrintCopies: String get() = get("autoPrintCopies")
    val copiesSuffix: String get() = get("copiesSuffix")
    val receiptPrinting: String get() = get("receiptPrinting")
    val autoPrintOption: String get() = get("autoPrintOption")
    val manualPrintOption: String get() = get("manualPrintOption")
    val cashRounding: String get() = get("cashRounding")
    val roundingNone: String get() = get("roundingNone")
    val roundingJiao: String get() = get("roundingJiao")
    val roundingYuan: String get() = get("roundingYuan")
    val saveTerminalSettings: String get() = get("saveTerminalSettings")
    val syncStatus: String get() = get("syncStatus")
    val settingsWhenOnline: String get() = get("settingsWhenOnline")
    val hardwareIntro: String get() = get("hardwareIntro")
    val detecting: String get() = get("detecting")
    val refreshHardware: String get() = get("refreshHardware")
    val readingHardware: String get() = get("readingHardware")
    val hardwareModel: String get() = get("hardwareModel")
    val builtInPrinter: String get() = get("builtInPrinter")
    val noBuiltInPrinter: String get() = get("noBuiltInPrinter")
    val statusLabel: String get() = get("statusLabel")
    val connected: String get() = get("connected")
    val notConnected: String get() = get("notConnected")
    val printTestPage: String get() = get("printTestPage")
    val testAndRegister: String get() = get("testAndRegister")
    val builtInScanner: String get() = get("builtInScanner")
    val noBuiltInScanner: String get() = get("noBuiltInScanner")
    val connectedReadyToScan: String get() = get("connectedReadyToScan")
    val startScanTest: String get() = get("startScanTest")
    val drawerTitle: String get() = get("drawerTitle")
    val drawerConnectedHint: String get() = get("drawerConnectedHint")
    val drawerUnavailable: String get() = get("drawerUnavailable")
    val authoriseAndTestDrawer: String get() = get("authoriseAndTestDrawer")
    val hardwareManagerOnly: String get() = get("hardwareManagerOnly")
    val registeredDevices: String get() = get("registeredDevices")
    val noRegisteredDevicesOnline: String get() = get("noRegisteredDevicesOnline")
    val noRegisteredDevicesOffline: String get() = get("noRegisteredDevicesOffline")
    val defaultReceiptPrinter: String get() = get("defaultReceiptPrinter")
    val deviceEnabled: String get() = get("deviceEnabled")
    val deviceDisabled: String get() = get("deviceDisabled")
    val bluetoothPrinter: String get() = get("bluetoothPrinter")
    val bluetoothIntro: String get() = get("bluetoothIntro")
    val authoriseBluetooth: String get() = get("authoriseBluetooth")
    val readPairedDevices: String get() = get("readPairedDevices")
    val noPairedPrinters: String get() = get("noPairedPrinters")
    val paired: String get() = get("paired")
    val testAndBindTo: String get() = get("testAndBindTo")
    val needRegisteredPrinter: String get() = get("needRegisteredPrinter")
    val localReceiptQueue: String get() = get("localReceiptQueue")
    val receiptQueueSummary: String get() = get("receiptQueueSummary")
    val printNextReceipt: String get() = get("printNextReceipt")
    val useDefaultPrinterHint: String get() = get("useDefaultPrinterHint")
    val openTicket: String get() = get("openTicket")
}

private val COPY_ZH_VALUES: Map<String, String> = mapOf(
    "online" to "已联网",
    "offline" to "离线",
    "offlineMode" to "离线模式",
    "syncing" to "同步中",
    "synchronize" to "同步",
    "pendingSalesSuffix" to "待同步 %d 笔",
    "catalogTitle" to "商品目录",
    "cartEmpty" to "购物车为空。",
    "amountDue" to "应收金额",
    "checkout" to "结算",
    "cashTendered" to "实收现金",
    "changeDue" to "应找零",
    "subtotal" to "小计",
    "tax" to "税费",
    "rounding" to "抹零",
    "total" to "合计",
    "receiptPrint" to "打印小票",
    "receiptNone" to "不打小票",
    "receiptQueued" to "收据已加入本地打印队列。",
    "saleSubmittedOnline" to "现金订单已提交；如网络在响应中断开，将使用同一订单号安全补传。",
    "saleQueuedOffline" to "现金订单已写入本地队列；联网后将使用同一订单号安全同步。",
    "cashPaymentRecorded" to "现金收款已记录。",
    "tenderBelowTotal" to "实收金额不能少于应收金额。",
    "cartIsEmpty" to "购物车为空。",
    "priceChanged" to "价格、优惠或税费已更新，请重新确认结款。",
    "shiftAndDrawerRequired" to "现金收款需要已开始的班次和已打开的钱箱。",
    "requiresNetwork" to "该操作需要联网；恢复网络后即可继续。",
    "networkError" to "网络错误，请检查本机网络后重试。",
    "genericFailure" to "操作未完成：请检查网络或稍后重试。",
    "staleCatalogWarning" to "本机商品与价格已有 %d 小时未更新，请尽快同步后再继续销售。",
    "printerNotConnected" to "打印机未连接。",
    "printerOutOfPaper" to "打印机缺纸，请装入热敏纸后重试。",
    "printerCoverOpen" to "打印机仓盖未关闭。",
    "printerOverheated" to "打印机温度过高，请稍后重试。",
    "drawerOpened" to "钱箱已打开。",
    "drawerDisconnected" to "钱箱服务已断开，请刷新硬件状态后重试。",
    "tabWorkspace" to "工作台",
    "tabSale" to "收银",
    "tabIntake" to "开单",
    "tabTickets" to "工单",
    "tabMore" to "更多",
    "menuMore" to "更多",
    "menuCustomers" to "客户管理",
    "menuCatalog" to "商品与服务目录",
    "menuScan" to "扫码查询",
    "menuOrders" to "订单管理",
    "menuOrderDetail" to "订单详情",
    "menuStatistics" to "经营数据",
    "menuNotifications" to "通知中心",
    "menuShift" to "班次与收银",
    "menuSettings" to "终端设置",
    "menuHardware" to "打印与硬件",
    "ticketDraft" to "草稿",
    "ticketPending" to "待处理",
    "ticketInProgress" to "处理中",
    "ticketReadyToPick" to "待取件",
    "ticketPickedUp" to "已取件",
    "ticketCancelled" to "已取消",
    "ticketUnknown" to "异常",
    "itemPendingWash" to "待处理",
    "itemWashing" to "处理中",
    "itemDone" to "已完成",
    "itemReadyToPick" to "待取件",
    "typeCloth" to "衣物",
    "typeCar" to "车辆",
    "typeShoe" to "鞋类",
    "typeCarpet" to "地毯",
    "priorityCritical" to "紧急",
    "priorityUrgent" to "加急",
    "priorityNormal" to "普通",
    "devicePrinter" to "打印机",
    "deviceScanner" to "扫码器",
    "deviceCashDrawer" to "钱箱",
    "moreNeedsNetwork" to "%s 需要联网加载；当前仍可使用本机缓存的客户、目录和工单。",
    "workspaceTitle" to "工作台",
    "workspaceOnlineHint" to "设备已联网，可实时核验收银状态",
    "workspaceOfflineHint" to "设备离线，使用本机已缓存的收银数据",
    "metricCatalog" to "商品目录",
    "metricPendingOrders" to "待同步订单",
    "metricFailedOrders" to "异常订单",
    "cashSectionTitle" to "现金收银",
    "cashReadyOffline" to "班次和钱箱已就绪，可以安全离线收取现金。",
    "cashCheckedOnline" to "进入收银后会实时核验班次和钱箱状态。",
    "cashNeedsSync" to "恢复网络并同步班次和钱箱后，即可继续离线收银。",
    "openTill" to "进入收银",
    "synchronizing" to "正在同步…",
    "intakeTitle" to "客户接待",
    "intakeOnlineHint" to "查询客户档案，选择客户后创建服务工单。",
    "intakeOfflineHint" to "离线时可查询已缓存客户；创建客户和工单需要联网。",
    "newCustomer" to "＋ 新建客户",
    "newCustomerShort" to "新建客户",
    "lookupTitle" to "查询客户档案",
    "lookupHint" to "输入客户姓名、手机号或账户名称。",
    "lookupLabel" to "姓名、电话或账户",
    "lookupPlaceholder" to "例如：Awa Diop / 77 000 0000",
    "search" to "查询",
    "customerRecord" to "客户档案",
    "change" to "更换",
    "contactDetails" to "联系方式",
    "noContactDetails" to "未填写联系电话或邮箱",
    "customerStatusActive" to "客户状态：正常",
    "customerStatusPrefix" to "客户状态：%s",
    "recentWork" to "最近处理",
    "newestFirst" to "最新在上",
    "noCachedTickets" to "暂无已缓存的服务订单。创建第一笔订单后会显示在这里。",
    "newOrder" to "＋ 新增订单",
    "intakeEmptyTitle" to "输入客户信息开始查询",
    "intakeEmptyDescription" to "默认不会展示全部客户资料。请输入姓名、手机号或账户名称查找客户。",
    "intakeNoMatchTitle" to "未找到客户",
    "intakeNoMatchDescription" to "没有与“%s”匹配的已缓存客户。请核对信息或新建客户。",
    "matchingCustomers" to "匹配客户",
    "matchingCustomersCount" to "%d 条本机匹配结果，点击后继续开单。",
    "noPhoneOnFile" to "未填写手机号",
    "select" to "选择",
    "serviceOrder" to "服务订单",
    "itemsCountSuffix" to "%d 项",
    "expectedPickup" to "预计取件：%s",
    "continueProcessing" to "继续处理 ›",
    "ticketsTitle" to "工单",
    "ticketsEmpty" to "本机暂时没有已同步工单。",
    "serviceTicket" to "服务工单",
    "syncLocalData" to "同步本机数据",
    "backToMore" to "返回更多",
    "refreshing" to "正在刷新…",
    "refreshStatus" to "刷新状态",
    "shiftTitle" to "班次与收银",
    "shiftIntro" to "班次、收银台和现金盘点分别记录；开始班次后，再开启收银台即可安全进行现金收款。",
    "shiftOfflineNotice" to "当前离线：可继续销售已缓存商品，但班次、收银台和现金流水必须恢复联网后操作。",
    "shiftLoading" to "正在读取班次与收银台状态",
    "shiftLoadFailed" to "若加载失败，请确认设备联网后点击“刷新状态”。",
    "reload" to "重新加载",
    "staffShift" to "员工班次",
    "shiftOpen" to "当前上班中。可以开始休息，或继续收银。",
    "shiftOnBreak" to "当前处于休息中。结束休息后才能继续收银。",
    "shiftClosed" to "当前未开始班次。开始班次后，现金销售才能关联到本次交接。",
    "clockingIn" to "正在开始班次…",
    "clockIn" to "开始班次",
    "breakStarting" to "正在开始…",
    "breakStart" to "开始休息",
    "clockOut" to "结束班次",
    "breakEnding" to "正在结束休息…",
    "breakEnd" to "结束休息",
    "registerTitle" to "收银台",
    "cashModeNone" to "此终端未启用现金收款。可以查看收银台状态，但不能收取现金。",
    "cashModeUntracked" to "本终端接受现金，但门店不跟踪钱箱金额。",
    "cashModePersonal" to "本终端使用员工随身现金；每位员工需要开启自己的现金会话。",
    "cashModeShared" to "本终端使用共享钱箱；开启后可记录备用金、现金存入和现金支出。",
    "openingFloatRequired" to "开柜备用金 *",
    "openingFloatOptional" to "开柜备用金（可选）",
    "openingFloatNeeded" to "此门店要求填写开柜备用金后才能开启收银台。",
    "registerOpening" to "正在开启…",
    "openMyCashSession" to "开启我的现金会话",
    "openRegister" to "开启收银台",
    "registerStatus" to "收银台状态",
    "thisTerminal" to "本终端",
    "opened" to "已开启",
    "notOpened" to "未开启",
    "cashSession" to "现金会话",
    "myPersonalCash" to "我的随身现金",
    "sharedDrawer" to "共享钱箱",
    "expectedCash" to "系统应有现金",
    "thisRegister" to "本次收银台",
    "netSales" to "净销售额",
    "outstandingOrders" to "待收订单",
    "awaitingProcessing" to "等待处理",
    "cashInOut" to "现金存入 / 支出",
    "amountLabel" to "金额",
    "reasonLabel" to "原因（至少 3 个字）",
    "recording" to "正在记录…",
    "payIn" to "现金存入",
    "payOut" to "现金支出",
    "countAndCloseMyCash" to "盘点并关闭我的现金",
    "closeRegisterZReport" to "关闭收银台并生成 Z Report",
    "closeRegisterHint" to "关闭后会生成或更新本次交接记录。请确认实点金额。",
    "countedCashRequired" to "实点现金 *",
    "countedCashOptional" to "实点现金（可选）",
    "handoverNotes" to "交接备注（可选）",
    "countedCashNeeded" to "此门店要求填写实点现金后才能关闭。",
    "closing" to "正在关闭…",
    "confirmClose" to "确认关闭",
    "notYet" to "暂不关闭",
    "closeNeedsManager" to "请先由当前员工开启或关闭自己的现金会话；只有店主或经理可以最终关闭收银台。",
    "recentZReports" to "最近 Z Report",
    "varianceLabel" to "差额",
    "localData" to "本机数据",
    "cachedSummary" to "已缓存 %d 个商品；%d 笔现金订单等待同步。",
    "confirmClockOutTitle" to "确认结束班次？",
    "confirmClockOutBody" to "结束后需要重新输入 PIN 并开始班次，才能继续收银。",
    "checkAgain" to "再检查一下",
    "confirmClockOut" to "确认结束",
    "readyOnlineCash" to "准备在线现金收银",
    "readyOfflineCash" to "准备离线现金收银",
    "cashDisabledStore" to "此门店当前没有启用现金收款。请由管理员在门店 POS 设置中启用现金支付后重新同步。",
    "cashNeedsShiftOnline" to "现金订单需要关联已开始的班次和已打开的钱箱。",
    "cashNeedsShiftOffline" to "离线现金订单必须关联已开始的班次和已打开的钱箱，避免断网时的现金记录失去归属。",
    "startMyShift" to "开始我的班次",
    "shiftStarted" to "班次已开始。",
    "drawerOpeningCash" to "开箱现金",
    "openDrawerAndSync" to "打开钱箱并同步",
    "newCustomerTitle" to "新建客户",
    "newCustomerHint" to "先建立客户账户，随后可立即创建服务工单。",
    "back" to "返回",
    "customerInfo" to "客户信息",
    "customerName" to "客户姓名",
    "customerNamePlaceholder" to "例如：Awa Diop",
    "phoneNumber" to "手机号码",
    "phonePlaceholder" to "例如：77 000 0000",
    "saving" to "正在保存…",
    "saveCustomer" to "保存客户",
    "newTicketTitle" to "新建服务工单",
    "newTicketHint" to "项目与价格将在下一步录入。",
    "ticketCustomer" to "服务客户",
    "ticketType" to "工单类型",
    "typeLaundry" to "洗衣护理",
    "typeCarWash" to "车辆清洗",
    "priorityTitle" to "优先级",
    "expectedPickupField" to "预计取件时间（可选）",
    "remarkOptional" to "备注（可选）",
    "remarkPlaceholder" to "通用服务备注",
    "ticketNeedsNetwork" to "创建工单需要联网；恢复网络后即可继续。",
    "creating" to "正在创建…",
    "createTicket" to "创建工单",
    "backToTickets" to "返回工单列表",
    "serviceItemsCount" to "%d 个服务项目",
    "ticketOfflineNotice" to "离线模式：可查看已缓存的项目和收款队列；项目处理与取件需恢复网络。",
    "ticketFlow" to "工单流转",
    "cancelReasonRequired" to "取消原因（选择取消时必填）",
    "confirmPickedUp" to "确认客户已取件（需校验结算）",
    "updateToStatus" to "更新为“%s”",
    "serviceItems" to "服务项目",
    "noServiceItems" to "此工单尚未添加服务项目。",
    "alreadyBilled" to "已加入订单，不能重复结算",
    "pendingSyncNoBill" to "本机收款待同步，不能重复结算",
    "appendServiceItem" to "追加服务项目",
    "noCachedServices" to "没有已缓存的服务项目，请先同步。",
    "noServicesForType" to "当前工单类型没有可追加的服务项目，请先在后台配置服务目录。",
    "pendingService" to "待追加服务",
    "itemTypePrefix" to "物品类型：%s",
    "changeItemType" to "更换物品类型",
    "weightKg" to "重量（kg）",
    "bagCount" to "袋数",
    "quantityPieces" to "数量（件）",
    "categoryOptional" to "分类（可选）",
    "colorOptional" to "颜色（可选）",
    "brandOptional" to "品牌（可选）",
    "materialOptional" to "材质（可选）",
    "defectsOptional" to "瑕疵（可选）",
    "specialRequestOptional" to "特殊要求（可选）",
    "itemNoteOptional" to "项目备注（可选）",
    "adding" to "正在添加…",
    "confirmAddItem" to "确认添加项目",
    "pickTypeThenService" to "先选择物品类型，再选择可提供该服务的价目。",
    "pickedTypeNowService" to "已选择“%s”，请选择适用服务。",
    "addToCartTitle" to "加入收银购物车",
    "addToCartHint" to "选择本次要结算的项目。已加入订单、待同步项目和当前购物车项目会自动排除。",
    "linkedToOrder" to "已关联订单",
    "awaitingSync" to "等待同步",
    "inCart" to "已在购物车",
    "selected" to "已选择",
    "notSelected" to "未选择",
    "somePaymentsQueued" to "部分项目的现金收款仍在本机队列中；其余未结算项目可以单独收款。",
    "addingTotalHint" to "本次加入 %s；可与零售商品或同一客户的其他工单一起现金结算。",
    "addingToCart" to "正在加入…",
    "nothingToCharge" to "没有可在本次结算的项目。",
    "bagsSuffix" to "%s 袋",
    "piecesSuffix" to "%s 件",
    "defectsPrefix" to "瑕疵：%s",
    "specialRequestPrefix" to "特殊要求：%s",
    "notePrefix" to "备注：%s",
    "editItem" to "编辑项目",
    "deleteItem" to "删除项目",
    "deleteReasonRequired" to "删除原因（必填）",
    "confirmDeleteItem" to "确认删除项目",
    "editServiceItem" to "编辑服务项目",
    "editServiceItemHint" to "先选物品类型，再选择该类型可用的服务。收费单价和改价权限仍由后台规则校验。",
    "saveItem" to "保存项目",
    "cancelEdit" to "取消编辑",
    "scanLabel" to "扫描标签",
    "productsServices" to "产品服务",
    "statisticsShort" to "统计数据",
    "settingsShort" to "设置",
    "customersCachedHint" to "客户档案保存在本机；联网时新建客户会立即同步。",
    "nameAccountOrPhone" to "姓名、账户或手机号",
    "newServiceTicket" to "新建服务工单",
    "customerRegistration" to "客户建档",
    "createCustomer" to "创建客户",
    "noCachedMatches" to "没有匹配的已缓存客户。",
    "noContactOnFile" to "未填写联系方式",
    "tapToStartIntake" to "点击后直接带入服务开单",
    "productsHeading" to "商品",
    "syncedSellOffline" to "已同步，可离线销售",
    "usingLocalCatalog" to "使用本地商品目录",
    "addToTillList" to "加入收银清单",
    "servicePrices" to "服务价目",
    "scanIntro" to "支持内置扫码器、扫码枪键盘输入，也可手动输入工单号、订单号、手机号或客户名。联网时会调用和 POS Web 相同的全局检索。",
    "scanOrType" to "扫描或输入关键词",
    "searching" to "正在查询…",
    "searchOnline" to "联网查询",
    "startBuiltInScanner" to "启动内置扫码器",
    "scanEmptyHint" to "输入后可查询本机缓存，也可联网查询完整订单、工单和客户。",
    "ticketPrefix" to "工单 %s",
    "productAddToTill" to "商品 %s · 加入收银",
    "customerPrefix" to "客户 %s",
    "onlineSearchResults" to "联网查询结果",
    "noMatchFound" to "未找到已缓存记录；可点击联网查询。",
    "archiveNotification" to "归档通知",
    "loading" to "正在加载…",
    "refreshOrders" to "刷新订单",
    "noOrdersToShow" to "当前没有可显示订单，联网后点击刷新。",
    "orderPrefix" to "订单 %s",
    "walkInCustomer" to "散客",
    "tapToProcessOrder" to "点击处理订单",
    "openOrderWhenOnline" to "联网后打开一张订单查看详情。",
    "customerLabel" to "客户",
    "orderStatus" to "订单状态",
    "orderAmount" to "订单金额",
    "paidPrefix" to "已收 %s",
    "cashCollection" to "现金收款",
    "outstandingHint" to "待收 %s。线上订单收款会使用当前班次与钱箱。",
    "tenderedForChange" to "实收现金（用于找零）",
    "chargeOutstanding" to "按待收金额收款",
    "defaultChargeOutstanding" to "现金收款将默认按待收金额入账。",
    "enterTenderAndChange" to "输入实收金额并找零",
    "confirmTakeCash" to "确认收取现金",
    "orderProcessing" to "订单处理",
    "confirmReceived" to "确认接单",
    "confirmDelivered" to "确认交付",
    "orderItems" to "订单项目",
    "quantityPrefix" to "数量 %s",
    "paymentRecords" to "收款记录",
    "periodToday" to "今天",
    "periodWeek" to "本周",
    "periodMonth" to "本月",
    "periodAll" to "全部",
    "refreshData" to "刷新数据",
    "ordersLabel" to "订单",
    "ordersSummary" to "%d 笔 · 未结 %d 笔",
    "ticketsLabel" to "工单",
    "ticketsSummary" to "%d 张 · 超期 %d 张",
    "customersSummary" to "%d 位 · 今日新增 %d 位",
    "statisticsWhenOnline" to "联网后点击刷新加载经营数据。",
    "refreshNotifications" to "刷新通知",
    "noNotifications" to "当前没有可显示通知，联网后点击刷新。",
    "archive" to "归档",
    "refreshTerminalSettings" to "刷新终端设置",
    "terminalLabel" to "终端",
    "printerDrawerScanner" to "打印、钱箱与扫码器",
    "hardwareSettingsHint" to "查看本机内置设备状态，测试并登记收据打印机与扫码器。",
    "openHardwareSettings" to "打开硬件设置",
    "cashHandlingMode" to "收银方式",
    "terminalPreferences" to "本机终端偏好",
    "terminalName" to "终端名称",
    "autoLockSeconds" to "自动锁定秒数",
    "autoPrintCopies" to "自动打印份数",
    "copiesSuffix" to "%s 联",
    "receiptPrinting" to "收据打印",
    "autoPrintOption" to "自动打印",
    "manualPrintOption" to "手动打印",
    "cashRounding" to "现金取整",
    "roundingNone" to "不取整",
    "roundingJiao" to "取整到角",
    "roundingYuan" to "取整到元",
    "saveTerminalSettings" to "保存终端设置",
    "syncStatus" to "同步状态",
    "settingsWhenOnline" to "联网后点击刷新加载终端设置。",
    "hardwareIntro" to "这里直接读取 Android POS 的原生硬件服务；设备登记会沿用原 POS Web 的终端级配置。",
    "detecting" to "正在检测…",
    "refreshHardware" to "刷新硬件状态",
    "readingHardware" to "正在读取本机硬件状态。",
    "hardwareModel" to "硬件型号",
    "builtInPrinter" to "内置收据打印机",
    "noBuiltInPrinter" to "当前设备未检测到受支持的内置打印机",
    "statusLabel" to "状态",
    "connected" to "已连接",
    "notConnected" to "未连接",
    "printTestPage" to "打印测试页",
    "testAndRegister" to "测试并登记",
    "builtInScanner" to "内置扫码器",
    "noBuiltInScanner" to "当前设备未检测到受支持的内置扫码器",
    "connectedReadyToScan" to "已连接，可开始扫描",
    "startScanTest" to "启动扫码测试",
    "drawerTitle" to "钱箱",
    "drawerConnectedHint" to "本机钱箱服务已连接；手动测试会先向服务端申请审计授权。",
    "drawerUnavailable" to "当前设备没有可用的钱箱服务。",
    "authoriseAndTestDrawer" to "申请授权并测试开钱箱",
    "hardwareManagerOnly" to "只有店主或经理可以登记设备、修改默认打印机和手动测试钱箱。",
    "registeredDevices" to "已登记设备",
    "noRegisteredDevicesOnline" to "尚未读取到本终端已登记的设备。",
    "noRegisteredDevicesOffline" to "恢复网络后可读取终端已登记的设备。",
    "defaultReceiptPrinter" to "默认收据机",
    "deviceEnabled" to "已启用",
    "deviceDisabled" to "未启用",
    "bluetoothPrinter" to "外接蓝牙打印机",
    "bluetoothIntro" to "先在 Android 系统蓝牙中完成配对，再在这里测试并绑定到后台登记的打印机。",
    "authoriseBluetooth" to "授权蓝牙",
    "readPairedDevices" to "读取已配对设备",
    "noPairedPrinters" to "尚未读取到已配对蓝牙打印机。",
    "paired" to "已配对",
    "testAndBindTo" to "测试并绑定到 %s",
    "needRegisteredPrinter" to "请先在租户后台为当前终端创建并启用一个外接打印机设备。",
    "localReceiptQueue" to "本地收据队列",
    "receiptQueueSummary" to "待打印 %d 张；失败 %d 张（为避免重复出纸，失败任务不会自动重试）。",
    "printNextReceipt" to "打印下一张收据",
    "useDefaultPrinterHint" to "请使用后台登记的默认收据打印机打印，队列会保留在本机。",
    "openTicket" to "查看并处理工单",
)

private val COPY_EN_VALUES: Map<String, String> = mapOf(
    "online" to "Online",
    "offline" to "Offline",
    "offlineMode" to "Offline mode",
    "syncing" to "Syncing",
    "synchronize" to "Sync",
    "pendingSalesSuffix" to "%d waiting to sync",
    "catalogTitle" to "Catalogue",
    "cartEmpty" to "The cart is empty.",
    "amountDue" to "Amount due",
    "checkout" to "Checkout",
    "cashTendered" to "Cash received",
    "changeDue" to "Change due",
    "subtotal" to "Subtotal",
    "tax" to "Tax",
    "rounding" to "Rounding",
    "total" to "Total",
    "receiptPrint" to "Print receipt",
    "receiptNone" to "No receipt",
    "receiptQueued" to "The receipt is in this terminal's print queue.",
    "saleSubmittedOnline" to "Cash order submitted. If the connection drops before the reply arrives, it is resent safely under the same order number.",
    "saleQueuedOffline" to "Cash order saved to this terminal. It syncs under the same order number once the network returns.",
    "cashPaymentRecorded" to "Cash payment recorded.",
    "tenderBelowTotal" to "Cash received cannot be less than the amount due.",
    "cartIsEmpty" to "The cart is empty.",
    "priceChanged" to "The price, discount or tax changed. Confirm the payment again.",
    "shiftAndDrawerRequired" to "Taking cash needs an open shift and an open drawer.",
    "requiresNetwork" to "This needs a connection. Try again once the network is back.",
    "networkError" to "Network error. Check this terminal's connection and try again.",
    "genericFailure" to "That did not finish. Check the network or try again shortly.",
    "staleCatalogWarning" to "Products and prices on this terminal are %d hours old. Sync before selling further.",
    "printerNotConnected" to "The printer is not connected.",
    "printerOutOfPaper" to "The printer is out of paper. Load thermal paper and try again.",
    "printerCoverOpen" to "The printer cover is open.",
    "printerOverheated" to "The printer is too hot. Try again shortly.",
    "drawerOpened" to "Cash drawer opened.",
    "drawerDisconnected" to "The cash drawer service disconnected. Refresh the hardware status and try again.",
    "tabWorkspace" to "Home",
    "tabSale" to "Till",
    "tabIntake" to "New ticket",
    "tabTickets" to "Tickets",
    "tabMore" to "More",
    "menuMore" to "More",
    "menuCustomers" to "Customers",
    "menuCatalog" to "Products and services",
    "menuScan" to "Scan to look up",
    "menuOrders" to "Orders",
    "menuOrderDetail" to "Order detail",
    "menuStatistics" to "Business figures",
    "menuNotifications" to "Notifications",
    "menuShift" to "Shift and cash",
    "menuSettings" to "Terminal settings",
    "menuHardware" to "Printing and hardware",
    "ticketDraft" to "Draft",
    "ticketPending" to "Waiting",
    "ticketInProgress" to "In progress",
    "ticketReadyToPick" to "Ready for pickup",
    "ticketPickedUp" to "Picked up",
    "ticketCancelled" to "Cancelled",
    "ticketUnknown" to "Unknown",
    "itemPendingWash" to "Waiting",
    "itemWashing" to "In progress",
    "itemDone" to "Done",
    "itemReadyToPick" to "Ready for pickup",
    "typeCloth" to "Clothing",
    "typeCar" to "Vehicle",
    "typeShoe" to "Shoes",
    "typeCarpet" to "Carpet",
    "priorityCritical" to "Critical",
    "priorityUrgent" to "Rush",
    "priorityNormal" to "Normal",
    "devicePrinter" to "Printer",
    "deviceScanner" to "Scanner",
    "deviceCashDrawer" to "Cash drawer",
    "moreNeedsNetwork" to "%s needs a connection. Cached customers, catalogue and tickets stay available on this terminal.",
    "workspaceTitle" to "Home",
    "workspaceOnlineHint" to "This terminal is online; till status is checked live.",
    "workspaceOfflineHint" to "This terminal is offline and using its cached till data.",
    "metricCatalog" to "Catalogue",
    "metricPendingOrders" to "Waiting to sync",
    "metricFailedOrders" to "Rejected",
    "cashSectionTitle" to "Cash till",
    "cashReadyOffline" to "Shift and drawer are ready; cash can be taken safely offline.",
    "cashCheckedOnline" to "Shift and drawer are checked live when you open the till.",
    "cashNeedsSync" to "Restore the network and sync the shift and drawer to take cash offline again.",
    "openTill" to "Open the till",
    "synchronizing" to "Syncing…",
    "intakeTitle" to "Customer intake",
    "intakeOnlineHint" to "Look up a customer, then create a service ticket.",
    "intakeOfflineHint" to "Offline you can search cached customers; creating a customer or ticket needs a connection.",
    "newCustomer" to "＋ New customer",
    "newCustomerShort" to "New customer",
    "lookupTitle" to "Find a customer",
    "lookupHint" to "Enter a name, phone number or account name.",
    "lookupLabel" to "Name, phone or account",
    "lookupPlaceholder" to "For example: Awa Diop / 77 000 0000",
    "search" to "Search",
    "customerRecord" to "Customer record",
    "change" to "Change",
    "contactDetails" to "Contact",
    "noContactDetails" to "No phone or email on file",
    "customerStatusActive" to "Status: active",
    "customerStatusPrefix" to "Status: %s",
    "recentWork" to "Recent work",
    "newestFirst" to "Newest first",
    "noCachedTickets" to "No cached service orders yet. The first one you create appears here.",
    "newOrder" to "＋ New order",
    "intakeEmptyTitle" to "Search to begin",
    "intakeEmptyDescription" to "The full customer list is not shown by default. Search by name, phone or account.",
    "intakeNoMatchTitle" to "No customer found",
    "intakeNoMatchDescription" to "No cached customer matches “%s”. Check the details or create a customer.",
    "matchingCustomers" to "Matching customers",
    "matchingCustomersCount" to "%d match on this terminal. Tap one to start a ticket.",
    "noPhoneOnFile" to "No phone on file",
    "select" to "Select",
    "serviceOrder" to "Service order",
    "itemsCountSuffix" to "%d items",
    "expectedPickup" to "Pickup: %s",
    "continueProcessing" to "Continue ›",
    "ticketsTitle" to "Tickets",
    "ticketsEmpty" to "No synced tickets on this terminal yet.",
    "serviceTicket" to "Service ticket",
    "syncLocalData" to "Sync this terminal",
    "backToMore" to "Back to More",
    "refreshing" to "Refreshing…",
    "refreshStatus" to "Refresh status",
    "shiftTitle" to "Shift and cash",
    "shiftIntro" to "Shift, register and cash count are recorded separately. Clock in, then open the register to take cash safely.",
    "shiftOfflineNotice" to "Offline: you can keep selling cached products, but shift, register and cash movements need a connection.",
    "shiftLoading" to "Loading shift and register status",
    "shiftLoadFailed" to "If this does not load, check the connection and tap “Refresh status”.",
    "reload" to "Reload",
    "staffShift" to "Staff shift",
    "shiftOpen" to "Clocked in. You can start a break or keep selling.",
    "shiftOnBreak" to "On break. End the break before selling again.",
    "shiftClosed" to "Not clocked in. Clock in so cash sales attach to this handover.",
    "clockingIn" to "Clocking in…",
    "clockIn" to "Clock in",
    "breakStarting" to "Starting…",
    "breakStart" to "Start break",
    "clockOut" to "Clock out",
    "breakEnding" to "Ending break…",
    "breakEnd" to "End break",
    "registerTitle" to "Register",
    "cashModeNone" to "Cash is not enabled on this terminal. You can view the register but not take cash.",
    "cashModeUntracked" to "This terminal takes cash, but the store does not track the drawer amount.",
    "cashModePersonal" to "This terminal uses personal cash floats; each member of staff opens their own cash session.",
    "cashModeShared" to "This terminal uses a shared drawer. Once open you can record the float, pay-ins and pay-outs.",
    "openingFloatRequired" to "Opening float *",
    "openingFloatOptional" to "Opening float (optional)",
    "openingFloatNeeded" to "This store requires an opening float before the register can be opened.",
    "registerOpening" to "Opening…",
    "openMyCashSession" to "Open my cash session",
    "openRegister" to "Open the register",
    "registerStatus" to "Register status",
    "thisTerminal" to "This terminal",
    "opened" to "Open",
    "notOpened" to "Closed",
    "cashSession" to "Cash session",
    "myPersonalCash" to "My personal float",
    "sharedDrawer" to "Shared drawer",
    "expectedCash" to "Expected cash",
    "thisRegister" to "This register",
    "netSales" to "Net sales",
    "outstandingOrders" to "Unpaid orders",
    "awaitingProcessing" to "Awaiting processing",
    "cashInOut" to "Pay in / pay out",
    "amountLabel" to "Amount",
    "reasonLabel" to "Reason (at least 3 characters)",
    "recording" to "Recording…",
    "payIn" to "Pay in",
    "payOut" to "Pay out",
    "countAndCloseMyCash" to "Count and close my cash",
    "closeRegisterZReport" to "Close the register and print a Z report",
    "closeRegisterHint" to "Closing creates or updates this handover record. Confirm the counted amount.",
    "countedCashRequired" to "Counted cash *",
    "countedCashOptional" to "Counted cash (optional)",
    "handoverNotes" to "Handover notes (optional)",
    "countedCashNeeded" to "This store requires a counted amount before closing.",
    "closing" to "Closing…",
    "confirmClose" to "Confirm closing",
    "notYet" to "Not yet",
    "closeNeedsManager" to "Each member of staff opens and closes their own cash session; only an owner or manager closes the register itself.",
    "recentZReports" to "Recent Z reports",
    "varianceLabel" to "Variance",
    "localData" to "This terminal's data",
    "cachedSummary" to "%d products cached; %d cash orders waiting to sync.",
    "confirmClockOutTitle" to "Clock out?",
    "confirmClockOutBody" to "You will need to enter your PIN and clock in again before selling.",
    "checkAgain" to "Let me check",
    "confirmClockOut" to "Clock out",
    "readyOnlineCash" to "Ready for online cash",
    "readyOfflineCash" to "Ready for offline cash",
    "cashDisabledStore" to "Cash is not enabled for this store. An administrator must enable cash in the store's POS settings, then sync again.",
    "cashNeedsShiftOnline" to "A cash order needs an open shift and an open drawer.",
    "cashNeedsShiftOffline" to "An offline cash order must attach to an open shift and an open drawer, so cash taken without a network still has an owner.",
    "startMyShift" to "Start my shift",
    "shiftStarted" to "Shift started.",
    "drawerOpeningCash" to "Opening cash",
    "openDrawerAndSync" to "Open the drawer and sync",
    "newCustomerTitle" to "New customer",
    "newCustomerHint" to "Create the customer account first; you can raise a ticket straight after.",
    "back" to "Back",
    "customerInfo" to "Customer details",
    "customerName" to "Customer name",
    "customerNamePlaceholder" to "For example: Awa Diop",
    "phoneNumber" to "Phone number",
    "phonePlaceholder" to "For example: 77 000 0000",
    "saving" to "Saving…",
    "saveCustomer" to "Save customer",
    "newTicketTitle" to "New service ticket",
    "newTicketHint" to "Items and prices are entered in the next step.",
    "ticketCustomer" to "Customer",
    "ticketType" to "Ticket type",
    "typeLaundry" to "Laundry",
    "typeCarWash" to "Car wash",
    "priorityTitle" to "Priority",
    "expectedPickupField" to "Expected pickup (optional)",
    "remarkOptional" to "Note (optional)",
    "remarkPlaceholder" to "General service note",
    "ticketNeedsNetwork" to "Creating a ticket needs a connection. Try again once the network is back.",
    "creating" to "Creating…",
    "createTicket" to "Create the ticket",
    "backToTickets" to "Back to tickets",
    "serviceItemsCount" to "%d service items",
    "ticketOfflineNotice" to "Offline: cached items and the payment queue are visible; processing and pickup need a connection.",
    "ticketFlow" to "Ticket progress",
    "cancelReasonRequired" to "Cancellation reason (required to cancel)",
    "confirmPickedUp" to "Confirm the customer collected it (payment is checked)",
    "updateToStatus" to "Move to “%s”",
    "serviceItems" to "Service items",
    "noServiceItems" to "No service items on this ticket yet.",
    "alreadyBilled" to "Already on an order; it cannot be charged twice",
    "pendingSyncNoBill" to "Payment is waiting to sync on this terminal; it cannot be charged twice",
    "appendServiceItem" to "Add a service item",
    "noCachedServices" to "No cached service items. Sync first.",
    "noServicesForType" to "No service items for this ticket type. Configure the service catalogue in the back office first.",
    "pendingService" to "Service to add",
    "itemTypePrefix" to "Item type: %s",
    "changeItemType" to "Change item type",
    "weightKg" to "Weight (kg)",
    "bagCount" to "Bags",
    "quantityPieces" to "Quantity (pieces)",
    "categoryOptional" to "Category (optional)",
    "colorOptional" to "Colour (optional)",
    "brandOptional" to "Brand (optional)",
    "materialOptional" to "Material (optional)",
    "defectsOptional" to "Defects (optional)",
    "specialRequestOptional" to "Special request (optional)",
    "itemNoteOptional" to "Item note (optional)",
    "adding" to "Adding…",
    "confirmAddItem" to "Add the item",
    "pickTypeThenService" to "Choose the item type first, then a price for that service.",
    "pickedTypeNowService" to "“%s” selected. Now choose the service.",
    "addToCartTitle" to "Add to the till cart",
    "addToCartHint" to "Choose the items to charge now. Items already on an order, waiting to sync, or in the cart are left out.",
    "linkedToOrder" to "On an order",
    "awaitingSync" to "Waiting to sync",
    "inCart" to "In the cart",
    "selected" to "Selected",
    "notSelected" to "Not selected",
    "somePaymentsQueued" to "Cash for some items is still queued on this terminal; the rest can be charged separately.",
    "addingTotalHint" to "Adding %s. It can be paid in cash together with retail products or this customer's other tickets.",
    "addingToCart" to "Adding…",
    "nothingToCharge" to "Nothing to charge on this ticket.",
    "bagsSuffix" to "%s bags",
    "piecesSuffix" to "%s pieces",
    "defectsPrefix" to "Defects: %s",
    "specialRequestPrefix" to "Special request: %s",
    "notePrefix" to "Note: %s",
    "editItem" to "Edit item",
    "deleteItem" to "Delete item",
    "deleteReasonRequired" to "Reason for deleting (required)",
    "confirmDeleteItem" to "Delete the item",
    "editServiceItem" to "Edit the service item",
    "editServiceItemHint" to "Choose the item type, then a service available for it. Unit price and the right to change it are still checked by the server.",
    "saveItem" to "Save the item",
    "cancelEdit" to "Cancel",
    "scanLabel" to "Scan a label",
    "productsServices" to "Products and services",
    "statisticsShort" to "Figures",
    "settingsShort" to "Settings",
    "customersCachedHint" to "Customer records are kept on this terminal; a new customer syncs immediately when online.",
    "nameAccountOrPhone" to "Name, account or phone",
    "newServiceTicket" to "New service ticket",
    "customerRegistration" to "Create a customer",
    "createCustomer" to "Create the customer",
    "noCachedMatches" to "No cached customer matches.",
    "noContactOnFile" to "No contact details on file",
    "tapToStartIntake" to "Tap to start a ticket for them",
    "productsHeading" to "Products",
    "syncedSellOffline" to "Synced; can be sold offline",
    "usingLocalCatalog" to "Using the local catalogue",
    "addToTillList" to "Add to the till",
    "servicePrices" to "Service prices",
    "scanIntro" to "Works with the built-in scanner, a keyboard-wedge scanner, or typing a ticket number, order number, phone or customer name. Online it uses the same global search as the POS web app.",
    "scanOrType" to "Scan or type a keyword",
    "searching" to "Searching…",
    "searchOnline" to "Search online",
    "startBuiltInScanner" to "Start the built-in scanner",
    "scanEmptyHint" to "Type to search this terminal's cache, or search online for all orders, tickets and customers.",
    "ticketPrefix" to "Ticket %s",
    "productAddToTill" to "Product %s · add to the till",
    "customerPrefix" to "Customer %s",
    "onlineSearchResults" to "Online results",
    "noMatchFound" to "No cached record found. Tap to search online.",
    "archiveNotification" to "Archive",
    "loading" to "Loading…",
    "refreshOrders" to "Refresh orders",
    "noOrdersToShow" to "No orders to show. Connect and refresh.",
    "orderPrefix" to "Order %s",
    "walkInCustomer" to "Walk-in",
    "tapToProcessOrder" to "Tap to process",
    "openOrderWhenOnline" to "Open an order online to see its detail.",
    "customerLabel" to "Customer",
    "orderStatus" to "Order status",
    "orderAmount" to "Order amount",
    "paidPrefix" to "Paid %s",
    "cashCollection" to "Take cash",
    "outstandingHint" to "%s outstanding. An online payment uses the current shift and drawer.",
    "tenderedForChange" to "Cash received (for change)",
    "chargeOutstanding" to "Charge the outstanding amount",
    "defaultChargeOutstanding" to "Cash is recorded as the outstanding amount by default.",
    "enterTenderAndChange" to "Enter the amount received and give change",
    "confirmTakeCash" to "Take the cash",
    "orderProcessing" to "Order handling",
    "confirmReceived" to "Accept the order",
    "confirmDelivered" to "Mark delivered",
    "orderItems" to "Order items",
    "quantityPrefix" to "Quantity %s",
    "paymentRecords" to "Payments",
    "periodToday" to "Today",
    "periodWeek" to "This week",
    "periodMonth" to "This month",
    "periodAll" to "All",
    "refreshData" to "Refresh",
    "ordersLabel" to "Orders",
    "ordersSummary" to "%d orders · %d unpaid",
    "ticketsLabel" to "Tickets",
    "ticketsSummary" to "%d tickets · %d overdue",
    "customersSummary" to "%d customers · %d new today",
    "statisticsWhenOnline" to "Connect and refresh to load the figures.",
    "refreshNotifications" to "Refresh",
    "noNotifications" to "No notifications. Connect and refresh.",
    "archive" to "Archive",
    "refreshTerminalSettings" to "Refresh terminal settings",
    "terminalLabel" to "Terminal",
    "printerDrawerScanner" to "Printing, drawer and scanner",
    "hardwareSettingsHint" to "Check the built-in devices, then test and register the receipt printer and scanner.",
    "openHardwareSettings" to "Open hardware settings",
    "cashHandlingMode" to "Cash handling",
    "terminalPreferences" to "This terminal's preferences",
    "terminalName" to "Terminal name",
    "autoLockSeconds" to "Auto-lock after (seconds)",
    "autoPrintCopies" to "Copies to print",
    "copiesSuffix" to "%s copies",
    "receiptPrinting" to "Receipt printing",
    "autoPrintOption" to "Print automatically",
    "manualPrintOption" to "Print manually",
    "cashRounding" to "Cash rounding",
    "roundingNone" to "No rounding",
    "roundingJiao" to "To the nearest jiao",
    "roundingYuan" to "To the nearest yuan",
    "saveTerminalSettings" to "Save terminal settings",
    "syncStatus" to "Sync status",
    "settingsWhenOnline" to "Connect and refresh to load the terminal settings.",
    "hardwareIntro" to "This reads the Android POS native hardware service directly; device registration follows the same terminal-level configuration as the POS web app.",
    "detecting" to "Detecting…",
    "refreshHardware" to "Refresh hardware status",
    "readingHardware" to "Reading this terminal's hardware status.",
    "hardwareModel" to "Hardware model",
    "builtInPrinter" to "Built-in receipt printer",
    "noBuiltInPrinter" to "No supported built-in printer detected on this device",
    "statusLabel" to "Status",
    "connected" to "Connected",
    "notConnected" to "Not connected",
    "printTestPage" to "Print a test page",
    "testAndRegister" to "Test and register",
    "builtInScanner" to "Built-in scanner",
    "noBuiltInScanner" to "No supported built-in scanner detected on this device",
    "connectedReadyToScan" to "Connected and ready to scan",
    "startScanTest" to "Start a scan test",
    "drawerTitle" to "Cash drawer",
    "drawerConnectedHint" to "The drawer service is connected. A manual test first asks the server for an audited authorisation.",
    "drawerUnavailable" to "No cash drawer service is available on this device.",
    "authoriseAndTestDrawer" to "Request authorisation and test the drawer",
    "hardwareManagerOnly" to "Only an owner or manager can register devices, change the default printer or test the drawer by hand.",
    "registeredDevices" to "Registered devices",
    "noRegisteredDevicesOnline" to "No registered devices read for this terminal yet.",
    "noRegisteredDevicesOffline" to "Registered devices can be read once the network returns.",
    "defaultReceiptPrinter" to "Default receipt printer",
    "deviceEnabled" to "Enabled",
    "deviceDisabled" to "Disabled",
    "bluetoothPrinter" to "External Bluetooth printer",
    "bluetoothIntro" to "Pair the printer in Android's Bluetooth settings first, then test it here and bind it to a registered printer.",
    "authoriseBluetooth" to "Allow Bluetooth",
    "readPairedDevices" to "Read paired devices",
    "noPairedPrinters" to "No paired Bluetooth printer found yet.",
    "paired" to "Paired",
    "testAndBindTo" to "Test and bind to %s",
    "needRegisteredPrinter" to "Create and enable an external printer for this terminal in the back office first.",
    "localReceiptQueue" to "Local receipt queue",
    "receiptQueueSummary" to "%d waiting to print, %d failed. Failed jobs are not retried automatically, to avoid printing twice.",
    "printNextReceipt" to "Print the next receipt",
    "useDefaultPrinterHint" to "Print with the registered default receipt printer; the queue stays on this terminal.",
    "openTicket" to "Open the ticket",
)

private val COPY_FR_VALUES: Map<String, String> = mapOf(
    "online" to "En ligne",
    "offline" to "Hors ligne",
    "offlineMode" to "Mode hors ligne",
    "syncing" to "Synchronisation",
    "synchronize" to "Synchroniser",
    "pendingSalesSuffix" to "%d en attente de synchronisation",
    "catalogTitle" to "Catalogue",
    "cartEmpty" to "Le panier est vide.",
    "amountDue" to "Montant dû",
    "checkout" to "Encaisser",
    "cashTendered" to "Espèces reçues",
    "changeDue" to "Monnaie à rendre",
    "subtotal" to "Sous-total",
    "tax" to "Taxe",
    "rounding" to "Arrondi",
    "total" to "Total",
    "receiptPrint" to "Imprimer le reçu",
    "receiptNone" to "Sans reçu",
    "receiptQueued" to "Le reçu est dans la file d'impression de cette caisse.",
    "saleSubmittedOnline" to "Commande espèces envoyée. Si la connexion tombe avant la réponse, elle est renvoyée sous le même numéro de commande.",
    "saleQueuedOffline" to "Commande espèces enregistrée sur cette caisse. Elle sera synchronisée sous le même numéro dès le retour du réseau.",
    "cashPaymentRecorded" to "Paiement en espèces enregistré.",
    "tenderBelowTotal" to "Les espèces reçues ne peuvent pas être inférieures au montant dû.",
    "cartIsEmpty" to "Le panier est vide.",
    "priceChanged" to "Le prix, la remise ou la taxe a changé. Confirmez de nouveau le paiement.",
    "shiftAndDrawerRequired" to "Encaisser des espèces exige un service ouvert et un tiroir ouvert.",
    "requiresNetwork" to "Cette action demande une connexion. Réessayez dès le retour du réseau.",
    "networkError" to "Erreur réseau. Vérifiez la connexion de cette caisse et réessayez.",
    "genericFailure" to "L'opération n'a pas abouti. Vérifiez le réseau ou réessayez sous peu.",
    "staleCatalogWarning" to "Les produits et les prix de cette caisse datent de %d heures. Synchronisez avant de continuer à vendre.",
    "printerNotConnected" to "L'imprimante n'est pas connectée.",
    "printerOutOfPaper" to "L'imprimante n'a plus de papier. Chargez du papier thermique et réessayez.",
    "printerCoverOpen" to "Le capot de l'imprimante est ouvert.",
    "printerOverheated" to "L'imprimante est trop chaude. Réessayez sous peu.",
    "drawerOpened" to "Tiroir-caisse ouvert.",
    "drawerDisconnected" to "Le service du tiroir-caisse s'est déconnecté. Actualisez l'état du matériel et réessayez.",
    "tabWorkspace" to "Accueil",
    "tabSale" to "Caisse",
    "tabIntake" to "Nouveau bon",
    "tabTickets" to "Bons",
    "tabMore" to "Plus",
    "menuMore" to "Plus",
    "menuCustomers" to "Clients",
    "menuCatalog" to "Produits et services",
    "menuScan" to "Scanner pour rechercher",
    "menuOrders" to "Commandes",
    "menuOrderDetail" to "Détail de la commande",
    "menuStatistics" to "Chiffres d'activité",
    "menuNotifications" to "Notifications",
    "menuShift" to "Service et caisse",
    "menuSettings" to "Réglages de la caisse",
    "menuHardware" to "Impression et matériel",
    "ticketDraft" to "Brouillon",
    "ticketPending" to "En attente",
    "ticketInProgress" to "En cours",
    "ticketReadyToPick" to "Prêt à retirer",
    "ticketPickedUp" to "Retiré",
    "ticketCancelled" to "Annulé",
    "ticketUnknown" to "Inconnu",
    "itemPendingWash" to "En attente",
    "itemWashing" to "En cours",
    "itemDone" to "Terminé",
    "itemReadyToPick" to "Prêt à retirer",
    "typeCloth" to "Vêtement",
    "typeCar" to "Véhicule",
    "typeShoe" to "Chaussures",
    "typeCarpet" to "Tapis",
    "priorityCritical" to "Critique",
    "priorityUrgent" to "Express",
    "priorityNormal" to "Normal",
    "devicePrinter" to "Imprimante",
    "deviceScanner" to "Scanner",
    "deviceCashDrawer" to "Tiroir-caisse",
    "moreNeedsNetwork" to "%s demande une connexion. Les clients, le catalogue et les bons en cache restent disponibles sur cette caisse.",
    "workspaceTitle" to "Accueil",
    "workspaceOnlineHint" to "Cette caisse est en ligne ; l'état est vérifié en direct.",
    "workspaceOfflineHint" to "Cette caisse est hors ligne et utilise ses données en cache.",
    "metricCatalog" to "Catalogue",
    "metricPendingOrders" to "En attente de synchro",
    "metricFailedOrders" to "Rejetées",
    "cashSectionTitle" to "Caisse espèces",
    "cashReadyOffline" to "Le service et le tiroir sont prêts ; les espèces peuvent être encaissées hors ligne.",
    "cashCheckedOnline" to "Le service et le tiroir sont vérifiés en direct à l'ouverture de la caisse.",
    "cashNeedsSync" to "Rétablissez le réseau et synchronisez le service et le tiroir pour encaisser hors ligne.",
    "openTill" to "Ouvrir la caisse",
    "synchronizing" to "Synchronisation…",
    "intakeTitle" to "Accueil client",
    "intakeOnlineHint" to "Recherchez un client, puis créez un bon de service.",
    "intakeOfflineHint" to "Hors ligne vous pouvez chercher les clients en cache ; créer un client ou un bon demande une connexion.",
    "newCustomer" to "＋ Nouveau client",
    "newCustomerShort" to "Nouveau client",
    "lookupTitle" to "Rechercher un client",
    "lookupHint" to "Saisissez un nom, un numéro de téléphone ou un compte.",
    "lookupLabel" to "Nom, téléphone ou compte",
    "lookupPlaceholder" to "Par exemple : Awa Diop / 77 000 0000",
    "search" to "Rechercher",
    "customerRecord" to "Fiche client",
    "change" to "Changer",
    "contactDetails" to "Contact",
    "noContactDetails" to "Aucun téléphone ni e-mail enregistré",
    "customerStatusActive" to "Statut : actif",
    "customerStatusPrefix" to "Statut : %s",
    "recentWork" to "Travaux récents",
    "newestFirst" to "Les plus récents d'abord",
    "noCachedTickets" to "Aucune commande de service en cache. La première que vous créez apparaîtra ici.",
    "newOrder" to "＋ Nouvelle commande",
    "intakeEmptyTitle" to "Lancez une recherche",
    "intakeEmptyDescription" to "La liste complète des clients n'est pas affichée par défaut. Cherchez par nom, téléphone ou compte.",
    "intakeNoMatchTitle" to "Aucun client trouvé",
    "intakeNoMatchDescription" to "Aucun client en cache ne correspond à « %s ». Vérifiez les informations ou créez un client.",
    "matchingCustomers" to "Clients correspondants",
    "matchingCustomersCount" to "%d résultat sur cette caisse. Touchez-en un pour créer un bon.",
    "noPhoneOnFile" to "Aucun téléphone enregistré",
    "select" to "Choisir",
    "serviceOrder" to "Commande de service",
    "itemsCountSuffix" to "%d articles",
    "expectedPickup" to "Retrait : %s",
    "continueProcessing" to "Continuer ›",
    "ticketsTitle" to "Bons",
    "ticketsEmpty" to "Aucun bon synchronisé sur cette caisse.",
    "serviceTicket" to "Bon de service",
    "syncLocalData" to "Synchroniser cette caisse",
    "backToMore" to "Retour à Plus",
    "refreshing" to "Actualisation…",
    "refreshStatus" to "Actualiser l'état",
    "shiftTitle" to "Service et caisse",
    "shiftIntro" to "Le service, la caisse et le comptage sont enregistrés séparément. Pointez, puis ouvrez la caisse pour encaisser en sécurité.",
    "shiftOfflineNotice" to "Hors ligne : vous pouvez continuer à vendre les produits en cache, mais le service, la caisse et les mouvements d'espèces demandent une connexion.",
    "shiftLoading" to "Chargement de l'état du service et de la caisse",
    "shiftLoadFailed" to "Si le chargement échoue, vérifiez la connexion puis touchez « Actualiser l'état ».",
    "reload" to "Recharger",
    "staffShift" to "Service du personnel",
    "shiftOpen" to "Pointé. Vous pouvez prendre une pause ou continuer à vendre.",
    "shiftOnBreak" to "En pause. Terminez la pause avant de vendre à nouveau.",
    "shiftClosed" to "Non pointé. Pointez pour que les ventes en espèces soient rattachées à ce service.",
    "clockingIn" to "Pointage en cours…",
    "clockIn" to "Pointer l'arrivée",
    "breakStarting" to "Démarrage…",
    "breakStart" to "Commencer la pause",
    "clockOut" to "Pointer la sortie",
    "breakEnding" to "Fin de pause…",
    "breakEnd" to "Terminer la pause",
    "registerTitle" to "Caisse",
    "cashModeNone" to "Les espèces ne sont pas activées sur cette caisse. Vous pouvez consulter l'état mais pas encaisser.",
    "cashModeUntracked" to "Cette caisse accepte les espèces, mais le magasin ne suit pas le montant du tiroir.",
    "cashModePersonal" to "Cette caisse utilise le fonds personnel ; chaque employé ouvre sa propre session.",
    "cashModeShared" to "Cette caisse utilise un tiroir partagé. Une fois ouvert, vous pouvez enregistrer le fonds, les entrées et les sorties.",
    "openingFloatRequired" to "Fonds d'ouverture *",
    "openingFloatOptional" to "Fonds d'ouverture (facultatif)",
    "openingFloatNeeded" to "Ce magasin exige un fonds d'ouverture avant d'ouvrir la caisse.",
    "registerOpening" to "Ouverture…",
    "openMyCashSession" to "Ouvrir ma session",
    "openRegister" to "Ouvrir la caisse",
    "registerStatus" to "État de la caisse",
    "thisTerminal" to "Cette caisse",
    "opened" to "Ouverte",
    "notOpened" to "Fermée",
    "cashSession" to "Session de caisse",
    "myPersonalCash" to "Mon fonds personnel",
    "sharedDrawer" to "Tiroir partagé",
    "expectedCash" to "Espèces attendues",
    "thisRegister" to "Cette caisse",
    "netSales" to "Ventes nettes",
    "outstandingOrders" to "Commandes impayées",
    "awaitingProcessing" to "En attente de traitement",
    "cashInOut" to "Entrée / sortie d'espèces",
    "amountLabel" to "Montant",
    "reasonLabel" to "Motif (3 caractères minimum)",
    "recording" to "Enregistrement…",
    "payIn" to "Entrée d'espèces",
    "payOut" to "Sortie d'espèces",
    "countAndCloseMyCash" to "Compter et clôturer mon fonds",
    "closeRegisterZReport" to "Clôturer la caisse et imprimer un rapport Z",
    "closeRegisterHint" to "La clôture crée ou met à jour cet enregistrement de passation. Confirmez le montant compté.",
    "countedCashRequired" to "Espèces comptées *",
    "countedCashOptional" to "Espèces comptées (facultatif)",
    "handoverNotes" to "Notes de passation (facultatif)",
    "countedCashNeeded" to "Ce magasin exige un montant compté avant la clôture.",
    "closing" to "Clôture…",
    "confirmClose" to "Confirmer la clôture",
    "notYet" to "Pas maintenant",
    "closeNeedsManager" to "Chaque employé ouvre et clôture sa propre session ; seul un propriétaire ou un responsable clôture la caisse.",
    "recentZReports" to "Rapports Z récents",
    "varianceLabel" to "Écart",
    "localData" to "Données de cette caisse",
    "cachedSummary" to "%d produits en cache ; %d commandes espèces en attente de synchro.",
    "confirmClockOutTitle" to "Pointer la sortie ?",
    "confirmClockOutBody" to "Vous devrez saisir votre PIN et pointer de nouveau avant de vendre.",
    "checkAgain" to "Je vérifie",
    "confirmClockOut" to "Pointer la sortie",
    "readyOnlineCash" to "Prêt pour les espèces en ligne",
    "readyOfflineCash" to "Prêt pour les espèces hors ligne",
    "cashDisabledStore" to "Les espèces ne sont pas activées pour ce magasin. Un administrateur doit les activer dans les réglages POS, puis resynchroniser.",
    "cashNeedsShiftOnline" to "Une commande espèces exige un service ouvert et un tiroir ouvert.",
    "cashNeedsShiftOffline" to "Une commande espèces hors ligne doit être rattachée à un service et un tiroir ouverts, afin que les espèces encaissées sans réseau restent attribuées.",
    "startMyShift" to "Commencer mon service",
    "shiftStarted" to "Service commencé.",
    "drawerOpeningCash" to "Espèces d'ouverture",
    "openDrawerAndSync" to "Ouvrir le tiroir et synchroniser",
    "newCustomerTitle" to "Nouveau client",
    "newCustomerHint" to "Créez d'abord le compte client ; vous pourrez ensuite créer un bon.",
    "back" to "Retour",
    "customerInfo" to "Informations client",
    "customerName" to "Nom du client",
    "customerNamePlaceholder" to "Par exemple : Awa Diop",
    "phoneNumber" to "Numéro de téléphone",
    "phonePlaceholder" to "Par exemple : 77 000 0000",
    "saving" to "Enregistrement…",
    "saveCustomer" to "Enregistrer le client",
    "newTicketTitle" to "Nouveau bon de service",
    "newTicketHint" to "Les articles et les prix sont saisis à l'étape suivante.",
    "ticketCustomer" to "Client",
    "ticketType" to "Type de bon",
    "typeLaundry" to "Blanchisserie",
    "typeCarWash" to "Lavage auto",
    "priorityTitle" to "Priorité",
    "expectedPickupField" to "Retrait prévu (facultatif)",
    "remarkOptional" to "Note (facultatif)",
    "remarkPlaceholder" to "Note de service générale",
    "ticketNeedsNetwork" to "Créer un bon demande une connexion. Réessayez dès le retour du réseau.",
    "creating" to "Création…",
    "createTicket" to "Créer le bon",
    "backToTickets" to "Retour aux bons",
    "serviceItemsCount" to "%d articles de service",
    "ticketOfflineNotice" to "Hors ligne : les articles en cache et la file de paiement sont visibles ; le traitement et le retrait demandent une connexion.",
    "ticketFlow" to "Progression du bon",
    "cancelReasonRequired" to "Motif d'annulation (obligatoire pour annuler)",
    "confirmPickedUp" to "Confirmer le retrait par le client (le paiement est vérifié)",
    "updateToStatus" to "Passer à « %s »",
    "serviceItems" to "Articles de service",
    "noServiceItems" to "Aucun article de service sur ce bon.",
    "alreadyBilled" to "Déjà sur une commande ; ne peut pas être facturé deux fois",
    "pendingSyncNoBill" to "Le paiement attend la synchro sur cette caisse ; il ne peut pas être facturé deux fois",
    "appendServiceItem" to "Ajouter un article de service",
    "noCachedServices" to "Aucun article de service en cache. Synchronisez d'abord.",
    "noServicesForType" to "Aucun article pour ce type de bon. Configurez le catalogue de services dans l'administration.",
    "pendingService" to "Service à ajouter",
    "itemTypePrefix" to "Type d'article : %s",
    "changeItemType" to "Changer de type",
    "weightKg" to "Poids (kg)",
    "bagCount" to "Sacs",
    "quantityPieces" to "Quantité (pièces)",
    "categoryOptional" to "Catégorie (facultatif)",
    "colorOptional" to "Couleur (facultatif)",
    "brandOptional" to "Marque (facultatif)",
    "materialOptional" to "Matière (facultatif)",
    "defectsOptional" to "Défauts (facultatif)",
    "specialRequestOptional" to "Demande particulière (facultatif)",
    "itemNoteOptional" to "Note d'article (facultatif)",
    "adding" to "Ajout…",
    "confirmAddItem" to "Ajouter l'article",
    "pickTypeThenService" to "Choisissez d'abord le type d'article, puis un tarif pour ce service.",
    "pickedTypeNowService" to "« %s » sélectionné. Choisissez maintenant le service.",
    "addToCartTitle" to "Ajouter au panier de caisse",
    "addToCartHint" to "Choisissez les articles à facturer. Ceux déjà sur une commande, en attente de synchro ou dans le panier sont exclus.",
    "linkedToOrder" to "Sur une commande",
    "awaitingSync" to "En attente de synchro",
    "inCart" to "Dans le panier",
    "selected" to "Sélectionné",
    "notSelected" to "Non sélectionné",
    "somePaymentsQueued" to "Les espèces de certains articles sont encore en file sur cette caisse ; les autres peuvent être facturés séparément.",
    "addingTotalHint" to "Ajout de %s. Peut être réglé en espèces avec des produits ou les autres bons de ce client.",
    "addingToCart" to "Ajout…",
    "nothingToCharge" to "Rien à facturer sur ce bon.",
    "bagsSuffix" to "%s sacs",
    "piecesSuffix" to "%s pièces",
    "defectsPrefix" to "Défauts : %s",
    "specialRequestPrefix" to "Demande particulière : %s",
    "notePrefix" to "Note : %s",
    "editItem" to "Modifier l'article",
    "deleteItem" to "Supprimer l'article",
    "deleteReasonRequired" to "Motif de suppression (obligatoire)",
    "confirmDeleteItem" to "Supprimer l'article",
    "editServiceItem" to "Modifier l'article de service",
    "editServiceItemHint" to "Choisissez le type d'article, puis un service disponible. Le prix unitaire et le droit de le modifier restent vérifiés par le serveur.",
    "saveItem" to "Enregistrer l'article",
    "cancelEdit" to "Annuler",
    "scanLabel" to "Scanner une étiquette",
    "productsServices" to "Produits et services",
    "statisticsShort" to "Chiffres",
    "settingsShort" to "Réglages",
    "customersCachedHint" to "Les fiches clients sont conservées sur cette caisse ; un nouveau client est synchronisé immédiatement en ligne.",
    "nameAccountOrPhone" to "Nom, compte ou téléphone",
    "newServiceTicket" to "Nouveau bon de service",
    "customerRegistration" to "Créer un client",
    "createCustomer" to "Créer le client",
    "noCachedMatches" to "Aucun client en cache ne correspond.",
    "noContactOnFile" to "Aucune coordonnée enregistrée",
    "tapToStartIntake" to "Touchez pour créer un bon pour ce client",
    "productsHeading" to "Produits",
    "syncedSellOffline" to "Synchronisé ; vendable hors ligne",
    "usingLocalCatalog" to "Catalogue local utilisé",
    "addToTillList" to "Ajouter à la caisse",
    "servicePrices" to "Tarifs des services",
    "scanIntro" to "Fonctionne avec le scanner intégré, une douchette clavier, ou en saisissant un numéro de bon, de commande, un téléphone ou un nom. En ligne, la même recherche globale que le POS web est utilisée.",
    "scanOrType" to "Scannez ou saisissez un mot-clé",
    "searching" to "Recherche…",
    "searchOnline" to "Rechercher en ligne",
    "startBuiltInScanner" to "Démarrer le scanner intégré",
    "scanEmptyHint" to "Saisissez pour chercher dans le cache de cette caisse, ou en ligne pour toutes les commandes, bons et clients.",
    "ticketPrefix" to "Bon %s",
    "productAddToTill" to "Produit %s · ajouter à la caisse",
    "customerPrefix" to "Client %s",
    "onlineSearchResults" to "Résultats en ligne",
    "noMatchFound" to "Aucun enregistrement en cache. Touchez pour chercher en ligne.",
    "archiveNotification" to "Archiver",
    "loading" to "Chargement…",
    "refreshOrders" to "Actualiser les commandes",
    "noOrdersToShow" to "Aucune commande à afficher. Connectez-vous et actualisez.",
    "orderPrefix" to "Commande %s",
    "walkInCustomer" to "Client de passage",
    "tapToProcessOrder" to "Touchez pour traiter",
    "openOrderWhenOnline" to "Ouvrez une commande en ligne pour voir le détail.",
    "customerLabel" to "Client",
    "orderStatus" to "État de la commande",
    "orderAmount" to "Montant de la commande",
    "paidPrefix" to "Payé %s",
    "cashCollection" to "Encaisser",
    "outstandingHint" to "%s restant dû. Un paiement en ligne utilise le service et le tiroir en cours.",
    "tenderedForChange" to "Espèces reçues (pour la monnaie)",
    "chargeOutstanding" to "Facturer le montant restant",
    "defaultChargeOutstanding" to "Les espèces sont enregistrées par défaut au montant restant dû.",
    "enterTenderAndChange" to "Saisir le montant reçu et rendre la monnaie",
    "confirmTakeCash" to "Encaisser",
    "orderProcessing" to "Traitement de la commande",
    "confirmReceived" to "Accepter la commande",
    "confirmDelivered" to "Marquer livrée",
    "orderItems" to "Articles de la commande",
    "quantityPrefix" to "Quantité %s",
    "paymentRecords" to "Paiements",
    "periodToday" to "Aujourd'hui",
    "periodWeek" to "Cette semaine",
    "periodMonth" to "Ce mois",
    "periodAll" to "Tout",
    "refreshData" to "Actualiser",
    "ordersLabel" to "Commandes",
    "ordersSummary" to "%d commandes · %d impayées",
    "ticketsLabel" to "Bons",
    "ticketsSummary" to "%d bons · %d en retard",
    "customersSummary" to "%d clients · %d nouveaux aujourd'hui",
    "statisticsWhenOnline" to "Connectez-vous et actualisez pour charger les chiffres.",
    "refreshNotifications" to "Actualiser",
    "noNotifications" to "Aucune notification. Connectez-vous et actualisez.",
    "archive" to "Archiver",
    "refreshTerminalSettings" to "Actualiser les réglages",
    "terminalLabel" to "Caisse",
    "printerDrawerScanner" to "Impression, tiroir et scanner",
    "hardwareSettingsHint" to "Vérifiez les appareils intégrés, puis testez et enregistrez l'imprimante et le scanner.",
    "openHardwareSettings" to "Ouvrir les réglages matériel",
    "cashHandlingMode" to "Gestion des espèces",
    "terminalPreferences" to "Préférences de cette caisse",
    "terminalName" to "Nom de la caisse",
    "autoLockSeconds" to "Verrouillage auto (secondes)",
    "autoPrintCopies" to "Nombre de copies",
    "copiesSuffix" to "%s copies",
    "receiptPrinting" to "Impression des reçus",
    "autoPrintOption" to "Impression automatique",
    "manualPrintOption" to "Impression manuelle",
    "cashRounding" to "Arrondi des espèces",
    "roundingNone" to "Aucun arrondi",
    "roundingJiao" to "Au jiao le plus proche",
    "roundingYuan" to "Au yuan le plus proche",
    "saveTerminalSettings" to "Enregistrer les réglages",
    "syncStatus" to "État de synchro",
    "settingsWhenOnline" to "Connectez-vous et actualisez pour charger les réglages.",
    "hardwareIntro" to "Ceci lit directement le service matériel natif du POS Android ; l'enregistrement des appareils suit la configuration de la caisse du POS web.",
    "detecting" to "Détection…",
    "refreshHardware" to "Actualiser l'état du matériel",
    "readingHardware" to "Lecture de l'état du matériel.",
    "hardwareModel" to "Modèle du matériel",
    "builtInPrinter" to "Imprimante de reçus intégrée",
    "noBuiltInPrinter" to "Aucune imprimante intégrée prise en charge détectée",
    "statusLabel" to "État",
    "connected" to "Connectée",
    "notConnected" to "Non connectée",
    "printTestPage" to "Imprimer une page de test",
    "testAndRegister" to "Tester et enregistrer",
    "builtInScanner" to "Scanner intégré",
    "noBuiltInScanner" to "Aucun scanner intégré pris en charge détecté",
    "connectedReadyToScan" to "Connecté et prêt à scanner",
    "startScanTest" to "Lancer un test de scan",
    "drawerTitle" to "Tiroir-caisse",
    "drawerConnectedHint" to "Le service du tiroir est connecté. Un test manuel demande d'abord une autorisation auditée au serveur.",
    "drawerUnavailable" to "Aucun service de tiroir-caisse disponible sur cet appareil.",
    "authoriseAndTestDrawer" to "Demander l'autorisation et tester le tiroir",
    "hardwareManagerOnly" to "Seul un propriétaire ou un responsable peut enregistrer des appareils, changer l'imprimante par défaut ou tester le tiroir.",
    "registeredDevices" to "Appareils enregistrés",
    "noRegisteredDevicesOnline" to "Aucun appareil enregistré lu pour cette caisse.",
    "noRegisteredDevicesOffline" to "Les appareils enregistrés pourront être lus au retour du réseau.",
    "defaultReceiptPrinter" to "Imprimante de reçus par défaut",
    "deviceEnabled" to "Activé",
    "deviceDisabled" to "Désactivé",
    "bluetoothPrinter" to "Imprimante Bluetooth externe",
    "bluetoothIntro" to "Associez d'abord l'imprimante dans les réglages Bluetooth d'Android, puis testez-la ici et liez-la à une imprimante enregistrée.",
    "authoriseBluetooth" to "Autoriser le Bluetooth",
    "readPairedDevices" to "Lire les appareils associés",
    "noPairedPrinters" to "Aucune imprimante Bluetooth associée trouvée.",
    "paired" to "Associée",
    "testAndBindTo" to "Tester et lier à %s",
    "needRegisteredPrinter" to "Créez et activez d'abord une imprimante externe pour cette caisse dans l'administration.",
    "localReceiptQueue" to "File de reçus locale",
    "receiptQueueSummary" to "%d en attente, %d en échec. Les travaux en échec ne sont pas relancés automatiquement, pour éviter une double impression.",
    "printNextReceipt" to "Imprimer le reçu suivant",
    "useDefaultPrinterHint" to "Imprimez avec l'imprimante de reçus par défaut enregistrée ; la file reste sur cette caisse.",
    "openTicket" to "Ouvrir le bon",
)

private val COPY_ZH = NativePosCopy("zh-CN", COPY_ZH_VALUES)
private val COPY_EN = NativePosCopy("en", COPY_EN_VALUES)
private val COPY_FR = NativePosCopy("fr", COPY_FR_VALUES)

/** Every language's value map, for the completeness test. */
internal val NATIVE_POS_COPY_BY_LANGUAGE: Map<String, Map<String, String>> = mapOf(
    "zh-CN" to COPY_ZH_VALUES,
    "en" to COPY_EN_VALUES,
    "fr" to COPY_FR_VALUES,
)

/** Copy for the terminal's selected language, falling back to Chinese. */
internal fun nativePosCopy(languageCode: String?): NativePosCopy =
    when (languageCode?.trim()?.lowercase()) {
        "en" -> COPY_EN
        "fr" -> COPY_FR
        else -> COPY_ZH
    }
