package dev.hossain.shiki

import dev.hossain.shiki.model.HealthResponse
import dev.hossain.shiki.model.HighlightDualRequest
import dev.hossain.shiki.model.HighlightDualResponse
import dev.hossain.shiki.model.HighlightRequest
import dev.hossain.shiki.model.HighlightResponse
import dev.hossain.shiki.model.HighlightSemanticRequest
import dev.hossain.shiki.model.HighlightSemanticResponse
import dev.hossain.shiki.model.LanguagesResponse
import io.ktor.client.HttpClient

/**
 * Client for the [Shiki Token Service](https://github.com/hossain-khan/shiki-token-service) API.
 *
 * All functions are `suspend` and return [Result], so failures (network errors, API errors)
 * are surfaced as a [Result.failure] containing a [ShikiApiException] or [Exception].
 *
 * ### Basic usage
 * ```kotlin
 * val client = ShikiClient("https://syntax-highlight.gohk.xyz")
 *
 * val result = client.highlight(
 *     HighlightRequest(code = "fun main() {}", language = Language.KOTLIN)
 * )
 * result.onSuccess { response ->
 *     response.tokens.forEach { line -> println(line) }
 * }
 * result.onFailure { error -> println("Failed: $error") }
 *
 * client.close()
 * ```
 *
 * ### Providing a custom HttpClient
 * ```kotlin
 * val myClient = HttpClient(OkHttp) { /* custom config */ }
 * val client = ShikiClient("https://syntax-highlight.gohk.xyz", httpClient = myClient)
 * // ShikiClient will NOT close myClient on close() - you own it.
 * ```
 *
 * @param baseUrl Base URL of the deployed Shiki Token Service,
 *   e.g. `https://syntax-highlight.gohk.xyz` (the public instance).
 * @param httpClient Optional custom [HttpClient]. Must have [ContentNegotiation] and
 *   [HttpTimeout] configured. If null, a default client is created and owned by this instance.
 */
class ShikiClient(
    baseUrl: String,
    httpClient: HttpClient? = null,
) {
    private val ownedClient = httpClient == null
    private val client: HttpClient = httpClient ?: createDefaultHttpClient()
    private val api = ShikiApiService(client, baseUrl.trimEnd('/'))

    /** Tokenizes [request] with a single color theme. */
    suspend fun highlight(request: HighlightRequest): Result<HighlightResponse> =
        runCatching { api.highlight(request) }

    /** Tokenizes [request] with both dark and light themes in one call. */
    suspend fun highlightDual(request: HighlightDualRequest): Result<HighlightDualResponse> =
        runCatching { api.highlightDual(request) }

    /** Tokenizes [request] and returns semantic token types instead of colors. */
    suspend fun highlightSemantic(request: HighlightSemanticRequest): Result<HighlightSemanticResponse> =
        runCatching { api.highlightSemantic(request) }

    /** Returns the supported languages and themes. */
    suspend fun getLanguages(): Result<LanguagesResponse> =
        runCatching { api.getLanguages() }

    /** Returns the service health status. */
    suspend fun getHealth(): Result<HealthResponse> =
        runCatching { api.getHealth() }

    /**
     * Closes the underlying [HttpClient] if it was created by this instance.
     * Has no effect if a custom [HttpClient] was provided at construction time.
     */
    fun close() {
        if (ownedClient) client.close()
    }
}
