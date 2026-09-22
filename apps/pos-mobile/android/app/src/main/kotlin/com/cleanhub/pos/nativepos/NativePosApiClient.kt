package com.cleanhub.pos.nativepos

import com.cleanhub.pos.BuildConfig
import java.io.BufferedReader
import java.io.IOException
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets
import org.json.JSONObject

class NativePosApiException(
    val status: Int,
    val code: String?,
    message: String,
) : IllegalStateException(message)

/**
 * Minimal cookie-authenticated API transport for the native APK. It deliberately
 * uses the same POS cookie names and client header as the web terminal, so
 * terminal credential rotation and backend revocation apply to both clients.
 */
class NativePosApiClient(private val session: NativePosSession) {
    fun configured(): Boolean = BuildConfig.CLEANHUB_POS_API_BASE_URL.isNotBlank()

    fun get(path: String): JSONObject = request("GET", path)

    fun post(path: String, body: JSONObject): JSONObject = request("POST", path, body)

    fun patch(path: String, body: JSONObject): JSONObject = request("PATCH", path, body)

    fun put(path: String, body: JSONObject): JSONObject = request("PUT", path, body)

    fun delete(path: String): JSONObject = request("DELETE", path)

    fun login(identifier: String, password: String): JSONObject = post(
        "/auth/login",
        JSONObject().put("identifier", identifier.trim()).put("password", password).put("deviceId", session.deviceId()),
    )

    fun bootstrap(): JSONObject = post("/auth/pos-bootstrap", JSONObject().put("deviceId", session.deviceId()))

    fun loginWithPin(pin: String): JSONObject = post(
        "/auth/pos-pin-login",
        JSONObject().put("pin", pin).put("deviceId", session.deviceId()),
    )

    fun refresh(): JSONObject = request("POST", "/auth/refresh", retryAfterRefresh = false)

    private fun request(
        method: String,
        path: String,
        body: JSONObject? = null,
        retryAfterRefresh: Boolean = true,
    ): JSONObject {
        if (!configured()) throw NativePosApiException(0, "POS_API_NOT_CONFIGURED", "该 APK 没有配置 POS API 地址。")
        val response = execute(method, path, body)
        if (response.status == 401 && retryAfterRefresh && path != "/auth/refresh") {
            // A refresh that fails means the session is gone. Retrying the
            // original call with the same dead cookies only produces a second,
            // more confusing 401, so surface the refresh failure instead and
            // let the caller send the cashier back to the PIN screen.
            refresh()
            return request(method, path, body, retryAfterRefresh = false)
        }
        if (response.status !in 200..299) {
            val error = response.body.toJsonOrNull()
            throw NativePosApiException(
                response.status,
                error?.optString("code")?.takeIf { it.isNotBlank() },
                error?.optString("message")?.takeIf { it.isNotBlank() }
                    ?: "POS API 请求失败（HTTP ${response.status}）。",
            )
        }
        return response.body.toJsonOrNull() ?: JSONObject()
    }

    private fun execute(method: String, path: String, body: JSONObject?): NativeHttpResponse {
        val normalizedBase = BuildConfig.CLEANHUB_POS_API_BASE_URL.trimEnd('/')
        val connection = (URL("$normalizedBase$path").openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 12_000
            readTimeout = 20_000
            doInput = true
            setRequestProperty("Accept", "application/json")
            setRequestProperty("X-CleanHub-Auth-Client", "pos")
            session.cookieHeader().takeIf { it.isNotBlank() }?.let { setRequestProperty("Cookie", it) }
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
        }
        try {
            if (body != null) {
                OutputStreamWriter(connection.outputStream, StandardCharsets.UTF_8).use { it.write(body.toString()) }
            }
            val status = connection.responseCode
            val headers = connection.headerFields.entries
                .filter { it.key?.equals("Set-Cookie", ignoreCase = true) == true }
                .flatMap { it.value.orEmpty() }
            session.saveSetCookieHeaders(headers)
            val stream = if (status in 200..399) connection.inputStream else connection.errorStream
            val text = stream?.bufferedReader(StandardCharsets.UTF_8)?.use(BufferedReader::readText).orEmpty()
            return NativeHttpResponse(status, text)
        } catch (error: IOException) {
            // A dropped connection or a timeout is reported as status 0, the
            // same shape as every other transport failure. Callers -- the
            // offline replay loop above all -- classify failures by status, and
            // a raw IOException would slip past that classification entirely.
            throw NativePosApiException(
                0,
                "NETWORK_ERROR",
                error.message?.takeIf { it.isNotBlank() } ?: "网络连接中断，请稍后重试。",
            )
        } finally {
            connection.disconnect()
        }
    }

    private data class NativeHttpResponse(val status: Int, val body: String)
    private fun String.toJsonOrNull(): JSONObject? = runCatching { JSONObject(this) }.getOrNull()
}
