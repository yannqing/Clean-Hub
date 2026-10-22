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
     * The catalogue used to be a data class, where the compiler named every
     * language that was missing a field. A map has no such ceiling -- and no
     * such check -- so completeness is asserted here instead: every language
     * must define exactly the same keys.
     */
    @Test
    fun everyLanguageDefinesTheSameKeys() {
        val reference = NATIVE_POS_COPY_BY_LANGUAGE.getValue("zh-CN").keys

        NATIVE_POS_COPY_BY_LANGUAGE.forEach { (code, values) ->
            assertEquals(
                "$code is missing keys",
                emptySet<String>(),
                reference - values.keys,
            )
            assertEquals(
                "$code has keys no other language defines",
                emptySet<String>(),
                values.keys - reference,
            )
        }
    }

    /**
     * A French cashier used to sign in through French copy and then meet
     * Chinese for everything after it. Every value must be filled in every
     * language or that returns in a narrower form.
     */
    @Test
    fun noLanguageHasAnEmptyString() {
        NATIVE_POS_COPY_BY_LANGUAGE.forEach { (code, values) ->
            values.forEach { (key, value) ->
                assertTrue("$code.$key must not be blank", value.isNotBlank())
            }
        }
    }

    /**
     * Every accessor must resolve. A key present in the map but spelled
     * differently in the accessor would throw only when a cashier reached
     * that screen.
     */
    @Test
    fun everyAccessorResolves() {
        languages.forEach { code ->
            val copy = nativePosCopy(code)
            NativePosCopy::class.java.methods
                .filter { it.name.startsWith("get") && it.parameterCount == 0 }
                .filter { it.returnType == String::class.java }
                .forEach { accessor ->
                    val value = accessor.invoke(copy) as String
                    assertTrue(
                        "$code.${accessor.name} must not be blank",
                        value.isNotBlank(),
                    )
                }
        }
    }

    /**
     * The class must actually load. A data class with one parameter per string
     * compiles cleanly and then fails at runtime with ClassFormatError once it
     * passes roughly 254 parameters, which is how this catalogue broke.
     */
    @Test
    fun theCatalogueLoadsWithEveryStringItCarries() {
        val copy = nativePosCopy("fr")

        assertTrue("the catalogue should carry the whole UI", copy.keys().size > 300)
        assertTrue(copy.checkout.isNotBlank())
        assertTrue(copy.useDefaultPrinterHint.isNotBlank())
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
        assertNotEquals(zh.clockIn, fr.clockIn)
        assertNotEquals(zh.registerTitle, fr.registerTitle)
    }

    /**
     * Placeholders are formatted with a value at runtime. A language that lost
     * one -- or gained one the call site does not supply -- renders the raw
     * template to the cashier, or throws.
     */
    @Test
    fun placeholdersSurviveTranslation() {
        val reference = NATIVE_POS_COPY_BY_LANGUAGE.getValue("zh-CN")

        NATIVE_POS_COPY_BY_LANGUAGE.forEach { (code, values) ->
            reference.forEach { (key, chinese) ->
                assertEquals(
                    "$code.$key must use the same placeholders as the Chinese",
                    placeholdersIn(chinese),
                    placeholdersIn(values.getValue(key)),
                )
            }
        }
    }

    private fun placeholdersIn(value: String): List<String> =
        Regex("%[sd]").findAll(value).map { it.value }.toList()

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
