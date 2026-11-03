package com.cleanhub.pos.nativepos

/**
 * Whether an idle till should lock itself now.
 *
 * The timeout is a terminal setting an administrator configures. Before this
 * existed the app stored and displayed that setting but never acted on it, so a
 * cashier who walked away left the register open to anyone while the back
 * office believed it locked after five minutes.
 *
 * A timeout of zero or less disables the lock, matching the server's "0 means
 * never" convention for this field.
 */
internal fun shouldLockForIdle(
    lockTimeoutSeconds: Int,
    lastInteractionAt: Long,
    now: Long,
): Boolean {
    if (lockTimeoutSeconds <= 0) return false
    return now - lastInteractionAt >= lockTimeoutSeconds * 1_000L
}

/**
 * How long to wait before checking again, given the idle budget left.
 *
 * Returning the exact remaining budget means a busy till does no periodic work:
 * each interaction pushes the deadline out and the next wake-up is scheduled
 * for precisely when it would expire.
 */
internal fun idleLockDelayMs(
    lockTimeoutSeconds: Int,
    lastInteractionAt: Long,
    now: Long,
): Long = (lockTimeoutSeconds * 1_000L - (now - lastInteractionAt)).coerceAtLeast(0)
