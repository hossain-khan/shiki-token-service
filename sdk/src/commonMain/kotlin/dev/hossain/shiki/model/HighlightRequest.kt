package dev.hossain.shiki.model

import kotlinx.serialization.Serializable

/**
 * Request body for `POST /highlight`.
 *
 * @param code Source code to tokenize. Maximum 100,000 characters.
 * @param language Language identifier. Defaults to [Language.TEXT] (no highlighting).
 * @param theme Color theme. Defaults to [Theme.GITHUB_DARK].
 * @param debug When true, the response includes a [DebugInfo] block with timing metrics.
 */
@Serializable
data class HighlightRequest(
    val code: String,
    val language: String = Language.TEXT,
    val theme: String = Theme.GITHUB_DARK,
    val debug: Boolean = false,
)
