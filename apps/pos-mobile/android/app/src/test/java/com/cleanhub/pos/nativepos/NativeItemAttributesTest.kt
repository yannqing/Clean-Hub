package com.cleanhub.pos.nativepos

import org.junit.Assert.*
import org.junit.Test

class NativeItemAttributesTest {
    @Test
    fun phrasesToggleWithoutLosingManualNotesOrDuplicatingEntries() {
        val added = nativeQuickPhraseToggle("Customer note；Existing stain", "No tumble drying")
        assertEquals("Customer note; Existing stain; No tumble drying", added)
        assertEquals(
            "Customer note; Existing stain",
            nativeQuickPhraseToggle(added, "No tumble drying"),
        )
        val full = "x".repeat(2000)
        assertEquals(full, nativeQuickPhraseToggle(full, "Extra request"))
    }

    @Test
    fun brandSearchDeduplicatesRecentAndPresetBrandsIgnoringCase() {
        assertEquals(
            listOf("nike", "New brand"),
            nativeAttributeOptions(listOf("Nike", "Adidas"), listOf("nike", "New brand"), "n"),
        )
        assertEquals(
            listOf("Adidas"),
            nativeAttributeOptions(listOf("Nike", "Adidas"), emptyList(), " ADI "),
        )
    }

    @Test
    fun presetCoverageAndCatalogueTextFollowTheActiveLanguage() {
        listOf("en", "fr", "zh-CN").forEach { language ->
            val copy = nativePosCopy(language)
            assertEquals(27, copy.itemColorChoices.split('|').size)
            assertEquals(24, copy.itemMaterialChoices.split('|').size)
            assertEquals(10, copy.itemDefectPhrases.split('|').size)
            assertEquals(10, copy.itemRequestPhrases.split('|').size)
            assertEquals(6, copy.itemRemarkPhrases.split('|').size)
            assertTrue(copy.itemBrandChoices.split('|').contains("Nike"))
        }
        assertEquals("Chemise", nativeCatalogText(mapOf("en" to "Shirt", "fr" to "Chemise"), "fr"))
        assertEquals("Shirt", nativeCatalogText(mapOf("en" to "Shirt"), "zh-CN"))
    }
}
