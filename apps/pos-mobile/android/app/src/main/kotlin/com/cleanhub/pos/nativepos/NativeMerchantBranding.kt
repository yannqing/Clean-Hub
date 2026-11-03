package com.cleanhub.pos.nativepos

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.cleanhub.pos.BuildConfig
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** An unavailable logo always leaves a recognizable merchant identity. */
internal fun nativeMerchantTitle(displayName: String, merchantName: String, hasLogo: Boolean): String =
    displayName.trim().ifBlank { if (hasLogo) "" else merchantName.trim() }

internal fun nativeBrandLogoCacheKey(tenantId: String, objectKey: String): String =
    MessageDigest.getInstance("SHA-256").digest("$tenantId:$objectKey".toByteArray()).joinToString("") { "%02x".format(it) }

/** Stores pixels, never expiring signed URLs, and never forwards terminal credentials to storage. */
internal class NativeBrandLogoCache(context: Context) {
    private val root = File(context.filesDir, "merchant-branding")

    fun synchronize(tenantId: String, objectKey: String?, signedUrl: String?): String? {
        if (objectKey.isNullOrBlank()) return null
        val directory = File(root, nativeBrandLogoCacheKey(tenantId, "tenant"))
        val target = File(directory, nativeBrandLogoCacheKey(tenantId, objectKey) + ".png")
        if (target.isFile && target.length() > 0) return target.absolutePath
        if (signedUrl.isNullOrBlank()) return null
        return runCatching {
            val url = URL(signedUrl)
            require(url.protocol == "https" || (BuildConfig.DEBUG && url.protocol == "http"))
            directory.mkdirs()
            val download = File.createTempFile("logo-download-", ".tmp", directory)
            val encoded = File.createTempFile("logo-pixels-", ".tmp", directory)
            try {
                val connection = (url.openConnection() as HttpURLConnection).apply {
                    connectTimeout = 8_000; readTimeout = 8_000; instanceFollowRedirects = false
                }
                try {
                    require(connection.responseCode == 200)
                    require(connection.contentLengthLong <= 5 * 1024 * 1024)
                    connection.inputStream.use { input ->
                        download.outputStream().use { output ->
                            val buffer = ByteArray(8192)
                            var total = 0
                            while (true) {
                                val count = input.read(buffer)
                                if (count < 0) break
                                total += count
                                require(total <= 5 * 1024 * 1024)
                                output.write(buffer, 0, count)
                            }
                        }
                    }
                } finally { connection.disconnect() }
                val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                BitmapFactory.decodeFile(download.absolutePath, bounds)
                require(bounds.outWidth in 1..32768 && bounds.outHeight in 1..32768)
                var sample = 1
                while (maxOf(bounds.outWidth, bounds.outHeight) / sample > 256) sample *= 2
                val bitmap = requireNotNull(BitmapFactory.decodeFile(download.absolutePath, BitmapFactory.Options().apply { inSampleSize = sample }))
                try {
                    encoded.outputStream().use { require(bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)) }
                } finally { bitmap.recycle() }
                require(encoded.renameTo(target))
                directory.listFiles()?.filter { it != target && it.extension == "png" }?.forEach { it.delete() }
                target.absolutePath
            } finally { download.delete(); encoded.delete() }
        }.getOrNull()
    }
}

@Composable
internal fun NativeMerchantBrand(terminal: NativeTerminal, compact: Boolean, modifier: Modifier = Modifier) {
    val logoPath = terminal.posLogoPath
    val bitmap by produceState<Bitmap?>(null, logoPath) {
        value = withContext(Dispatchers.IO) { logoPath?.let { BitmapFactory.decodeFile(it) } }
    }
    val title = nativeMerchantTitle(terminal.posDisplayName, terminal.merchantName, bitmap != null)
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        bitmap?.let { image ->
            Image(image.asImageBitmap(), contentDescription = terminal.merchantName,
                modifier = Modifier.size(if (compact) 36.dp else 40.dp).clip(RoundedCornerShape(8.dp)), contentScale = ContentScale.Fit)
        }
        if ((!compact || bitmap == null) && title.isNotBlank()) {
            Text(if (compact) title.take(2).uppercase() else title, color = POS_INK, fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.titleMedium, maxLines = if (compact) 1 else 2, overflow = TextOverflow.Ellipsis)
        }
    }
}
