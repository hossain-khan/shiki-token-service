package dev.hossain.shiki.model

import kotlinx.serialization.Serializable

@Serializable
data class LanguagesResponse(
    val languages: List<String>,
    val themes: List<String>,
)
