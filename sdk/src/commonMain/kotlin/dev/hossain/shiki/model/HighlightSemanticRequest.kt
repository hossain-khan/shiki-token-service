package dev.hossain.shiki.model

import kotlinx.serialization.Serializable

/**
 * Request body for `POST /highlight/semantic`.
 *
 * @param code Source code to tokenize. Maximum 100,000 characters.
 * @param language Language identifier. Defaults to [Language.TEXT].
 * @param debug When true, the response includes a [DebugInfo] block with timing metrics.
 */
@Serializable
data class HighlightSemanticRequest(
    val code: String,
    val language: String = Language.TEXT,
    val debug: Boolean = false,
)
