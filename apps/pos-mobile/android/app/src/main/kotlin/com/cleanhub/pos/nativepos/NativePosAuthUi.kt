package com.cleanhub.pos.nativepos

import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathBuilder
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cleanhub.pos.R

internal val NATIVE_ENTRY_BACKGROUND = Color(0xFFF5F5F4)
private val ENTRY_INK = Color(0xFF18181B)
private val ENTRY_MUTED = Color(0xFF71717A)
private val ENTRY_BORDER = Color(0xFFE4E4E7)
private val ENTRY_SOFT = Color(0xFFFAFAFA)
private val ENTRY_ERROR = Color(0xFFB42318)
private const val ENTRY_PIN_LENGTH = 6
private val entryColors = lightColorScheme(
    primary = ENTRY_INK, onPrimary = Color.White,
    secondary = ENTRY_INK, onSecondary = Color.White,
    background = NATIVE_ENTRY_BACKGROUND, onBackground = ENTRY_INK,
    surface = Color.White, onSurface = ENTRY_INK,
    surfaceVariant = ENTRY_SOFT, onSurfaceVariant = ENTRY_MUTED,
    outline = ENTRY_BORDER, error = ENTRY_ERROR,
)

/** Entry screens use the same neutral visual language as POS Web, scoped to authentication. */
@Composable
private fun NativeEntryShell(
    copy: NativePosCopy,
    language: NativePinLanguage,
    onLanguageSelected: (NativePinLanguage) -> Unit,
    busy: Boolean,
    internetAvailable: Boolean? = null,
    step: Int? = null,
    cardWidth: Dp = 560.dp,
    footer: String = copy.authSetupFooter,
    content: @Composable ColumnScope.() -> Unit,
) {
    MaterialTheme(colorScheme = entryColors) {
        val keyboardVisible = WindowInsets.ime.getBottom(LocalDensity.current) > 0
        val compact = LocalConfiguration.current.screenHeightDp < 700 || keyboardVisible
        Box(Modifier.fillMaxSize().background(NATIVE_ENTRY_BACKGROUND).imePadding()) {
            Canvas(Modifier.fillMaxSize()) {
                drawCircle(ENTRY_BORDER.copy(alpha = 0.65f), size.width * 0.5f,
                    Offset(-size.width * 0.12f, size.height * 0.05f), style = Stroke(1.dp.toPx()))
                drawCircle(ENTRY_BORDER.copy(alpha = 0.5f), size.width * 0.4f,
                    Offset(size.width * 1.12f, size.height * 0.85f), style = Stroke(1.dp.toPx()))
            }
            Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
                Row(
                    Modifier.widthIn(max = 1120.dp).fillMaxWidth().padding(horizontal = 20.dp, vertical = if (compact) 10.dp else 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Image(painterResource(R.drawable.cleanhub_brand_mark), contentDescription = null,
                        modifier = Modifier.size(40.dp).clip(RoundedCornerShape(11.dp)))
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(copy.authBrandName, fontSize = 16.sp, lineHeight = 22.sp, fontWeight = FontWeight.Bold, color = ENTRY_INK)
                        Text(copy.authBrandSuffix, fontSize = 9.sp, lineHeight = 13.sp, letterSpacing = 0.8.sp, color = ENTRY_MUTED,
                            maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(5.dp)) {
                        PinLanguageMenu(language, onLanguageSelected, enabled = !busy)
                        internetAvailable?.let { NativeEntryNetworkBadge(copy, it) }
                    }
                }
                BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
                    val viewportHeight = maxHeight
                    Column(
                        Modifier.fillMaxWidth().verticalScroll(rememberScrollState())
                            .heightIn(min = viewportHeight).padding(horizontal = 16.dp, vertical = 12.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        step?.let { NativeEntryProgress(copy, it, compact) }
                        val entrance = remember { Animatable(0f) }
                        LaunchedEffect(Unit) { entrance.animateTo(1f, tween(220)) }
                        Surface(
                            modifier = Modifier.widthIn(max = cardWidth).fillMaxWidth().graphicsLayer {
                                alpha = entrance.value
                                translationY = (1f - entrance.value) * 10.dp.toPx()
                            },
                            shape = RoundedCornerShape(24.dp), color = Color.White,
                            border = BorderStroke(1.dp, ENTRY_BORDER.copy(alpha = 0.8f)),
                            shadowElevation = 4.dp,
                        ) {
                            Column(Modifier.fillMaxWidth().animateContentSize(tween(180)).padding(if (compact) 16.dp else 24.dp),
                                verticalArrangement = Arrangement.spacedBy(if (compact) 14.dp else 20.dp), content = content)
                        }
                    }
                }
                if (!keyboardVisible) {
                    Text(footer, Modifier.widthIn(max = 720.dp).fillMaxWidth().padding(horizontal = 24.dp, vertical = if (compact) 8.dp else 14.dp),
                        color = ENTRY_MUTED, fontSize = 11.sp, lineHeight = 17.sp, textAlign = TextAlign.Center)
                }
            }
        }
    }
}

@Composable
private fun NativeEntryTitle(title: String, description: String, icon: ImageVector) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Surface(shape = RoundedCornerShape(12.dp), color = ENTRY_INK) {
                Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.padding(11.dp).size(22.dp))
            }
            Text(title, color = ENTRY_INK, fontSize = 23.sp, lineHeight = 30.sp,
                letterSpacing = (-0.5).sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
        }
        Text(description, color = ENTRY_MUTED, fontSize = 14.sp, lineHeight = 22.sp)
    }
}

@Composable
private fun NativeEntryProgress(copy: NativePosCopy, step: Int, compact: Boolean) {
    Row(Modifier.widthIn(max = 520.dp).fillMaxWidth().padding(bottom = if (compact) 12.dp else 20.dp)
        .semantics { contentDescription = copy.authStepProgress.format(step + 1, 2) },
        horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        listOf(copy.authIdentityStep, copy.authTerminalStep).forEachIndexed { index, title ->
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    val active = index <= step
                    Box(Modifier.size(26.dp).clip(CircleShape)
                        .background(if (active) ENTRY_INK else Color.White)
                        .border(1.dp, if (active) ENTRY_INK else ENTRY_BORDER, CircleShape), contentAlignment = Alignment.Center) {
                        if (index < step) Icon(EntryIcons.Check, null, tint = Color.White, modifier = Modifier.size(14.dp))
                        else Text((index + 1).toString(), fontSize = 11.sp, lineHeight = 15.sp, fontWeight = FontWeight.Bold,
                            color = if (active) Color.White else ENTRY_MUTED)
                    }
                    Text(title, color = if (active) ENTRY_INK else ENTRY_MUTED, fontSize = 12.sp, lineHeight = 17.sp,
                        fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal)
                }
                Box(Modifier.fillMaxWidth().height(2.dp).clip(CircleShape).background(if (index <= step) ENTRY_INK else ENTRY_BORDER))
            }
        }
    }
}

@Composable
private fun NativeEntryField(
    copy: NativePosCopy,
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    placeholder: String,
    icon: ImageVector,
    enabled: Boolean,
    secret: Boolean = false,
    keyboardType: KeyboardType = KeyboardType.Text,
    imeAction: ImeAction = ImeAction.Done,
    onDone: () -> Unit = {},
) {
    var revealed by remember { mutableStateOf(false) }
    val focusManager = LocalFocusManager.current
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(label, color = ENTRY_INK, fontSize = 13.sp, lineHeight = 18.sp, fontWeight = FontWeight.SemiBold)
        OutlinedTextField(
            value = value, onValueChange = onValueChange, enabled = enabled,
            modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp).semantics { contentDescription = label },
            shape = RoundedCornerShape(12.dp),
            singleLine = true, textStyle = MaterialTheme.typography.bodyLarge.copy(color = ENTRY_INK, fontSize = 15.sp),
            placeholder = { Text(placeholder, fontSize = 14.sp, lineHeight = 20.sp, color = ENTRY_MUTED) },
            leadingIcon = { Icon(icon, null, tint = ENTRY_MUTED, modifier = Modifier.size(19.dp)) },
            trailingIcon = if (secret) ({
                IconButton(onClick = { revealed = !revealed }, enabled = enabled) {
                    Icon(if (revealed) EntryIcons.EyeOff else EntryIcons.Eye,
                        if (revealed) copy.authHidePassword else copy.authShowPassword,
                        tint = ENTRY_MUTED, modifier = Modifier.size(20.dp))
                }
            }) else null,
            visualTransformation = if (secret && !revealed) PasswordVisualTransformation() else VisualTransformation.None,
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType, imeAction = imeAction),
            keyboardActions = KeyboardActions(onNext = { focusManager.moveFocus(androidx.compose.ui.focus.FocusDirection.Down) }, onDone = { onDone() }),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = ENTRY_INK, unfocusedBorderColor = ENTRY_BORDER,
                focusedContainerColor = Color.White, unfocusedContainerColor = ENTRY_SOFT,
                disabledContainerColor = ENTRY_SOFT, disabledBorderColor = ENTRY_BORDER,
                cursorColor = ENTRY_INK, focusedTextColor = ENTRY_INK, unfocusedTextColor = ENTRY_INK,
            ),
        )
    }
}

@Composable
private fun NativeEntryAction(label: String, busyLabel: String, enabled: Boolean, busy: Boolean, onClick: () -> Unit) {
    Button(onClick = onClick, enabled = enabled && !busy,
        modifier = Modifier.fillMaxWidth().heightIn(min = 54.dp), shape = RoundedCornerShape(12.dp),
        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 14.dp),
        colors = ButtonDefaults.buttonColors(containerColor = ENTRY_INK, contentColor = Color.White,
            disabledContainerColor = if (busy) ENTRY_INK else ENTRY_INK.copy(alpha = 0.12f),
            disabledContentColor = if (busy) Color.White else ENTRY_MUTED)) {
        if (busy) {
            CircularProgressIndicator(Modifier.size(17.dp), color = Color.White, strokeWidth = 2.dp)
            Spacer(Modifier.width(10.dp))
        }
        Text(if (busy) busyLabel else label, fontSize = 14.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f), textAlign = TextAlign.Center)
        if (!busy) Icon(EntryIcons.Arrow, null, modifier = Modifier.size(18.dp))
    }
}

@Composable
private fun NativeEntryFeedback(message: String?, warning: Boolean = false) {
    if (message.isNullOrBlank()) return
    val ink = if (warning) Color(0xFF92400E) else ENTRY_ERROR
    Surface(shape = RoundedCornerShape(12.dp), color = if (warning) Color(0xFFFFFBEB) else Color(0xFFFEF3F2),
        border = BorderStroke(1.dp, ink.copy(alpha = 0.14f))) {
        Row(Modifier.fillMaxWidth().padding(12.dp).semantics { liveRegion = LiveRegionMode.Polite },
            horizontalArrangement = Arrangement.spacedBy(9.dp)) {
            Icon(EntryIcons.Info, null, tint = ink, modifier = Modifier.size(18.dp))
            Text(message, color = ink, fontSize = 13.sp, lineHeight = 20.sp, modifier = Modifier.weight(1f))
        }
    }
}

@Composable
internal fun FirstLaunchView(
    copy: NativePosCopy, language: NativePinLanguage, onLanguageSelected: (NativePinLanguage) -> Unit,
    apiConfigured: Boolean, busy: Boolean, message: String?, onStart: () -> Unit,
) {
    NativeEntryShell(copy, language, onLanguageSelected, busy) {
        NativeEntryTitle(copy.authWelcomeTitle, copy.initialiseIntro, EntryIcons.Device)
        Surface(shape = RoundedCornerShape(14.dp), color = ENTRY_SOFT, border = BorderStroke(1.dp, ENTRY_BORDER)) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                listOf(copy.authIdentityStep to EntryIcons.Lock, copy.selectStore to EntryIcons.Store, copy.authReadyStep to EntryIcons.Check)
                    .forEachIndexed { index, (title, icon) ->
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Icon(icon, null, tint = ENTRY_MUTED, modifier = Modifier.size(19.dp))
                            Text(title, Modifier.weight(1f), color = ENTRY_INK, fontSize = 13.sp, lineHeight = 18.sp, fontWeight = FontWeight.Medium)
                            Text("0${index + 1}", color = ENTRY_MUTED, fontSize = 11.sp, lineHeight = 16.sp)
                        }
                    }
            }
        }
        NativeEntryFeedback(if (!apiConfigured) copy.noApiUrl else message)
        NativeEntryAction(copy.startInitialisation, copy.authVerifying, apiConfigured, busy, onStart)
    }
}

@Composable
internal fun AdministratorLoginView(
    copy: NativePosCopy, language: NativePinLanguage, onLanguageSelected: (NativePinLanguage) -> Unit,
    internetAvailable: Boolean, busy: Boolean, message: String?, onSubmit: (String, String) -> Unit,
) = NativeAdministratorForm(copy, language, onLanguageSelected, internetAvailable, busy, message,
    copy.managerLogin, copy.managerLoginIntro, copy.verifyAndSelectStore, step = 0, onSubmit = onSubmit)

@Composable
internal fun TerminalCredentialRecoveryView(
    copy: NativePosCopy, language: NativePinLanguage, onLanguageSelected: (NativePinLanguage) -> Unit,
    internetAvailable: Boolean, busy: Boolean, message: String?, onRecover: (String, String) -> Unit,
) = NativeAdministratorForm(copy, language, onLanguageSelected, internetAvailable, busy, message,
    copy.recoverCredential, copy.recoverIntro, copy.reissueCredential, step = null, onSubmit = onRecover)

@Composable
private fun NativeAdministratorForm(
    copy: NativePosCopy, language: NativePinLanguage, onLanguageSelected: (NativePinLanguage) -> Unit,
    internetAvailable: Boolean, busy: Boolean, message: String?, title: String, description: String,
    action: String, step: Int?, onSubmit: (String, String) -> Unit,
) {
    var identifier by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var hideMessage by remember(message) { mutableStateOf(false) }
    LaunchedEffect(message, busy) { if (!busy) hideMessage = false }
    val keyboard = LocalSoftwareKeyboardController.current
    val canSubmit = identifier.isNotBlank() && password.isNotBlank() && !busy
    val submit = { if (canSubmit) { keyboard?.hide(); onSubmit(identifier, password) } }
    NativeEntryShell(copy, language, onLanguageSelected, busy, internetAvailable, step, footer = copy.authAccountHint) {
        NativeEntryTitle(title, description, EntryIcons.Lock)
        NativeEntryField(copy, identifier, { identifier = it; hideMessage = true }, copy.emailLabel,
            copy.authEmailPlaceholder, EntryIcons.Mail, !busy, keyboardType = KeyboardType.Email, imeAction = ImeAction.Next)
        NativeEntryField(copy, password, { password = it; hideMessage = true }, copy.passwordLabel,
            copy.authPasswordPlaceholder, EntryIcons.Lock, !busy, secret = true, keyboardType = KeyboardType.Password, onDone = submit)
        NativeEntryFeedback(if (hideMessage) null else message)
        NativeEntryAction(action, copy.authVerifying, canSubmit, busy, submit)
    }
}

@Composable
internal fun TerminalEnrollmentView(
    copy: NativePosCopy, language: NativePinLanguage, onLanguageSelected: (NativePinLanguage) -> Unit,
    branches: List<NativeSetupBranch>, requiresReenrollment: Boolean, busy: Boolean,
    message: String?, onEnroll: (String, String) -> Unit,
) {
    var branchId by remember { mutableStateOf(branches.first().id) }
    var label by remember { mutableStateOf("${branches.first().name} POS") }
    val keyboard = LocalSoftwareKeyboardController.current
    val submit = { if (label.isNotBlank() && !busy) { keyboard?.hide(); onEnroll(branchId, label) } }
    NativeEntryShell(copy, language, onLanguageSelected, busy, step = 1, cardWidth = 640.dp) {
        NativeEntryTitle(if (requiresReenrollment) copy.rebindTerminal else copy.bindTerminal, copy.authStoreHint, EntryIcons.Store)
        if (requiresReenrollment) NativeEntryFeedback(copy.rebindWarning, warning = true)
        BoxWithConstraints(Modifier.fillMaxWidth()) {
            val columns = if (maxWidth >= 460.dp) 2 else 1
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                branches.chunked(columns).forEach { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        row.forEach { branch ->
                            val selected = branch.id == branchId
                            Surface(modifier = Modifier.weight(1f).selectable(selected, enabled = !busy, role = Role.RadioButton,
                                onClick = { branchId = branch.id; if (label.isBlank()) label = "${branch.name} POS" }),
                                shape = RoundedCornerShape(12.dp), color = if (selected) ENTRY_INK else Color.White,
                                border = BorderStroke(1.dp, if (selected) ENTRY_INK else ENTRY_BORDER)) {
                                Row(Modifier.fillMaxWidth().heightIn(min = 72.dp).padding(14.dp),
                                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                    Icon(EntryIcons.Store, null, tint = if (selected) Color.White.copy(alpha = 0.75f) else ENTRY_MUTED, modifier = Modifier.size(19.dp))
                                    Text(branch.name, Modifier.weight(1f), color = if (selected) Color.White else ENTRY_INK,
                                        fontSize = 14.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                    Box(Modifier.size(18.dp).clip(CircleShape).border(1.dp, if (selected) Color.White else ENTRY_BORDER, CircleShape), contentAlignment = Alignment.Center) {
                                        if (selected) Icon(EntryIcons.Check, null, tint = Color.White, modifier = Modifier.size(12.dp))
                                    }
                                }
                            }
                        }
                        if (row.size < columns) Spacer(Modifier.weight(1f))
                    }
                }
            }
        }
        NativeEntryField(copy, label, { label = it }, copy.terminalName, copy.authTerminalPlaceholder,
            EntryIcons.Device, !busy, onDone = submit)
        Text(copy.authTerminalHint, color = ENTRY_MUTED, fontSize = 12.sp, lineHeight = 18.sp)
        NativeEntryFeedback(message)
        NativeEntryAction(if (requiresReenrollment) copy.revokeAndRebind else copy.bindAndContinue,
            copy.authBinding, label.isNotBlank(), busy, submit)
    }
}

@Composable
internal fun StaffPinGate(
    language: NativePinLanguage, onLanguageSelected: (NativePinLanguage) -> Unit,
    tenantName: String?, branchName: String?, offlineAvailable: Boolean, internetAvailable: Boolean,
    busy: Boolean, message: String?, onPinEdited: () -> Unit,
    onUnlockOffline: (String) -> Unit, onOnlineLogin: (String) -> Unit,
) {
    var pin by remember { mutableStateOf("") }
    val copy = nativePosCopy(language.code)
    val unlockingOffline = !internetAvailable && offlineAvailable
    LaunchedEffect(message, busy) {
        if (message != null && !busy && pin.length == ENTRY_PIN_LENGTH) pin = ""
    }
    fun updatePin(next: String) {
        if (busy) return
        val normalized = next.filter(Char::isDigit).take(ENTRY_PIN_LENGTH)
        pin = normalized
        onPinEdited()
        if (normalized.length == ENTRY_PIN_LENGTH) {
            when {
                internetAvailable -> onOnlineLogin(normalized)
                offlineAvailable -> onUnlockOffline(normalized)
            }
        }
    }
    NativeEntryShell(copy, language, onLanguageSelected, busy, internetAvailable,
        cardWidth = 860.dp, footer = copy.authPinFooter) {
        BoxWithConstraints(Modifier.fillMaxWidth()) {
            val wide = maxWidth >= 600.dp
            val identity: @Composable () -> Unit = {
                Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
                    NativeEntryTitle(if (unlockingOffline) copy.authWelcomeBack else copy.authPinTitle,
                        if (unlockingOffline) copy.authPinOfflineHint else copy.authPinOnlineHint, EntryIcons.Lock)
                    if (!tenantName.isNullOrBlank() || !branchName.isNullOrBlank()) {
                        Surface(shape = RoundedCornerShape(12.dp), color = ENTRY_SOFT, border = BorderStroke(1.dp, ENTRY_BORDER)) {
                            Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                Icon(EntryIcons.Store, null, tint = ENTRY_MUTED, modifier = Modifier.size(19.dp))
                                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                                    tenantName?.trim()?.takeIf { it.isNotEmpty() }?.let {
                                        Text(it, color = ENTRY_INK, fontSize = 14.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold,
                                            maxLines = 2, overflow = TextOverflow.Ellipsis)
                                    }
                                    branchName?.trim()?.takeIf { it.isNotEmpty() }?.let {
                                        Text(it, color = ENTRY_MUTED, fontSize = 12.sp, lineHeight = 18.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            val controls: @Composable () -> Unit = {
                Column(Modifier.widthIn(max = 320.dp).fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(18.dp)) {
                    NativeEntryPinDots(copy, pin.length, message != null)
                    Row(Modifier.fillMaxWidth().heightIn(min = 38.dp).semantics { liveRegion = LiveRegionMode.Polite },
                        horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                        if (busy) {
                            CircularProgressIndicator(Modifier.size(15.dp), color = ENTRY_MUTED, strokeWidth = 2.dp)
                            Spacer(Modifier.width(8.dp))
                        }
                        Text(when {
                            busy -> copy.authVerifying
                            message != null -> message
                            unlockingOffline -> copy.authPinOfflineAvailable
                            internetAvailable -> copy.authPinAutoLogin
                            else -> copy.authPinOnlineRequired
                        }, color = if (message != null) ENTRY_ERROR else ENTRY_MUTED,
                            fontSize = 12.sp, lineHeight = 18.sp, textAlign = TextAlign.Center)
                    }
                    NativeEntryKeypad(copy, !busy, pin.isNotEmpty(),
                        onDigit = { updatePin(pin + it) }, onClear = { updatePin("") }, onDelete = { updatePin(pin.dropLast(1)) })
                }
            }
            if (wide) {
                Row(Modifier.fillMaxWidth().padding(vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(32.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.weight(1f)) { identity() }
                    Box(Modifier.weight(1f), contentAlignment = Alignment.Center) { controls() }
                }
            } else {
                Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    identity()
                    controls()
                }
            }
        }
    }
}

@Composable
private fun NativeEntryPinDots(copy: NativePosCopy, filled: Int, isError: Boolean) {
    BoxWithConstraints(Modifier.fillMaxWidth().semantics {
        contentDescription = "${copy.authPinLabel}. ${copy.authPinProgress.format(filled, ENTRY_PIN_LENGTH)}"
    }) {
        val slotWidth = ((maxWidth - 40.dp) / ENTRY_PIN_LENGTH).coerceAtMost(44.dp)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally)) {
            repeat(ENTRY_PIN_LENGTH) { index ->
                val border by animateColorAsState(if (isError) ENTRY_ERROR else if (index <= filled) ENTRY_INK else ENTRY_BORDER,
                    tween(120), label = "pin-border")
                val dotScale by animateFloatAsState(if (index < filled) 1f else 0f, tween(120), label = "pin-dot")
                Box(Modifier.width(slotWidth).height(48.dp).clip(RoundedCornerShape(10.dp))
                    .background(if (isError) Color(0xFFFEF3F2) else ENTRY_SOFT).border(1.dp, border, RoundedCornerShape(10.dp)), contentAlignment = Alignment.Center) {
                    Box(Modifier.size(9.dp).graphicsLayer { scaleX = dotScale; scaleY = dotScale }.clip(CircleShape).background(ENTRY_INK))
                }
            }
        }
    }
}

@Composable
private fun NativeEntryKeypad(copy: NativePosCopy, enabled: Boolean, canDelete: Boolean,
    onDigit: (String) -> Unit, onClear: () -> Unit, onDelete: () -> Unit) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        listOf(listOf("1", "2", "3"), listOf("4", "5", "6"), listOf("7", "8", "9")).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                row.forEach { digit -> NativeEntryKey(digit, enabled, Modifier.weight(1f), onClick = { onDigit(digit) }) }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            NativeEntryKey(copy.authPinClear, enabled && canDelete, Modifier.weight(1f), control = true, onClick = onClear)
            NativeEntryKey("0", enabled, Modifier.weight(1f), onClick = { onDigit("0") })
            NativeEntryKey(copy.authPinDelete, enabled && canDelete, Modifier.weight(1f), control = true, icon = EntryIcons.Delete, onClick = onDelete)
        }
    }
}

@Composable
private fun NativeEntryKey(label: String, enabled: Boolean, modifier: Modifier, control: Boolean = false,
    icon: ImageVector? = null, onClick: () -> Unit) {
    val interactions = remember { MutableInteractionSource() }
    val pressed by interactions.collectIsPressedAsState()
    val scale by animateFloatAsState(if (pressed) 0.95f else 1f, tween(100), label = "key-press")
    OutlinedButton(onClick = onClick, enabled = enabled, interactionSource = interactions,
        modifier = modifier.height(58.dp).graphicsLayer { scaleX = scale; scaleY = scale },
        shape = RoundedCornerShape(13.dp), border = if (control) null else BorderStroke(1.dp, ENTRY_BORDER),
        colors = ButtonDefaults.outlinedButtonColors(containerColor = if (control) Color.Transparent else ENTRY_SOFT,
            contentColor = if (control) ENTRY_MUTED else ENTRY_INK, disabledContentColor = ENTRY_MUTED.copy(alpha = 0.35f)),
        contentPadding = PaddingValues(0.dp)) {
        if (icon != null) Icon(icon, label, modifier = Modifier.size(21.dp))
        else Text(label, fontSize = if (control) 12.sp else 23.sp, lineHeight = if (control) 18.sp else 28.sp,
            fontWeight = if (control) FontWeight.Medium else FontWeight.SemiBold)
    }
}

@Composable
internal fun PinLanguageMenu(language: NativePinLanguage, onLanguageSelected: (NativePinLanguage) -> Unit, enabled: Boolean = true) {
    var expanded by remember { mutableStateOf(false) }
    val copy = nativePosCopy(language.code)
    Box {
        OutlinedButton(onClick = { expanded = true }, enabled = enabled,
            modifier = Modifier.height(36.dp).semantics { contentDescription = "${copy.authLanguageLabel}: ${language.label}" },
            shape = RoundedCornerShape(10.dp), border = BorderStroke(1.dp, ENTRY_BORDER),
            colors = ButtonDefaults.outlinedButtonColors(containerColor = Color.White, contentColor = ENTRY_INK),
            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 0.dp)) {
            Icon(EntryIcons.Globe, null, Modifier.size(15.dp))
            Spacer(Modifier.width(6.dp))
            Text(language.label, fontSize = 12.sp, lineHeight = 18.sp, fontWeight = FontWeight.Medium)
            Spacer(Modifier.width(5.dp))
            Icon(EntryIcons.ChevronDown, null, Modifier.size(13.dp))
        }
        DropdownMenu(expanded, onDismissRequest = { expanded = false }, shape = RoundedCornerShape(12.dp), containerColor = Color.White) {
            NativePinLanguage.entries.forEach { option ->
                DropdownMenuItem(text = { Text(option.label, color = ENTRY_INK, fontSize = 14.sp) },
                    trailingIcon = if (language == option) ({ Icon(EntryIcons.Check, null, tint = ENTRY_INK, modifier = Modifier.size(16.dp)) }) else null,
                    onClick = { onLanguageSelected(option); expanded = false })
            }
        }
    }
}

@Composable
private fun NativeEntryNetworkBadge(copy: NativePosCopy, online: Boolean) {
    val color = if (online) Color(0xFF15803D) else Color(0xFF92400E)
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
        Box(Modifier.size(6.dp).clip(CircleShape).background(color))
        Text(if (online) copy.online else copy.offline, color = color, fontSize = 10.sp, lineHeight = 14.sp, fontWeight = FontWeight.Medium)
    }
}

private fun entryIcon(name: String, draw: PathBuilder.() -> Unit): ImageVector = ImageVector.Builder(
    name = name, defaultWidth = 24.dp, defaultHeight = 24.dp, viewportWidth = 24f, viewportHeight = 24f,
).apply {
    path(fill = null, stroke = SolidColor(Color.Black), strokeLineWidth = 1.8f,
        strokeLineCap = StrokeCap.Round, strokeLineJoin = StrokeJoin.Round, pathBuilder = draw)
}.build()

private object EntryIcons {
    val Lock = entryIcon("Lock") {
        moveTo(7f, 10f); lineTo(7f, 7f); curveTo(7f, 0.5f, 17f, 0.5f, 17f, 7f); lineTo(17f, 10f)
        moveTo(6f, 10f); lineTo(18f, 10f); quadTo(20f, 10f, 20f, 12f); lineTo(20f, 19f)
        quadTo(20f, 21f, 18f, 21f); lineTo(6f, 21f); quadTo(4f, 21f, 4f, 19f)
        lineTo(4f, 12f); quadTo(4f, 10f, 6f, 10f); close(); moveTo(12f, 14f); lineTo(12f, 17f)
    }
    val Mail = entryIcon("Mail") {
        moveTo(4f, 5f); lineTo(20f, 5f); quadTo(22f, 5f, 22f, 7f); lineTo(22f, 17f)
        quadTo(22f, 19f, 20f, 19f); lineTo(4f, 19f); quadTo(2f, 19f, 2f, 17f)
        lineTo(2f, 7f); quadTo(2f, 5f, 4f, 5f); close(); moveTo(3f, 6f); lineTo(12f, 13f); lineTo(21f, 6f)
    }
    val Device = entryIcon("Device") {
        moveTo(4f, 3f); lineTo(20f, 3f); quadTo(22f, 3f, 22f, 5f); lineTo(22f, 15f)
        quadTo(22f, 17f, 20f, 17f); lineTo(4f, 17f); quadTo(2f, 17f, 2f, 15f)
        lineTo(2f, 5f); quadTo(2f, 3f, 4f, 3f); close(); moveTo(12f, 17f); lineTo(12f, 21f)
        moveTo(8f, 21f); lineTo(16f, 21f)
    }
    val Store = entryIcon("Store") {
        moveTo(4f, 10f); lineTo(4f, 21f); lineTo(20f, 21f); lineTo(20f, 10f)
        moveTo(2f, 10f); lineTo(5f, 3f); lineTo(19f, 3f); lineTo(22f, 10f); close()
        moveTo(9f, 21f); lineTo(9f, 14f); lineTo(15f, 14f); lineTo(15f, 21f)
    }
    val Check = entryIcon("Check") { moveTo(5f, 12f); lineTo(10f, 17f); lineTo(19f, 6f) }
    val Arrow = entryIcon("Arrow") { moveTo(4f, 12f); lineTo(20f, 12f); moveTo(14f, 6f); lineTo(20f, 12f); lineTo(14f, 18f) }
    val ChevronDown = entryIcon("ChevronDown") { moveTo(5f, 9f); lineTo(12f, 16f); lineTo(19f, 9f) }
    val Delete = entryIcon("Delete") {
        moveTo(9f, 4f); lineTo(21f, 4f); lineTo(21f, 20f); lineTo(9f, 20f); lineTo(2f, 12f); close()
        moveTo(12f, 9f); lineTo(17f, 15f); moveTo(17f, 9f); lineTo(12f, 15f)
    }
    val Eye = entryIcon("Eye") {
        moveTo(1f, 12f); curveTo(7f, 2f, 17f, 2f, 23f, 12f); curveTo(17f, 22f, 7f, 22f, 1f, 12f); close()
        moveTo(15f, 12f); curveTo(15f, 16f, 9f, 16f, 9f, 12f); curveTo(9f, 8f, 15f, 8f, 15f, 12f); close()
    }
    val EyeOff = entryIcon("EyeOff") {
        moveTo(2f, 2f); lineTo(22f, 22f); moveTo(9f, 5f); curveTo(15f, 3f, 20f, 7f, 23f, 12f)
        lineTo(20f, 16f); moveTo(16f, 19f); curveTo(10f, 21f, 4f, 18f, 1f, 12f); lineTo(5f, 7f)
    }
    val Globe = entryIcon("Globe") {
        moveTo(22f, 12f); curveTo(22f, 25.3f, 2f, 25.3f, 2f, 12f); curveTo(2f, -1.3f, 22f, -1.3f, 22f, 12f); close()
        moveTo(2f, 12f); lineTo(22f, 12f); moveTo(12f, 2f); curveTo(18f, 7f, 18f, 17f, 12f, 22f)
        curveTo(6f, 17f, 6f, 7f, 12f, 2f); close()
    }
    val Info = entryIcon("Info") {
        moveTo(22f, 12f); curveTo(22f, 25.3f, 2f, 25.3f, 2f, 12f); curveTo(2f, -1.3f, 22f, -1.3f, 22f, 12f); close()
        moveTo(12f, 11f); lineTo(12f, 17f); moveTo(12f, 7f); lineTo(12f, 7.2f)
    }
}
