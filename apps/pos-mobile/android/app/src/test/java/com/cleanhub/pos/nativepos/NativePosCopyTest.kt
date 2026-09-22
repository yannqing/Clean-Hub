package com.cleanhub.pos.nativepos

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class NativePosCopyTest {

    private val languages = listOf("zh-CN", "en", "fr")

    @Test
    fun everyLanguageResolves() {
        languages.forEach { code ->
            assertNotEquals("$code must have copy", null, nativePosCopy(code))
        }
    }

    /**
     * A French cashier used to sign in through French copy and then meet
     * Chinese for everything after it. Every field must be filled in every
     * language or that returns in a narrower form.
     */
    @Test
    fun noLanguageHasAnEmptyString() {
        languages.forEach { code ->
            val copy = nativePosCopy(code)
            NativePosCopy::class.java.declaredFields
                .filter { it.type == String::class.java }
                .forEach { field ->
                    field.isAccessible = true
                    val value = field.get(copy) as String
                    assertTrue(
                        "$code.${field.name} must not be blank",
                        value.isNotBlank(),
                    )
                }
        }
    }

    @Test
    fun theTranslationsAreActuallyDifferent() {
        // A field copy-pasted between languages is the usual way a catalogue
        // rots; Chinese and French should share no wording.
        val zh = nativePosCopy("zh-CN")
        val fr = nativePosCopy("fr")

        assertNotEquals(zh.checkout, fr.checkout)
        assertNotEquals(zh.tenderBelowTotal, fr.tenderBelowTotal)
        assertNotEquals(zh.printerOutOfPaper, fr.printerOutOfPaper)
    }

    @Test
    fun placeholdersSurviveTranslation() {
        // These are formatted with a number at runtime. A language that lost
        // its %d would render the raw template to the cashier.
        languages.forEach { code ->
            val copy = nativePosCopy(code)
            assertTrue(
                "$code staleCatalogWarning needs its %d",
                copy.staleCatalogWarning.contains("%d"),
            )
            assertTrue(
                "$code pendingSalesSuffix needs its %d",
                copy.pendingSalesSuffix.contains("%d"),
            )
        }
    }

    @Test
    fun anUnknownOrMissingLanguageFallsBackToChinese() {
        val chinese = nativePosCopy("zh-CN")

        assertEquals(chinese.checkout, nativePosCopy(null).checkout)
        assertEquals(chinese.checkout, nativePosCopy("").checkout)
        assertEquals(chinese.checkout, nativePosCopy("de").checkout)
    }

    @Test
    fun languageCodesAreMatchedRegardlessOfCase() {
        assertEquals(nativePosCopy("fr").checkout, nativePosCopy("FR").checkout)
        assertEquals(nativePosCopy("en").checkout, nativePosCopy(" En ").checkout)
    }
}
