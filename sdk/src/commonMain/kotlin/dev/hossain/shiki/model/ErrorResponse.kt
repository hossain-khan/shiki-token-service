package dev.hossain.shiki.model

import kotlinx.serialization.Serializable

@Serializable
data class ErrorResponse(
    val error: String,
    val details: String? = null,
)
