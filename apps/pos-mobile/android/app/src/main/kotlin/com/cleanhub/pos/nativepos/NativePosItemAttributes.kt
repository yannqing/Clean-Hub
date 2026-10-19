package com.cleanhub.pos.nativepos

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import java.util.Locale
import org.json.JSONArray
import org.json.JSONObject

internal fun nativeQuickPhraseToggle(current: String, phrase: String): String {
    val parts = current.split(Regex("[;；\\n]+")).map { it.trim() }.filter { it.isNotEmpty() }
    val next = if (phrase in parts) parts.filter { it != phrase } else parts + phrase
    val result = next.joinToString("; ")
    return if (result.length <= 2000) result else current
}

internal fun nativeAttributeOptions(
    preset: List<String>,
    recent: List<String>,
    query: String,
): List<String> =
    (recent + preset)
        .map { it.trim() }
        .filter { it.isNotBlank() }
        .distinctBy { it.lowercase(Locale.ROOT) }
        .filter { it.contains(query.trim(), ignoreCase = true) }

/** A preference per tenant, never shared across tenant re-enrolment. */
internal class NativeItemBrandHistory(context: Context, private val tenantId: String?) {
    private val prefs =
        context.getSharedPreferences("cleanhub_item_brand_history", Context.MODE_PRIVATE)

    private fun entries(now: Long): List<Pair<String, Long>> {
        if (tenantId.isNullOrBlank()) return emptyList()
        return runCatching {
                val data = JSONArray(prefs.getString(tenantId, "[]"))
                (0 until data.length())
                    .mapNotNull { index ->
                        data.optJSONObject(index)?.let { row ->
                            val value = row.optString("value").trim()
                            val expires = row.optLong("expires")
                            if (value.isNotBlank() && value.length <= 80 && expires > now)
                                value to expires
                            else null
                        }
                    }
                    .take(50)
            }
            .getOrDefault(emptyList())
    }

    fun load(): List<String> = entries(System.currentTimeMillis()).map { it.first }

    fun remember(value: String): List<String> {
        val normalized = value.trim().replace(Regex("\\s+"), " ")
        if (tenantId.isNullOrBlank() || normalized.isBlank() || normalized.length > 80)
            return load()
        val now = System.currentTimeMillis()
        val result =
            (listOf(normalized to (now + 90L * 24 * 60 * 60 * 1000)) +
                    entries(now).filterNot { it.first.equals(normalized, true) })
                .take(50)
        val json =
            JSONArray().apply {
                result.forEach {
                    put(JSONObject().put("value", it.first).put("expires", it.second))
                }
            }
        prefs.edit().putString(tenantId, json.toString()).apply()
        return result.map { it.first }
    }
}

private val COLOR_SWATCHES =
    listOf(
        0xffffff,
        0x171717,
        0x737373,
        0xd6c7aa,
        0xdc2626,
        0x2563eb,
        0x16a34a,
        0xeab308,
        0x9333ea,
        0xec4899,
        0xf97316,
        0x92400e,
        0x172554,
        0x404040,
        0x1e3a8a,
        0x14532d,
        0x881337,
        0xb08968,
        0x93c5fd,
        0xfbcfe8,
        0xd4d4d4,
        0xfffaf0,
        0xf5d0a9,
    )

@Composable
internal fun NativeItemAttributePicker(
    copy: NativePosCopy,
    label: String,
    value: String,
    options: List<String>,
    enabled: Boolean,
    maxLength: Int,
    recent: List<String> = emptyList(),
    colours: Boolean = false,
    allowCustom: Boolean = true,
    onChange: (String) -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    var query by remember { mutableStateOf("") }
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = POS_MUTED)
        Surface(
            onClick = {
                query = ""
                open = true
            },
            enabled = enabled,
            shape = RoundedCornerShape(12.dp),
            color = POS_PANEL_BACKGROUND,
            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xffdedede)),
            modifier = Modifier.fillMaxWidth().semantics { contentDescription = label },
        ) {
            Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    value.ifBlank { copy.attributeSelect },
                    Modifier.weight(1f),
                    color = if (value.isBlank()) POS_MUTED else POS_INK,
                )
                Text("⌄", color = POS_MUTED)
            }
        }
    }
    if (open)
        Dialog(
            onDismissRequest = { open = false },
            properties =
                DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = true),
        ) {
            BoxWithConstraints(
                Modifier.fillMaxSize().systemBarsPadding().imePadding().padding(16.dp),
                contentAlignment = Alignment.Center,
            ) {
                Surface(
                    Modifier.widthIn(max = 560.dp)
                        .fillMaxWidth()
                        .heightIn(max = maxHeight * 0.88f)
                        .fillMaxHeight(),
                    shape = RoundedCornerShape(20.dp),
                    color = POS_PAGE_BACKGROUND,
                ) {
                    Column(
                        Modifier.fillMaxSize().padding(20.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Text(
                            label,
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                        )
                        NativePosInput(
                            value = query,
                            onValueChange = { query = it.take(maxLength) },
                            label = { Text(copy.attributeSearch) },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        val matches = nativeAttributeOptions(options, recent, query)
                        LazyColumn(Modifier.fillMaxWidth().weight(1f)) {
                            items(matches, key = { it.lowercase(Locale.ROOT) }) { option ->
                                Row(
                                    Modifier.fillMaxWidth()
                                        .clickable {
                                            onChange(option)
                                            open = false
                                        }
                                        .padding(vertical = 13.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                                ) {
                                    val swatch =
                                        options.indexOf(option).takeIf {
                                            colours && it in COLOR_SWATCHES.indices
                                        }
                                    if (swatch != null)
                                        Box(
                                            Modifier.size(18.dp)
                                                .background(
                                                    Color(
                                                        0xff000000L or
                                                            COLOR_SWATCHES[swatch].toLong()
                                                    ),
                                                    CircleShape,
                                                )
                                        )
                                    Text(option, Modifier.weight(1f), color = POS_INK)
                                    if (option == value) Text("✓", color = POS_ACCENT)
                                }
                            }
                            if (matches.isEmpty() && query.isBlank())
                                item { Text(copy.attributeNoMatches, color = POS_MUTED) }
                        }
                        val custom = query.trim()
                        if (
                            allowCustom &&
                                custom.isNotEmpty() &&
                                (options + recent).none { it.equals(custom, true) }
                        )
                            Button(
                                onClick = {
                                    onChange(custom)
                                    open = false
                                },
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Text(copy.attributeUseCustom.replace("%s", custom))
                            }
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            TextButton(
                                onClick = {
                                    onChange("")
                                    open = false
                                }
                            ) {
                                Text(copy.attributeClear)
                            }
                            TextButton(onClick = { open = false }) { Text(copy.back) }
                        }
                    }
                }
            }
        }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun NativeItemQuickPhrases(
    copy: NativePosCopy,
    value: String,
    phrases: String,
    enabled: Boolean,
    onChange: (String) -> Unit,
) {
    val chosen = value.split(Regex("[;；\\n]+")).map { it.trim() }.toSet()
    Text(copy.attributeQuickPhrases, color = POS_MUTED, style = MaterialTheme.typography.bodySmall)
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        phrases.split('|').forEach { phrase ->
            FilterChip(
                selected = phrase in chosen,
                onClick = { onChange(nativeQuickPhraseToggle(value, phrase)) },
                enabled = enabled,
                label = { Text(phrase) },
            )
        }
    }
}
