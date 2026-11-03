package com.cleanhub.pos.nativepos

/** How stale the cached catalog is, and therefore what to tell the cashier. */
internal enum class NativeCacheFreshness {
    /** Recent enough to sell from without comment. */
    Fresh,

    /** Old enough that prices may have moved; warn but keep selling. */
    Stale,
}

/** Hours before the cached catalog is called stale. */
internal const val NATIVE_CACHE_STALE_AFTER_HOURS = 24L

/**
 * Whether the cashier should be warned that they are selling from old data.
 *
 * The app previously judged its cache only by "is the product list empty",
 * which is true on a first run and false forever after. A terminal offline for
 * a week therefore sold at week-old prices with nothing on screen to say so.
 *
 * Deliberately a warning rather than a block: a store that has lost its network
 * still has to be able to take money, and refusing to sell would be worse than
 * selling at a price that is probably still right. `lastSyncedAt` of 0 means
 * the terminal has never synced, which the empty-catalog path already handles.
 */
internal fun nativeCacheFreshness(
    lastSyncedAt: Long,
    now: Long,
    staleAfterHours: Long = NATIVE_CACHE_STALE_AFTER_HOURS,
): NativeCacheFreshness {
    if (lastSyncedAt <= 0) return NativeCacheFreshness.Fresh
    val ageMs = now - lastSyncedAt
    // A clock that moved backwards makes the cache look impossibly new; treat
    // that as fresh rather than warning on every screen.
    if (ageMs < 0) return NativeCacheFreshness.Fresh
    return if (ageMs >= staleAfterHours * 3_600_000L) {
        NativeCacheFreshness.Stale
    } else {
        NativeCacheFreshness.Fresh
    }
}

/** Whole hours since the last successful sync, for the warning text. */
internal fun nativeCacheAgeHours(lastSyncedAt: Long, now: Long): Long =
    ((now - lastSyncedAt).coerceAtLeast(0)) / 3_600_000L
