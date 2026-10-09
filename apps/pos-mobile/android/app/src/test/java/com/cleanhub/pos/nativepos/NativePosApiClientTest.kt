package com.cleanhub.pos.nativepos

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NativePosApiClientTest {

    @Test
    fun aFirstLaunchLoginFailureDoesNotAttemptToRefresh() {
        assertFalse(
            shouldRefreshAfterUnauthorized(
                status = 401,
                path = "/auth/login",
                retryAfterRefresh = true,
                hasRefreshToken = false,
            ),
        )
    }

    @Test
    fun aPinLoginFailureDoesNotMaskItsOwnError() {
        assertFalse(
            shouldRefreshAfterUnauthorized(
                status = 401,
                path = "/auth/pos-pin-login",
                retryAfterRefresh = true,
                hasRefreshToken = true,
            ),
        )
    }

    @Test
    fun anExpiredAuthenticatedRequestStillRefreshesOnce() {
        assertTrue(
            shouldRefreshAfterUnauthorized(
                status = 401,
                path = "/tenant/profile",
                retryAfterRefresh = true,
                hasRefreshToken = true,
            ),
        )
    }
}
