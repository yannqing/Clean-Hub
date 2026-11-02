package com.cleanhub.pos.nativepos

import java.net.URLEncoder
import org.json.JSONObject

internal data class NativeCustomerDirectoryEntry(val customer: NativeCustomer, val createdAt: String?)
internal data class NativeCustomerDirectoryPage(
    val entries: List<NativeCustomerDirectoryEntry>,
    val total: Int,
    val syncedAt: Long?,
    val cached: Boolean,
)

internal fun nativeCustomerEmailValid(email: String): Boolean =
    email.isBlank() || (email.length <= 320 && Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$").matches(email.trim()))

internal fun nativeCustomerFormValid(name: String, phone: String, email: String): Boolean =
    name.trim().length in 1..200 && phone.trim().length <= 32 && (phone.isNotBlank() || email.isNotBlank()) &&
        nativeCustomerEmailValid(email)

internal fun nativeDirectoryCustomerMatches(customer: NativeCustomer, query: String, status: String): Boolean {
    if (status != "all" && customer.status != status) return false
    val needle = query.trim()
    if (needle.isEmpty()) return true
    if (listOfNotNull(customer.fullName, customer.accountName, customer.phone, customer.email)
            .any { it.contains(needle, ignoreCase = true) }) return true
    val digits = needle.filter(Char::isDigit)
    return digits.length >= 2 && needle.all { it.isDigit() || it in "+()- ." } &&
        customer.phone.orEmpty().filter(Char::isDigit).contains(digits)
}

internal fun JSONObject.directoryCustomer(accountName: String? = null): NativeCustomer = NativeCustomer(
    id = getString("id"),
    accountId = getString("customerAccountId"),
    fullName = getString("fullName"),
    accountName = nativeText("accountName") ?: accountName ?: getString("fullName"),
    phone = nativeText("phone"), email = nativeText("email"), status = optString("status", "active"),
)

internal interface NativeCustomerDirectoryGateway {
    fun get(path: String): JSONObject
    fun post(path: String, body: JSONObject): JSONObject
}

internal fun nativeCustomerDirectoryGateway(api: NativePosApiClient) = object : NativeCustomerDirectoryGateway {
    override fun get(path: String) = api.get(path)
    override fun post(path: String, body: JSONObject) = api.post(path, body)
}

/** The management directory includes disabled profiles; checkout keeps its active-only catalogue. */
internal class NativeCustomerDirectory(
    private val database: NativePosDatabase,
    private val gateway: NativeCustomerDirectoryGateway,
) {
    private val store get() = database.intakeStore

    internal fun requireScope(terminal: NativeTerminal) {
        val current = database.intakeTerminal()
        check(current != null && current.tenantId == terminal.tenantId && current.branchId == terminal.branchId &&
            current.terminalId == terminal.terminalId && current.userId == terminal.userId) { "Customer session changed" }
    }

    fun rememberPage(terminal: NativeTerminal, body: JSONObject, now: Long = System.currentTimeMillis()) {
        requireScope(terminal)
        val rows = body.getJSONArray("data")
        val profiles = mutableListOf<NativeCustomer>()
        store.writableDatabase.beginTransaction()
        try {
            for (i in 0 until rows.length()) {
                val entry = rows.optJSONObject(i) ?: continue
                val profile = if (entry.optString("kind") == "profile") entry.optJSONObject("profile") else null
                profile?.let {
                    val customer = it.directoryCustomer()
                    profiles.add(customer)
                    store.cache(terminal, "customer-directory-row", customer.id, JSONObject(it.toString()).put("syncedAt", now))
                }
            }
            store.trimCached(terminal, "customer-directory-row", 1_000)
            store.cache(terminal, "customer-directory-state", "current", JSONObject().put("syncedAt", now))
            store.writableDatabase.setTransactionSuccessful()
        } finally { store.writableDatabase.endTransaction() }
        database.cacheCustomers(terminal, profiles)
    }

    fun rememberProfile(terminal: NativeTerminal, profile: JSONObject, accountName: String? = null): NativeCustomer {
        requireScope(terminal)
        val previous = store.cached(terminal, "customer-directory-row", profile.getString("id"))
        val customer = profile.directoryCustomer(accountName ?: previous?.nativeText("accountName"))
        store.cache(terminal, "customer", customer.id, profile)
        store.cache(terminal, "customer-directory-row", customer.id,
            JSONObject(profile.toString()).put("accountName", customer.accountName).put("syncedAt", System.currentTimeMillis()))
        store.trimCached(terminal, "customer-directory-row", 1_000)
        database.cacheCustomer(terminal, customer)
        return customer
    }

    fun cachedPage(terminal: NativeTerminal, query: String, status: String, offset: Int, base: List<NativeCustomer>): NativeCustomerDirectoryPage {
        requireScope(terminal)
        val entries = base.associate { it.id to NativeCustomerDirectoryEntry(it, null) }.toMutableMap()
        store.cachedAll(terminal, "customer-directory-row").forEach { body ->
            val customer = body.directoryCustomer()
            entries[customer.id] = NativeCustomerDirectoryEntry(customer, body.nativeText("createdAt"))
        }
        val matches = entries.values.filter { nativeDirectoryCustomerMatches(it.customer, query, status) }
            .sortedWith(compareByDescending<NativeCustomerDirectoryEntry> { it.createdAt.orEmpty() }.thenBy { it.customer.fullName.lowercase() })
        val syncedAt = store.cached(terminal, "customer-directory-state", "current")?.optLong("syncedAt")
        return NativeCustomerDirectoryPage(matches.drop(offset).take(20), matches.size, syncedAt, true)
    }

    fun refreshPage(terminal: NativeTerminal, query: String, status: String, offset: Int): NativeCustomerDirectoryPage {
        require(offset >= 0 && status in setOf("all", "active", "disabled"))
        requireScope(terminal)
        val path = buildString {
            append("/pos/customers?resultType=profile&limit=20&offset=$offset")
            if (query.isNotBlank()) append("&q=${URLEncoder.encode(query.trim().take(200), "UTF-8")}")
            if (status != "all") append("&status=$status")
        }
        val body = gateway.get(path)
        val now = System.currentTimeMillis()
        rememberPage(terminal, body, now)
        val rows = body.getJSONArray("data")
        val entries = buildList {
            for (i in 0 until rows.length()) rows.optJSONObject(i)?.optJSONObject("profile")?.let {
                add(NativeCustomerDirectoryEntry(it.directoryCustomer(), it.nativeText("createdAt")))
            }
        }
        return NativeCustomerDirectoryPage(entries, body.getInt("total"), now, false)
    }

    /** Persist both IDs before either request so retries and process restarts cannot duplicate records. */
    fun create(terminal: NativeTerminal, input: JSONObject): NativeCustomer {
        requireScope(terminal)
        require(nativeCustomerFormValid(input.optString("fullName"), input.optString("phone"), input.optString("email")))
        val normalized = JSONObject().put("fullName", input.getString("fullName").trim())
        listOf("phone", "email", "address", "notes").forEach { key -> input.nativeText(key)?.trim()?.takeIf { it.isNotEmpty() }?.let { normalized.put(key, it) } }
        require(normalized.optString("address").length <= 1_000 && normalized.optString("notes").length <= 2_000)
        val signature = normalized.toString()
        val previous = store.cached(terminal, "customer-create", "pending")
        val draft = if (previous?.optString("signature") == signature) previous else JSONObject()
            .put("signature", signature).put("accountId", NativeUlid.create()).put("profileId", NativeUlid.create())
        store.cache(terminal, "customer-create", "pending", draft)
        val name = normalized.getString("fullName")
        val account = gateway.post("/pos/accounts", JSONObject().put("id", draft.getString("accountId")).put("accountName", name).apply {
            normalized.nativeText("phone")?.let { put("phone", it) }
            normalized.nativeText("email")?.let { put("email", it) }
        })
        requireScope(terminal)
        val profile = gateway.post("/pos/accounts/${account.getString("id")}/customers",
            JSONObject(normalized.toString()).put("id", draft.getString("profileId")))
        val customer = rememberProfile(terminal, profile, account.getString("accountName"))
        store.cache(terminal, "account", account.getString("id"), account)
        store.removeCached(terminal, "customer-create", "pending")
        return customer
    }
}
