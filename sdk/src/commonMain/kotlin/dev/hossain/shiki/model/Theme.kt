package dev.hossain.shiki.model

/** Known theme identifiers accepted by the API. Use as the `theme` field in requests. */
object Theme {
    const val GITHUB_DARK = "github-dark"
    const val GITHUB_LIGHT = "github-light"
    const val ONE_DARK_PRO = "one-dark-pro"
    const val DRACULA = "dracula"
    const val MIN_LIGHT = "min-light"

    val ALL = listOf(GITHUB_DARK, GITHUB_LIGHT, ONE_DARK_PRO, DRACULA, MIN_LIGHT)
}
