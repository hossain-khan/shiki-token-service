package dev.hossain.shiki.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** A single syntax token carrying both dark and light hex color values. */
@Serializable
data class DualToken(
    val text: String,
    /** Hex color from the dark theme, e.g. `#F97583`. */
    val darkColor: String,
    /** Hex color from the light theme, e.g. `#D73A49`. */
    val lightColor: String,
)

/** Response from `POST /highlight/dual`. */
@Serializable
data class HighlightDualResponse(
    val language: String,
    val darkTheme: String,
    val lightTheme: String,
    /** Lines of tokens. Each inner list is one line of source code. */
    val tokens: List<List<DualToken>>,
    @SerialName("_debug") val debug: DebugInfo? = null,
)
