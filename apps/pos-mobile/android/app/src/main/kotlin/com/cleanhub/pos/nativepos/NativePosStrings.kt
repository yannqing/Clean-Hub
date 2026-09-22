package com.cleanhub.pos.nativepos

/**
 * Cashier-facing copy for the native POS.
 *
 * The app was written in Chinese throughout, with a three-language picker that
 * reached only the PIN screen -- so a French cashier signed in through French
 * copy and then met Chinese for everything after it. Tenants already run in
 * French, so this is not hypothetical.
 *
 * This covers the checkout path a cashier meets during every sale: the till
 * itself, payment, receipts, hardware faults and the errors those raise.
 * Lower-traffic screens (settings, shift reports, the More tab) are still
 * Chinese-only and are listed in the review; they are reached by a manager who
 * can be trained, not by a cashier under queue pressure.
 *
 * Kotlin has no resource-bundle equivalent that works for this shape without
 * dragging in Android resources, and Android string resources cannot be
 * switched per terminal at runtime without recreating the Activity. A data
 * class keeps every language complete by construction: add a field and the
 * compiler names the three places to fill in.
 */
internal data class NativePosCopy(
    // --- status and connectivity ---
    val online: String,
    val offline: String,
    val offlineMode: String,
    val syncing: String,
    val synchronize: String,
    val pendingSalesSuffix: String,

    // --- sale screen ---
    val catalogTitle: String,
    val cartEmpty: String,
    val amountDue: String,
    val checkout: String,
    val cashTendered: String,
    val changeDue: String,
    val subtotal: String,
    val tax: String,
    val rounding: String,
    val total: String,

    // --- receipt delivery ---
    val receiptPrint: String,
    val receiptNone: String,
    val receiptQueued: String,

    // --- outcomes ---
    val saleSubmittedOnline: String,
    val saleQueuedOffline: String,
    val cashPaymentRecorded: String,

    // --- refusals the cashier can act on ---
    val tenderBelowTotal: String,
    val cartIsEmpty: String,
    val priceChanged: String,
    val shiftAndDrawerRequired: String,
    val requiresNetwork: String,
    val networkError: String,
    val genericFailure: String,
    val staleCatalogWarning: String,

    // --- hardware ---
    val printerNotConnected: String,
    val printerOutOfPaper: String,
    val printerCoverOpen: String,
    val printerOverheated: String,
    val drawerOpened: String,
    val drawerDisconnected: String,
)

private val COPY_ZH = NativePosCopy(
    online = "已联网",
    offline = "离线",
    offlineMode = "离线模式",
    syncing = "同步中",
    synchronize = "同步",
    pendingSalesSuffix = "待同步 %d 笔",
    catalogTitle = "商品目录",
    cartEmpty = "购物车为空。",
    amountDue = "应收金额",
    checkout = "结算",
    cashTendered = "实收现金",
    changeDue = "应找零",
    subtotal = "小计",
    tax = "税费",
    rounding = "抹零",
    total = "合计",
    receiptPrint = "打印小票",
    receiptNone = "不打小票",
    receiptQueued = "收据已加入本地打印队列。",
    saleSubmittedOnline = "现金订单已提交；如网络在响应中断开，将使用同一订单号安全补传。",
    saleQueuedOffline = "现金订单已写入本地队列；联网后将使用同一订单号安全同步。",
    cashPaymentRecorded = "现金收款已记录。",
    tenderBelowTotal = "实收金额不能少于应收金额。",
    cartIsEmpty = "购物车为空。",
    priceChanged = "价格、优惠或税费已更新，请重新确认结款。",
    shiftAndDrawerRequired = "现金收款需要已开始的班次和已打开的钱箱。",
    requiresNetwork = "该操作需要联网；恢复网络后即可继续。",
    networkError = "网络错误，请检查本机网络后重试。",
    genericFailure = "操作未完成：请检查网络或稍后重试。",
    staleCatalogWarning = "本机商品与价格已有 %d 小时未更新，请尽快同步后再继续销售。",
    printerNotConnected = "打印机未连接。",
    printerOutOfPaper = "打印机缺纸，请装入热敏纸后重试。",
    printerCoverOpen = "打印机仓盖未关闭。",
    printerOverheated = "打印机温度过高，请稍后重试。",
    drawerOpened = "钱箱已打开。",
    drawerDisconnected = "钱箱服务已断开，请刷新硬件状态后重试。",
)

private val COPY_EN = NativePosCopy(
    online = "Online",
    offline = "Offline",
    offlineMode = "Offline mode",
    syncing = "Syncing",
    synchronize = "Sync",
    pendingSalesSuffix = "%d waiting to sync",
    catalogTitle = "Catalogue",
    cartEmpty = "The cart is empty.",
    amountDue = "Amount due",
    checkout = "Checkout",
    cashTendered = "Cash received",
    changeDue = "Change due",
    subtotal = "Subtotal",
    tax = "Tax",
    rounding = "Rounding",
    total = "Total",
    receiptPrint = "Print receipt",
    receiptNone = "No receipt",
    receiptQueued = "The receipt is in this terminal's print queue.",
    saleSubmittedOnline = "Cash order submitted. If the connection drops before the reply arrives, it is resent safely under the same order number.",
    saleQueuedOffline = "Cash order saved to this terminal. It syncs under the same order number once the network returns.",
    cashPaymentRecorded = "Cash payment recorded.",
    tenderBelowTotal = "Cash received cannot be less than the amount due.",
    cartIsEmpty = "The cart is empty.",
    priceChanged = "The price, discount or tax changed. Confirm the payment again.",
    shiftAndDrawerRequired = "Taking cash needs an open shift and an open drawer.",
    requiresNetwork = "This needs a connection. Try again once the network is back.",
    networkError = "Network error. Check this terminal's connection and try again.",
    genericFailure = "That did not finish. Check the network or try again shortly.",
    staleCatalogWarning = "Products and prices on this terminal are %d hours old. Sync before selling further.",
    printerNotConnected = "The printer is not connected.",
    printerOutOfPaper = "The printer is out of paper. Load thermal paper and try again.",
    printerCoverOpen = "The printer cover is open.",
    printerOverheated = "The printer is too hot. Try again shortly.",
    drawerOpened = "Cash drawer opened.",
    drawerDisconnected = "The cash drawer service disconnected. Refresh the hardware status and try again.",
)

private val COPY_FR = NativePosCopy(
    online = "En ligne",
    offline = "Hors ligne",
    offlineMode = "Mode hors ligne",
    syncing = "Synchronisation",
    synchronize = "Synchroniser",
    pendingSalesSuffix = "%d en attente de synchronisation",
    catalogTitle = "Catalogue",
    cartEmpty = "Le panier est vide.",
    amountDue = "Montant du",
    checkout = "Encaisser",
    cashTendered = "Especes recues",
    changeDue = "Monnaie a rendre",
    subtotal = "Sous-total",
    tax = "Taxe",
    rounding = "Arrondi",
    total = "Total",
    receiptPrint = "Imprimer le recu",
    receiptNone = "Sans recu",
    receiptQueued = "Le recu est dans la file d'impression de cette caisse.",
    saleSubmittedOnline = "Commande especes envoyee. Si la connexion tombe avant la reponse, elle est renvoyee sous le meme numero de commande.",
    saleQueuedOffline = "Commande especes enregistree sur cette caisse. Elle sera synchronisee sous le meme numero des le retour du reseau.",
    cashPaymentRecorded = "Paiement en especes enregistre.",
    tenderBelowTotal = "Les especes recues ne peuvent pas etre inferieures au montant du.",
    cartIsEmpty = "Le panier est vide.",
    priceChanged = "Le prix, la remise ou la taxe a change. Confirmez de nouveau le paiement.",
    shiftAndDrawerRequired = "Encaisser des especes exige un service ouvert et un tiroir ouvert.",
    requiresNetwork = "Cette action demande une connexion. Reessayez des le retour du reseau.",
    networkError = "Erreur reseau. Verifiez la connexion de cette caisse et reessayez.",
    genericFailure = "L'operation n'a pas abouti. Verifiez le reseau ou reessayez sous peu.",
    staleCatalogWarning = "Les produits et les prix de cette caisse datent de %d heures. Synchronisez avant de continuer a vendre.",
    printerNotConnected = "L'imprimante n'est pas connectee.",
    printerOutOfPaper = "L'imprimante n'a plus de papier. Chargez du papier thermique et reessayez.",
    printerCoverOpen = "Le capot de l'imprimante est ouvert.",
    printerOverheated = "L'imprimante est trop chaude. Reessayez sous peu.",
    drawerOpened = "Tiroir-caisse ouvert.",
    drawerDisconnected = "Le service du tiroir-caisse s'est deconnecte. Actualisez l'etat du materiel et reessayez.",
)

/** Copy for the terminal's selected language, falling back to Chinese. */
internal fun nativePosCopy(languageCode: String?): NativePosCopy =
    when (languageCode?.trim()?.lowercase()) {
        "en" -> COPY_EN
        "fr" -> COPY_FR
        else -> COPY_ZH
    }
