package com.cleanhub.pos.nativepos

import org.json.JSONObject

private data class NativeFeedbackPattern(val pattern: Regex, val target: String, val names: List<String>)
private data class NativeFeedbackCatalog(val exact: Map<String, String>, val patterns: List<NativeFeedbackPattern>)
private val feedbackCatalogs = mutableMapOf<String, NativeFeedbackCatalog>()
private val feedbackTokens = Regex("%[sd]|\\{\\w+\\}")

/** Only UI feedback passes here. Merchant names, comments and historical document bodies stay verbatim. */
internal fun nativeFeedbackText(value: String, copy: NativePosCopy, preserveUnknown: Boolean = false): String {
    if (value.isBlank()) return value
    if (value.startsWith("{") && value.contains("\"cleanhubFeedback\":1")) {
        val stored = runCatching { JSONObject(value) }.getOrNull()
        if (stored != null) {
            val translated = nativeFeedbackText(stored.optString("message"), copy)
            return if (stored.optInt("attempts") > 0) copy.offlineReplayExhausted.format(stored.optInt("attempts"), translated) else translated
        }
    }
    val catalog = synchronized(feedbackCatalogs) {
        feedbackCatalogs.getOrPut(copy.localeCode()) {
            val exact = linkedMapOf<String, String>()
            val target = NATIVE_POS_COPY_BY_LANGUAGE.getValue(copy.localeCode())
            for ((key, text) in target) {
                for (source in NATIVE_POS_COPY_BY_LANGUAGE.values) source[key]?.let { exact.putIfAbsent(it, text) }
            }
            val french = nativeApiErrorTranslations("fr")
            val chinese = nativeApiErrorTranslations("zh-CN")
            for (source in french.keys) {
                val translated = when (copy.localeCode()) { "fr" -> french.getValue(source); "zh-CN" -> chinese.getValue(source); else -> source }
                listOfNotNull(source, french[source], chinese[source]).forEach { exact.putIfAbsent(it, translated) }
            }
            val patterns = exact.mapNotNull { (source, translated) ->
                val tokens = feedbackTokens.findAll(source).toList()
                if (tokens.isEmpty() || source.replace(feedbackTokens, "").trim().length < 4) null
                else {
                    var cursor = 0
                    val names = mutableListOf<String>()
                    val pattern = buildString {
                        append("^")
                        tokens.forEachIndexed { index, token ->
                            append(Regex.escape(source.substring(cursor, token.range.first)))
                            append(if (token.value == "%d") "(\\d+)" else "([\\s\\S]*?)")
                            names.add(if (token.value.startsWith("{")) token.value else "#$index")
                            cursor = token.range.last + 1
                        }
                        append(Regex.escape(source.substring(cursor))); append("$")
                    }
                    NativeFeedbackPattern(Regex(pattern), translated, names)
                }
            }
            NativeFeedbackCatalog(exact, patterns)
        }
    }
    catalog.exact[value]?.let { return it }
    for (template in catalog.patterns) {
        val match = template.pattern.matchEntire(value) ?: continue
        var index = 0
        return feedbackTokens.replace(template.target) { token ->
            val position = if (token.value.startsWith("{")) template.names.indexOf(token.value) else index++
            val captured = match.groupValues.getOrNull(position + 1).orEmpty()
            catalog.exact[captured] ?: captured
        }
    }
    val legacyReplay = Regex("Offline cash replay gave up after (\\d+) attempts: ([\\s\\S]*)").matchEntire(value)
    if (legacyReplay != null) return copy.offlineReplayExhausted.format(legacyReplay.groupValues[1].toIntOrNull() ?: 0, nativeFeedbackText(legacyReplay.groupValues[2], copy))
    return if (copy.localeCode() == "fr" && !preserveUnknown) copy.genericFailure else value
}

/** An envelope fits the existing error column, so upgrading preserves queues without a schema migration. */
internal fun nativeStoredFeedback(error: NativePosApiException, attempts: Int = 0): String {
    val stored = JSONObject().put("cleanhubFeedback", 1).put("code", error.code.orEmpty().take(64)).put("attempts", attempts)
    var message = error.message.orEmpty()
    stored.put("message", message)
    while (stored.toString().length > 500 && message.isNotEmpty()) {
        message = message.dropLast(16)
        stored.put("message", message)
    }
    return stored.toString()
}

internal fun Throwable.userMessage(copy: NativePosCopy): String = when (this) {
    is NativePosApiException -> when (code) {
        "INVALID_CREDENTIALS" -> copy.pinIncorrectShort
        "NETWORK_ERROR" -> copy.networkError
        else -> message?.let { nativeFeedbackText(it, copy) } ?: copy.cannotReachPos
    }
    is java.io.IOException -> copy.networkError
    is NativePosValidationException -> message?.let { nativeFeedbackText(it, copy) } ?: copy.invalidInput
    else -> copy.genericFailure
}

internal fun nativeNotificationPriorityLabel(value: String, copy: NativePosCopy): String = when (value) {
    "low" -> copy.notificationPriorityLow
    "high" -> copy.notificationPriorityHigh
    "critical" -> copy.priorityCritical
    "urgent" -> copy.priorityUrgent
    else -> copy.priorityNormal
}

internal fun nativePaymentMethodLabel(value: String, copy: NativePosCopy): String = when (value) {
    "cash" -> copy.cashPayment
    "card" -> copy.cardPayment
    "wave" -> copy.wavePayment
    "orange_money" -> copy.orangeMoneyPayment
    "mobile_money", "mobile" -> copy.mobilePayment
    "later" -> copy.payLater
    else -> copy.otherPayment
}

internal fun nativePaymentProviderLabel(value: String, copy: NativePosCopy): String = when (value) {
    "wave" -> copy.wavePayment
    "orange_money" -> copy.orangeMoneyPayment
    else -> value
}

internal fun nativeSystemNotificationText(title: String, content: String, noticeType: String, relatedType: String?, relatedId: String?, copy: NativePosCopy): Pair<String, String> {
    val systemTitles = NATIVE_POS_COPY_BY_LANGUAGE.values.mapNotNull { it["systemSyncErrorTitle"] }
    return if (noticeType == "system" && relatedType == "pos_terminal" && !relatedId.isNullOrBlank() && title in systemTitles)
        copy.systemSyncErrorTitle to copy.systemSyncErrorBody.format(relatedId)
    else title to content
}
