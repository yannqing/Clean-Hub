package com.cleanhub.pos.nativepos

import java.security.SecureRandom

/** Generates the same 26-character ULID shape used by the API and web POS. */
object NativeUlid {
    private const val ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
    private val random = SecureRandom()

    fun create(nowMillis: Long = System.currentTimeMillis()): String {
        require(nowMillis >= 0) { "ULID timestamps cannot be negative." }
        var timestamp = nowMillis
        val result = CharArray(26)
        for (index in 9 downTo 0) {
            result[index] = ALPHABET[(timestamp % 32).toInt()]
            timestamp /= 32
        }
        val entropy = ByteArray(16)
        random.nextBytes(entropy)
        for (index in 0 until 16) {
            result[index + 10] = ALPHABET[(entropy[index].toInt() and 31)]
        }
        return String(result)
    }
}
