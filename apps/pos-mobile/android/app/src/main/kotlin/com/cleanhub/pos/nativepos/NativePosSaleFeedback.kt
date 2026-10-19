package com.cleanhub.pos.nativepos

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog

internal enum class NativeSaleState { Paid, Queued, AwaitingPayment, Deferred, NeedsReview }

internal fun nativeSaleState(queueStatus: String?, paymentMethod: String, paymentStatus: String?): NativeSaleState = when {
    queueStatus == "failed" -> NativeSaleState.NeedsReview
    queueStatus != null -> NativeSaleState.Queued
    paymentMethod == "later" -> NativeSaleState.Deferred
    paymentStatus == "paid" || (paymentMethod == "cash" && paymentStatus.isNullOrBlank()) -> NativeSaleState.Paid
    else -> NativeSaleState.AwaitingPayment
}

internal data class NativeSaleResult(
    val orderId: String,
    val state: NativeSaleState,
    val currency: String,
    val totalMinor: Long,
    val tenderedMinor: Long,
    val paymentMethod: String,
    val customerName: String?,
    val printQueued: Boolean,
    val followUpMessage: String? = null,
) {
    fun description(copy: NativePosCopy): String = when (state) {
        NativeSaleState.Paid -> copy.checkoutConfirmedHint
        NativeSaleState.Queued -> copy.checkoutSavedPendingHint
        NativeSaleState.AwaitingPayment -> copy.saleAwaitingConfirmation
        NativeSaleState.Deferred -> copy.salePayLaterRecorded
        NativeSaleState.NeedsReview -> copy.saleNeedsReview
    }
}

internal fun nativeSaleResult(checkout: NativeCheckoutResult, request: NativeCheckoutRequest, cart: NativePosCart, submission: NativeCheckoutSubmission) = NativeSaleResult(
    orderId = checkout.orderId,
    state = nativeSaleState(submission.queueStatus, request.paymentMethod, submission.paymentStatus),
    currency = cart.currency,
    totalMinor = request.expectedTotalMinor,
    tenderedMinor = request.tenderedMinor,
    paymentMethod = request.paymentMethod,
    customerName = cart.customer?.name,
    printQueued = checkout.printJobId != null,
    followUpMessage = submission.error?.message?.takeIf { submission.queueStatus == "failed" },
)

@Composable
internal fun NativeSaleResultDialog(copy: NativePosCopy, result: NativeSaleResult, onDismiss: () -> Unit, onViewOrder: (() -> Unit)?) {
    val paid = result.state == NativeSaleState.Paid
    val tone = when (result.state) {
        NativeSaleState.Paid -> Color(0xFF16803A)
        NativeSaleState.NeedsReview -> POS_ERROR
        else -> Color(0xFF9A6700)
    }
    val title = when (result.state) {
        NativeSaleState.Paid -> copy.checkoutPaidTitle
        NativeSaleState.Queued -> copy.checkoutQueuedTitle
        NativeSaleState.AwaitingPayment -> copy.checkoutPendingTitle
        NativeSaleState.Deferred -> copy.checkoutSavedTitle
        NativeSaleState.NeedsReview -> copy.checkoutReviewTitle
    }
    Dialog(onDismissRequest = onDismiss) {
        Surface(Modifier.widthIn(max = 480.dp).fillMaxWidth(), shape = RoundedCornerShape(24.dp), color = POS_PANEL_BACKGROUND) {
            Column(Modifier.verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Box(Modifier.size(52.dp).background(tone.copy(alpha = .1f), CircleShape), contentAlignment = Alignment.Center) {
                    Text(if (paid) "✓" else "!", color = tone, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                }
                Text(title, color = POS_INK, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                Text(formatMoney(result.totalMinor, result.currency), color = tone, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                Text(copy.orderPrefix.format(result.orderId.takeLast(8).uppercase()), color = POS_MUTED)
                Text(copy.customerPrefixShort.format(result.customerName ?: copy.walkInCustomer), color = POS_MUTED)
                Text(result.description(copy), color = POS_INK, style = MaterialTheme.typography.bodyMedium)
                if (result.paymentMethod == "cash" && result.state != NativeSaleState.NeedsReview) {
                    HorizontalDivider(color = POS_BORDER)
                    SaleResultRow(copy.tenderedForChange, formatMoney(result.tenderedMinor, result.currency))
                    SaleResultRow(copy.changeLabel, formatMoney((result.tenderedMinor - result.totalMinor).coerceAtLeast(0), result.currency))
                }
                if (result.printQueued && result.state != NativeSaleState.NeedsReview) {
                    Text(copy.checkoutBackgroundHint, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
                }
                result.followUpMessage?.let { Text(it, color = POS_MUTED, style = MaterialTheme.typography.bodySmall) }
                Button(onClick = onDismiss, modifier = Modifier.fillMaxWidth().height(50.dp), shape = RoundedCornerShape(14.dp), colors = ButtonDefaults.buttonColors(containerColor = POS_ACCENT)) { Text(copy.checkoutContinue) }
                onViewOrder?.let { OutlinedButton(onClick = it, modifier = Modifier.fillMaxWidth()) { Text(copy.checkoutViewOrder) } }
            }
        }
    }
}

@Composable
private fun SaleResultRow(label: String, value: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = POS_MUTED, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodySmall)
        Text(value, color = POS_INK, fontWeight = FontWeight.SemiBold)
    }
}
