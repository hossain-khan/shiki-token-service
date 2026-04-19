package dev.hossain.shiki

/**
 * Thrown when the Shiki Token Service returns a non-2xx HTTP response.
 *
 * @param statusCode HTTP status code, e.g. 400 or 500.
 * @param error Human-readable error message from the API.
 * @param details Optional additional context from the API.
 */
class ShikiApiException(
    val statusCode: Int,
    val error: String,
    val details: String? = null,
) : Exception("HTTP $statusCode: $error${details?.let { " ($it)" } ?: ""}")
