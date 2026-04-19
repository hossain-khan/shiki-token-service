package dev.hossain.shiki.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** A single syntax token with a semantic [TokenType] label instead of a color. */
@Serializable
data class SemanticToken(
    val text: String,
    val type: TokenType,
)

/** Response from `POST /highlight/semantic`. */
@Serializable
data class HighlightSemanticResponse(
    val language: String,
    /** Deduplicated list of all [TokenType] values present in [tokens]. */
    val tokenTypes: List<String>,
    /** Lines of tokens. Each inner list is one line of source code. */
    val tokens: List<List<SemanticToken>>,
    @SerialName("_debug") val debug: DebugInfo? = null,
)
