package dev.hossain.shiki.model

import kotlinx.serialization.Serializable

/**
 * Request body for `POST /highlight/dual`.
 *
 * @param code Source code to tokenize. Maximum 100,000 characters.
 * @param language Language identifier. Defaults to [Language.TEXT].
 * @param darkTheme Dark color theme. Defaults to [Theme.GITHUB_DARK].
 * @param lightTheme Light color theme. Defaults to [Theme.GITHUB_LIGHT].
 * @param debug When true, the response includes a [DebugInfo] block with timing metrics.
 */
@Serializable
data class HighlightDualRequest(
    val code: String,
    val language: String = Language.TEXT,
    val darkTheme: String = Theme.GITHUB_DARK,
    val lightTheme: String = Theme.GITHUB_LIGHT,
    val debug: Boolean = false,
)
