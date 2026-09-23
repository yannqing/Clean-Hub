package com.cleanhub.pos.nativepos

import android.content.Context
import android.provider.Settings
import android.util.Base64
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

/**
 * Encrypted device state. The terminal credential, HTTP cookies and the local
 * verifier for the most recently authenticated cashier never enter SQLite or
 * Android backup storage.
 */
@Suppress("DEPRECATION")
class NativePosSession(context: Context) {
    private val applicationContext = context.applicationContext
    private val preferences = EncryptedSharedPreferences.create(
        context,
        "cleanhub_native_pos_secure",
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    fun deviceId(): String = preferences.getString(KEY_DEVICE_ID, null)
        ?: legacyCompatibleDeviceId().also { preferences.edit().putString(KEY_DEVICE_ID, it).apply() }

    fun hasTerminalCredential(): Boolean =
        !preferences.getString("cookie:$TERMINAL_COOKIE", null).isNullOrBlank()

    fun hasRefreshToken(): Boolean =
        !preferences.getString("cookie:$REFRESH_COOKIE", null).isNullOrBlank()

    fun cookieHeader(): String = COOKIE_NAMES.mapNotNull { name ->
        preferences.getString("cookie:$name", null)?.let { "$name=$it" }
    }.joinToString("; ")

    fun saveSetCookieHeaders(headers: List<String>) {
        val editor = preferences.edit()
        headers.forEach { header ->
            val pair = header.substringBefore(';').trim()
            val separator = pair.indexOf('=')
            if (separator <= 0) return@forEach
            val name = pair.substring(0, separator)
            if (name in COOKIE_NAMES) {
                val value = pair.substring(separator + 1)
                if (value.isBlank() || header.contains("Max-Age=0", ignoreCase = true)) {
                    editor.remove("cookie:$name")
                } else {
                    editor.putString("cookie:$name", value)
                }
            }
        }
        editor.apply()
    }

    fun clearAdministratorSession() {
        preferences.edit()
            .remove("cookie:$ACCESS_COOKIE")
            .remove("cookie:$REFRESH_COOKIE")
            .apply()
    }

    fun pinLanguageCode(): String = preferences.getString(KEY_PIN_LANGUAGE, "zh-CN") ?: "zh-CN"

    fun savePinLanguageCode(code: String) {
        preferences.edit().putString(KEY_PIN_LANGUAGE, code).apply()
    }

    /**
     * Remember a cashier's PIN for offline unlock.
     *
     * Kept per user rather than one slot for the whole device. With a single
     * slot every online login overwrote the previous cashier, so after a
     * handover the outgoing cashier could not get back in without a network --
     * which is exactly the shift where a store is most likely to be offline.
     *
     * The roster is bounded: the least recently used entry is evicted past
     * MAX_OFFLINE_PIN_USERS, so a terminal does not accumulate the PIN of
     * everyone who has ever worked there.
     */
    fun saveOfflinePin(userId: String, pin: String) {
        val salt = ByteArray(16).also(SecureRandom()::nextBytes)
        val hash = derivePin(pin, salt)
        val editor = preferences.edit()
            .putString(pinKey(userId, SUFFIX_SALT), salt.toBase64())
            .putString(pinKey(userId, SUFFIX_HASH), hash.toBase64())
            .putLong(pinKey(userId, SUFFIX_SAVED_AT), System.currentTimeMillis())
            .remove(pinKey(userId, SUFFIX_FAILURES))
            .remove(pinKey(userId, SUFFIX_LOCKED_UNTIL))
        evictStalePinUsers(userId).forEach { staleUserId ->
            PIN_SUFFIXES.forEach { suffix -> editor.remove(pinKey(staleUserId, suffix)) }
        }
        // The single-slot keys this replaces would otherwise linger encrypted
        // on the device forever.
        editor.remove(KEY_LEGACY_PIN_USER_ID)
            .remove(KEY_LEGACY_PIN_SALT)
            .remove(KEY_LEGACY_PIN_HASH)
            .remove(KEY_LEGACY_PIN_FAILURES)
            .remove(KEY_LEGACY_PIN_LOCKED_UNTIL)
            .apply()
    }

    fun canUnlockOffline(userId: String): Boolean =
        preferences.getString(pinKey(userId, SUFFIX_SALT), null) != null &&
            preferences.getString(pinKey(userId, SUFFIX_HASH), null) != null

    fun verifyOfflinePin(userId: String, pin: String): Boolean {
        if (!canAttemptOfflinePin(userId)) return false
        if (!canUnlockOffline(userId)) return false
        val salt = preferences.getString(pinKey(userId, SUFFIX_SALT), null)?.fromBase64() ?: return false
        val expected = preferences.getString(pinKey(userId, SUFFIX_HASH), null)?.fromBase64() ?: return false
        val matches = MessageDigest.isEqual(derivePin(pin, salt), expected)
        if (matches) resetOfflinePinFailures(userId) else recordOfflinePinFailure(userId)
        return matches
    }

    /**
     * Lockout is per user: one cashier fumbling their PIN must not lock out the
     * colleague they are handing over to.
     */
    fun canAttemptOfflinePin(userId: String, now: Long = System.currentTimeMillis()): Boolean =
        preferences.getLong(pinKey(userId, SUFFIX_LOCKED_UNTIL), 0) <= now

    fun offlinePinLockedForSeconds(userId: String, now: Long = System.currentTimeMillis()): Long =
        ((preferences.getLong(pinKey(userId, SUFFIX_LOCKED_UNTIL), 0) - now).coerceAtLeast(0) + 999) / 1_000

    fun clearOfflinePin() {
        val editor = preferences.edit()
        offlinePinUserIds().forEach { userId ->
            PIN_SUFFIXES.forEach { suffix -> editor.remove(pinKey(userId, suffix)) }
        }
        editor.remove(KEY_LEGACY_PIN_USER_ID)
            .remove(KEY_LEGACY_PIN_SALT)
            .remove(KEY_LEGACY_PIN_HASH)
            .remove(KEY_LEGACY_PIN_FAILURES)
            .remove(KEY_LEGACY_PIN_LOCKED_UNTIL)
            .apply()
    }

    private fun recordOfflinePinFailure(userId: String) {
        val failures = preferences.getInt(pinKey(userId, SUFFIX_FAILURES), 0) + 1
        val editor = preferences.edit().putInt(pinKey(userId, SUFFIX_FAILURES), failures)
        if (failures >= MAX_PIN_FAILURES) {
            // Slow local brute force attempts even when the terminal is offline.
            val penaltyMinutes = (failures - MAX_PIN_FAILURES + 1).coerceAtMost(60)
            editor.putLong(pinKey(userId, SUFFIX_LOCKED_UNTIL), System.currentTimeMillis() + penaltyMinutes * 60_000L)
        }
        editor.apply()
    }

    private fun resetOfflinePinFailures(userId: String) {
        preferences.edit()
            .remove(pinKey(userId, SUFFIX_FAILURES))
            .remove(pinKey(userId, SUFFIX_LOCKED_UNTIL))
            .apply()
    }

    private fun pinKey(userId: String, suffix: String): String = "$PIN_PREFIX$userId:$suffix"

    /** User ids with a stored offline PIN, from the saved-at markers. */
    private fun offlinePinUserIds(): List<String> = preferences.all.keys
        .filter { it.startsWith(PIN_PREFIX) && it.endsWith(":$SUFFIX_SAVED_AT") }
        .map { it.removePrefix(PIN_PREFIX).removeSuffix(":$SUFFIX_SAVED_AT") }

    /** Least recently saved user ids to drop so the roster stays bounded. */
    private fun evictStalePinUsers(keepUserId: String): List<String> =
        offlinePinUserIdsToEvict(
            savedAtByUserId = offlinePinUserIds().associateWith {
                preferences.getLong(pinKey(it, SUFFIX_SAVED_AT), 0)
            },
            keepUserId = keepUserId,
            maxUsers = MAX_OFFLINE_PIN_USERS,
        )

    private fun derivePin(pin: String, salt: ByteArray): ByteArray {
        require(pin.matches(Regex("\\d{6}"))) { "PIN must be exactly 6 digits." }
        val spec = PBEKeySpec(pin.toCharArray(), salt, 310_000, 256)
        return try {
            SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
        } finally {
            spec.clearPassword()
        }
    }

    private fun ByteArray.toBase64(): String = Base64.encodeToString(this, Base64.NO_WRAP)
    private fun String.fromBase64(): ByteArray = Base64.decode(this, Base64.NO_WRAP)

    /** Matches the Capacitor shell's Android identifier so an in-place upgrade can be recovered. */
    private fun legacyCompatibleDeviceId(): String {
        val androidId = Settings.Secure.getString(applicationContext.contentResolver, Settings.Secure.ANDROID_ID)
        if (!androidId.isNullOrBlank()) {
            val digest = MessageDigest.getInstance("SHA-256")
                .digest("com.cleanhub.pos:$androidId".toByteArray(Charsets.UTF_8))
                .joinToString("") { "%02x".format(it) }
            return "pos-native-$digest"
        }
        return NativeUlid.create()
    }

    private companion object {
        const val ACCESS_COOKIE = "cleanhub_pos_access_token"
        const val REFRESH_COOKIE = "cleanhub_pos_refresh_token"
        const val TERMINAL_COOKIE = "cleanhub_pos_terminal_credential"
        val COOKIE_NAMES = listOf(ACCESS_COOKIE, REFRESH_COOKIE, TERMINAL_COOKIE)
        const val KEY_DEVICE_ID = "device_id"
        const val KEY_PIN_LANGUAGE = "pin_language"
        const val PIN_PREFIX = "offline_pin:"
        const val SUFFIX_SALT = "salt"
        const val SUFFIX_HASH = "hash"
        const val SUFFIX_FAILURES = "failures"
        const val SUFFIX_LOCKED_UNTIL = "locked_until"
        const val SUFFIX_SAVED_AT = "saved_at"
        val PIN_SUFFIXES = listOf(
            SUFFIX_SALT,
            SUFFIX_HASH,
            SUFFIX_FAILURES,
            SUFFIX_LOCKED_UNTIL,
            SUFFIX_SAVED_AT,
        )
        // Single-slot keys from before PINs were kept per user.
        const val KEY_LEGACY_PIN_USER_ID = "offline_pin_user_id"
        const val KEY_LEGACY_PIN_SALT = "offline_pin_salt"
        const val KEY_LEGACY_PIN_HASH = "offline_pin_hash"
        const val KEY_LEGACY_PIN_FAILURES = "offline_pin_failures"
        const val KEY_LEGACY_PIN_LOCKED_UNTIL = "offline_pin_locked_until"
        const val MAX_PIN_FAILURES = 5
        /** Enough for a shift's worth of staff without keeping every past employee. */
        const val MAX_OFFLINE_PIN_USERS = 8
    }
}
