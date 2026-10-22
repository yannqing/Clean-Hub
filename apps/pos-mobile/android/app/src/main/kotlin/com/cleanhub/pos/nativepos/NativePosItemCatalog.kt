package com.cleanhub.pos.nativepos

import org.json.JSONArray
import org.json.JSONObject

data class NativeCatalogArticle(
    val id: String,
    val names: Map<String, String>,
    val descriptions: Map<String, String>,
)

data class NativeCatalogItemGroup(
    val id: String,
    val itemType: String,
    val names: Map<String, String>,
    val descriptions: Map<String, String>,
    val items: List<NativeCatalogArticle>,
)

data class NativeItemCatalog(val configured: Boolean, val groups: List<NativeCatalogItemGroup>)

internal fun nativeCatalogText(values: Map<String, String>, language: String): String =
    values[language]?.takeIf { it.isNotBlank() } ?: values["en"].orEmpty()

internal fun JSONObject.toNativeItemCatalog(): NativeItemCatalog {
    fun JSONObject.texts(key: String): Map<String, String> =
        optJSONObject(key)?.let { value ->
            listOf("en", "fr", "zh-CN").associateWith {
                value.optString(it).takeUnless { it == "null" }.orEmpty()
            }
        } ?: emptyMap()
    val rows = optJSONArray("groups") ?: JSONArray()
    return NativeItemCatalog(
        configured = optJSONObject("selection") != null,
        groups =
            buildList {
                for (index in 0 until rows.length()) {
                    val group = rows.optJSONObject(index) ?: continue
                    if (!group.optBoolean("enabled", true)) continue
                    val entries = group.optJSONArray("items") ?: JSONArray()
                    add(
                        NativeCatalogItemGroup(
                            group.optString("id"),
                            group.optString("itemType"),
                            group.texts("names"),
                            group.texts("descriptions"),
                            buildList {
                                for (at in 0 until entries.length()) {
                                    val item = entries.optJSONObject(at) ?: continue
                                    if (item.optBoolean("enabled", true))
                                        add(
                                            NativeCatalogArticle(
                                                item.optString("id"),
                                                item.texts("names"),
                                                item.texts("descriptions"),
                                            )
                                        )
                                }
                            },
                        )
                    )
                }
            },
    )
}
