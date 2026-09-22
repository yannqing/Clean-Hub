package com.cleanhub.pos

import android.os.Bundle
import android.view.KeyEvent
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.cleanhub.pos.nativepos.NativePosApp

/** Receives keyboard-wedge barcode input before Compose routes it to a focused field. */
object NativeScannerKeyboardBridge {
    @Volatile
    var listener: ((KeyEvent) -> Boolean)? = null

    fun dispatch(event: KeyEvent): Boolean = listener?.invoke(event) == true
}

/**
 * Last moment the cashier touched the till, for the idle lock.
 *
 * Reported from the Activity rather than from Compose because a tap that lands
 * on no composable -- an empty area of the sale screen, a scanner keypress --
 * still means somebody is standing there. Scanner input counts: a cashier
 * working a queue of customers may touch nothing but the scanner for minutes.
 */
object NativePosActivityClock {
    @Volatile
    var lastInteractionAt: Long = System.currentTimeMillis()
        private set

    fun mark() {
        lastInteractionAt = System.currentTimeMillis()
    }
}

/** The POS user interface runs directly from the installed APK. */
class MainActivity : ComponentActivity() {
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        NativePosActivityClock.mark()
        if (NativeScannerKeyboardBridge.dispatch(event)) return true
        return super.dispatchKeyEvent(event)
    }

    override fun onUserInteraction() {
        super.onUserInteraction()
        NativePosActivityClock.mark()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MaterialTheme {
                Surface {
                    NativePosApp(this@MainActivity)
                }
            }
        }
    }
}
