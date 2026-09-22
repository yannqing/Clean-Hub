package com.cleanhub.pos.nativepos

/**
 * Which stored offline PINs to drop when a new cashier is remembered.
 *
 * The terminal used to keep one PIN for the whole device, so every online
 * login overwrote the previous cashier and, after a handover, the outgoing
 * cashier could no longer unlock without a network -- the shift where a store
 * is most likely to be offline. PINs are now kept per user, which means the
 * roster needs a bound so a terminal does not end up holding the PIN of
 * everyone who has ever worked there.
 *
 * Eviction is least-recently-saved. The cashier being saved is never evicted,
 * even when the roster is already full.
 */
internal fun offlinePinUserIdsToEvict(
    savedAtByUserId: Map<String, Long>,
    keepUserId: String,
    maxUsers: Int,
): List<String> {
    val others = savedAtByUserId.filterKeys { it != keepUserId }
    val overflow = others.size + 1 - maxUsers
    if (overflow <= 0) return emptyList()
    return others.entries
        .sortedBy { it.value }
        .take(overflow)
        .map { it.key }
}
