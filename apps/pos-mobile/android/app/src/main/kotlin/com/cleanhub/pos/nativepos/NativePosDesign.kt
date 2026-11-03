package com.cleanhub.pos.nativepos

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp

internal val POS_PAGE_BACKGROUND = Color(0xFFF7F7F8)
internal val POS_PANEL_BACKGROUND = Color.White
internal val POS_ACCENT = Color(0xFF18181B)
internal val POS_INK = Color(0xFF18181B)
internal val POS_MUTED = Color(0xFF71717A)
internal val POS_BORDER = Color(0xFFE4E4E7)
internal val POS_ERROR = Color(0xFFB42318)
internal val nativePosColors = androidx.compose.material3.lightColorScheme(
    primary = POS_INK, onPrimary = Color.White, primaryContainer = POS_BORDER, onPrimaryContainer = POS_INK,
    secondary = POS_INK, onSecondary = Color.White, secondaryContainer = POS_BORDER, onSecondaryContainer = POS_INK,
    tertiary = POS_INK, background = POS_PAGE_BACKGROUND, onBackground = POS_INK,
    surface = POS_PANEL_BACKGROUND, onSurface = POS_INK, surfaceVariant = POS_PAGE_BACKGROUND,
    onSurfaceVariant = POS_MUTED, outline = POS_BORDER, error = POS_ERROR,
)

/** Fixed labels, a quiet border and an explicit focus state, matching the Web POS form language. */
@Composable
internal fun NativePosInput(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    readOnly: Boolean = false,
    label: (@Composable () -> Unit)? = null,
    placeholder: (@Composable () -> Unit)? = null,
    leadingIcon: (@Composable () -> Unit)? = null,
    trailingIcon: (@Composable () -> Unit)? = null,
    supportingText: (@Composable () -> Unit)? = null,
    isError: Boolean = false,
    singleLine: Boolean = false,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val border by animateColorAsState(
        if (isError) POS_ERROR else if (focused) POS_INK else POS_BORDER, label = "inputBorder",
    )
    Column(modifier.semantics(mergeDescendants = true) {}, verticalArrangement = Arrangement.spacedBy(7.dp)) {
        label?.let {
            androidx.compose.material3.ProvideTextStyle(MaterialTheme.typography.labelLarge.copy(color = POS_INK, fontWeight = FontWeight.Medium)) { it() }
        }
        BasicTextField(
            value = value, onValueChange = onValueChange, enabled = enabled, readOnly = readOnly,
            modifier = Modifier.fillMaxWidth(),
            singleLine = singleLine, maxLines = if (singleLine) 1 else Int.MAX_VALUE,
            textStyle = MaterialTheme.typography.bodyMedium.copy(color = if (enabled) POS_INK else POS_MUTED),
            cursorBrush = SolidColor(POS_INK), interactionSource = interaction,
            keyboardOptions = keyboardOptions, keyboardActions = keyboardActions,
            visualTransformation = visualTransformation,
            decorationBox = { inner ->
                Row(
                    Modifier.fillMaxWidth().heightIn(min = 48.dp)
                        .background(if (enabled) POS_PANEL_BACKGROUND else POS_PAGE_BACKGROUND, RoundedCornerShape(10.dp))
                        .border(if (focused) 1.5.dp else 1.dp, border, RoundedCornerShape(10.dp))
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    leadingIcon?.invoke()
                    Box(Modifier.weight(1f)) {
                        if (value.isEmpty()) placeholder?.let {
                            androidx.compose.material3.ProvideTextStyle(MaterialTheme.typography.bodyMedium.copy(color = POS_MUTED)) { it() }
                        }
                        inner()
                    }
                    trailingIcon?.invoke()
                }
            },
        )
        supportingText?.let {
            androidx.compose.material3.ProvideTextStyle(MaterialTheme.typography.bodySmall.copy(color = if (isError) POS_ERROR else POS_MUTED)) { it() }
        }
    }
}
