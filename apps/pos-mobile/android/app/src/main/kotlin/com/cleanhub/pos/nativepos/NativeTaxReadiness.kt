package com.cleanhub.pos.nativepos

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay

// Uses the same eight-hour validity window as the authenticated terminal cache.
internal const val NATIVE_TAX_READINESS_MAX_AGE_MS = 8 * 60 * 60 * 1_000L

internal fun NativeCheckoutSettings.taxReadyForCheckout(now: Long = System.currentTimeMillis()): Boolean =
    taxReady && taxVerifiedAt > 0 && now - taxVerifiedAt in 0..NATIVE_TAX_READINESS_MAX_AGE_MS

internal fun NativeCheckoutSettings.taxCheckoutBlockCode(now: Long = System.currentTimeMillis()): String? =
    if (taxReady && !taxReadyForCheckout(now)) "POS_TAX_STATUS_UNAVAILABLE" else taxReadinessCode

/** Expiration must update buttons even when the cashier leaves the screen open. */
@Composable
internal fun rememberNativeTaxCheckoutReady(settings: NativeCheckoutSettings): Boolean {
    var now by remember(settings) { mutableStateOf(System.currentTimeMillis()) }
    LaunchedEffect(settings) {
        while (true) { now = System.currentTimeMillis(); delay(30_000) }
    }
    return settings.taxReadyForCheckout(now)
}

@Composable
internal fun NativeTaxReadinessNotice(
    copy: NativePosCopy, settings: NativeCheckoutSettings, role: String?, busy: Boolean,
    onSynchronize: (() -> Unit)? = null, onOpenSettings: (() -> Unit)? = null,
) {
    if (rememberNativeTaxCheckoutReady(settings)) return
    Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(copy.checkoutSetupRequired, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            Text(copy.taxReadinessMessage(settings.taxCheckoutBlockCode()), style = MaterialTheme.typography.bodySmall)
            Text(if (role == "owner" || role == "manager") copy.checkoutManagerNextSteps else copy.checkoutStaffNextSteps,
                style = MaterialTheme.typography.bodySmall)
            if (onSynchronize != null || onOpenSettings != null) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    onOpenSettings?.let { TextButton(onClick = it, enabled = !busy) { Text(copy.checkoutReviewSettings) } }
                    onSynchronize?.let { TextButton(onClick = it, enabled = !busy) { Text(copy.synchronize) } }
                }
            }
        }
    }
}
