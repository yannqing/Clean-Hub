package com.cleanhub.pos.nativepos

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlin.math.floor

internal enum class NativeNavigationDestination {
    Workspace, Sale, Intake, Tickets, Scan, Customers, Catalog, Orders, Shift, Statistics, Notifications, Settings, More;

    fun title(copy: NativePosCopy): String = when (this) {
        Workspace -> copy.tabWorkspace
        Sale -> copy.tabSale
        Intake -> copy.tabIntake
        Tickets -> copy.tabTickets
        Scan -> copy.menuScan
        Customers -> copy.menuCustomers
        Catalog -> copy.navigationCatalogue
        Orders -> copy.menuOrders
        Shift -> copy.menuShift
        Statistics -> copy.menuStatistics
        Notifications -> copy.menuNotifications
        Settings -> copy.settingsShort
        More -> copy.tabMore
    }
}

internal data class NativeNavigationLayout(
    val visible: List<NativeNavigationDestination>,
    val overflow: List<NativeNavigationDestination>,
) {
    val displayed: List<NativeNavigationDestination>
        get() = visible + if (overflow.isEmpty()) emptyList() else listOf(NativeNavigationDestination.More)
}

/** Uses the measured window, including resizing and font scaling; reserves More only when needed. */
internal fun nativeNavigationLayout(availableDp: Float, itemExtentDp: Float, reservedDp: Float = 0f): NativeNavigationLayout {
    val items = NativeNavigationDestination.entries.filter { it != NativeNavigationDestination.More }
    val capacity = floor(((availableDp - reservedDp).coerceAtLeast(0f)) / itemExtentDp.coerceAtLeast(1f)).toInt().coerceAtLeast(1)
    val directCount = if (capacity >= items.size) items.size else capacity - 1
    return NativeNavigationLayout(items.take(directCount), items.drop(directCount))
}

@Composable
internal fun NativeAdaptiveNavigation(
    copy: NativePosCopy,
    terminal: NativeTerminal,
    layout: NativeNavigationLayout,
    current: NativeNavigationDestination,
    rail: Boolean,
    expanded: Boolean,
    itemExtentDp: Float,
    onSelect: (NativeNavigationDestination) -> Unit,
) {
    fun isSelected(item: NativeNavigationDestination) = current == item ||
        (item == NativeNavigationDestination.More && current in layout.overflow)
    if (rail) {
        Column(Modifier.width(if (expanded) 200.dp else 96.dp).fillMaxHeight().background(POS_PANEL_BACKGROUND).padding(horizontal = 8.dp)) {
            Box(Modifier.height(64.dp).fillMaxWidth(), contentAlignment = Alignment.Center) {
                NativeMerchantBrand(terminal, compact = !expanded, modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp))
            }
            layout.displayed.forEach { item ->
                key(item) {
                    NativeNavigationButton(copy, item, isSelected(item), expanded, itemExtentDp, onSelect)
                }
            }
            Spacer(Modifier.weight(1f))
            Spacer(Modifier.height(16.dp))
        }
    } else {
        val bottomHeight = 68f + 32f * (LocalDensity.current.fontScale - 1f).coerceAtLeast(0f)
        Column(Modifier.fillMaxWidth().background(POS_PANEL_BACKGROUND)) {
            HorizontalDivider(color = POS_BORDER)
            Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp)) {
                layout.displayed.forEach { item ->
                    key(item) {
                        Box(Modifier.weight(1f)) {
                            NativeNavigationButton(copy, item, isSelected(item), false, bottomHeight, onSelect)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun NativeNavigationButton(
    copy: NativePosCopy, item: NativeNavigationDestination, active: Boolean, expanded: Boolean,
    extent: Float, onSelect: (NativeNavigationDestination) -> Unit,
) {
    val modifier = Modifier.fillMaxWidth().height(extent.dp).padding(vertical = 3.dp).testTag("navigation-${item.name}")
        .clip(RoundedCornerShape(10.dp)).background(if (active) POS_PAGE_BACKGROUND else POS_PANEL_BACKGROUND)
        .semantics { selected = active }.clickable(role = Role.Tab) { onSelect(item) }
    if (expanded) Row(modifier.padding(horizontal = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        NativeNavigationGlyph(item, active)
        Text(item.title(copy), color = if (active) POS_INK else POS_MUTED,
            style = MaterialTheme.typography.bodySmall, fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal,
            maxLines = 2, overflow = TextOverflow.Ellipsis)
    } else Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp, Alignment.CenterVertically)) {
        NativeNavigationGlyph(item, active)
        Text(item.title(copy), color = if (active) POS_INK else POS_MUTED, style = MaterialTheme.typography.labelSmall,
            fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal, maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
internal fun NativeNavigationGlyph(item: NativeNavigationDestination, active: Boolean = false) {
    Canvas(Modifier.size(22.dp)) {
        val ink = if (active) POS_INK else POS_MUTED
        withTransform({ scale(size.width / 24f, size.height / 24f, pivot = Offset.Zero) }) {
            val path = Path()
            fun lines(vararg points: Float) {
                path.moveTo(points[0], points[1])
                for (i in 2 until points.size step 2) path.lineTo(points[i], points[i + 1])
            }
            when (item) {
                NativeNavigationDestination.Workspace -> { lines(3f,10f,12f,3f,21f,10f); lines(5f,9f,5f,21f,19f,21f,19f,9f); lines(9f,21f,9f,14f,15f,14f,15f,21f) }
                NativeNavigationDestination.Sale -> { lines(4f,8f,20f,8f,21f,21f,3f,21f,4f,8f); path.moveTo(8f,9f); path.cubicTo(8f,1f,16f,1f,16f,9f) }
                NativeNavigationDestination.Intake -> { lines(4f,4f,20f,4f,20f,20f,4f,20f,4f,4f); lines(7f,12f,17f,12f); lines(12f,7f,12f,17f) }
                NativeNavigationDestination.Tickets -> { lines(8f,4f,4f,4f,4f,22f,20f,22f,20f,4f,16f,4f); lines(8f,2f,16f,2f,16f,6f,8f,6f,8f,2f); lines(8f,11f,16f,11f); lines(8f,16f,16f,16f) }
                NativeNavigationDestination.Scan -> { lines(3f,8f,3f,3f,8f,3f); lines(16f,3f,21f,3f,21f,8f); lines(21f,16f,21f,21f,16f,21f); lines(8f,21f,3f,21f,3f,16f); lines(3f,12f,21f,12f) }
                NativeNavigationDestination.Customers -> { drawCircle(ink,3f,Offset(9f,7f),style=Stroke(1.8f)); drawCircle(ink,2.5f,Offset(18f,9f),style=Stroke(1.8f)); path.moveTo(2f,21f); path.cubicTo(2f,10f,16f,10f,16f,21f); path.moveTo(17f,14f); path.cubicTo(22f,14f,22f,18f,22f,21f) }
                NativeNavigationDestination.Catalog -> { lines(3f,7f,12f,2f,21f,7f,21f,17f,12f,22f,3f,17f,3f,7f,12f,12f,21f,7f); lines(12f,12f,12f,22f); lines(7f,5f,16f,10f) }
                NativeNavigationDestination.Orders -> { lines(5f,3f,19f,3f,19f,22f,16f,20f,12f,22f,8f,20f,5f,22f,5f,3f); lines(8f,8f,16f,8f); lines(8f,13f,16f,13f) }
                NativeNavigationDestination.Shift -> { lines(3f,7f,20f,7f,16f,3f); lines(20f,7f,16f,11f); lines(21f,17f,4f,17f,8f,13f); lines(4f,17f,8f,21f) }
                NativeNavigationDestination.Statistics -> { lines(3f,3f,3f,21f,22f,21f); lines(7f,17f,7f,11f); lines(12f,17f,12f,6f); lines(17f,17f,17f,3f) }
                NativeNavigationDestination.Notifications -> { path.moveTo(4f,18f); path.cubicTo(7f,15f,5f,4f,12f,4f); path.cubicTo(19f,4f,17f,15f,20f,18f); path.close(); lines(10f,22f,14f,22f); lines(12f,2f,12f,4f) }
                NativeNavigationDestination.Settings -> { drawCircle(ink,7f,Offset(12f,12f),style=Stroke(1.8f)); drawCircle(ink,2.5f,Offset(12f,12f),style=Stroke(1.8f)); for(i in 0..7){ val a=i*Math.PI/4; lines((12+7*kotlin.math.cos(a)).toFloat(),(12+7*kotlin.math.sin(a)).toFloat(),(12+10*kotlin.math.cos(a)).toFloat(),(12+10*kotlin.math.sin(a)).toFloat()) } }
                NativeNavigationDestination.More -> { for(x in listOf(4f,12f,20f)) drawCircle(ink,1.6f,Offset(x,12f)) }
            }
            drawPath(path, ink, style = Stroke(1.8f, cap = StrokeCap.Round, join = StrokeJoin.Round))
        }
    }
}
