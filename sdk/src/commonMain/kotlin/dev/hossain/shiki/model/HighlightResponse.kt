package dev.hossain.shiki.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** A single syntax token with its hex color value. */
@Serializable
data class Token(
    val text: String,
    /** Hex color code, e.g. `#F97583`. */
    val color: String,
)

/** Optional debug metrics included in the response when `debug = true` in the request. */
@Serializable
data class DebugInfo(
    val totalMs: Double,
    val tokenizerMs: Double? = null,
    val requestBodyBytes: Int,
    val language: String? = null,
    val theme: String? = null,
    val darkTheme: String? = null,
    val lightTheme: String? = null,
)

/** Response from `POST /highlight`. */
@Serializable
data class HighlightResponse(
    val language: String,
    val theme: String,
    /** Lines of tokens. Each inner list is one line of source code. */
    val tokens: List<List<Token>>,
    @SerialName("_debug") val debug: DebugInfo? = null,
)
