package dev.hossain.shiki

import dev.hossain.shiki.model.ErrorResponse
import dev.hossain.shiki.model.HealthResponse
import dev.hossain.shiki.model.HighlightDualRequest
import dev.hossain.shiki.model.HighlightDualResponse
import dev.hossain.shiki.model.HighlightRequest
import dev.hossain.shiki.model.HighlightResponse
import dev.hossain.shiki.model.HighlightSemanticRequest
import dev.hossain.shiki.model.HighlightSemanticResponse
import dev.hossain.shiki.model.LanguagesResponse
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.http.isSuccess

internal class ShikiApiService(
    private val client: HttpClient,
    private val baseUrl: String,
) {
    suspend fun getHealth(): HealthResponse =
        client.get("$baseUrl/health").bodyOrThrow()

    suspend fun getLanguages(): LanguagesResponse =
        client.get("$baseUrl/languages").bodyOrThrow()

    suspend fun highlight(request: HighlightRequest): HighlightResponse =
        client.post("$baseUrl/highlight") {
            contentType(ContentType.Application.Json)
            setBody(request)
        }.bodyOrThrow()

    suspend fun highlightDual(request: HighlightDualRequest): HighlightDualResponse =
        client.post("$baseUrl/highlight/dual") {
            contentType(ContentType.Application.Json)
            setBody(request)
        }.bodyOrThrow()

    suspend fun highlightSemantic(request: HighlightSemanticRequest): HighlightSemanticResponse =
        client.post("$baseUrl/highlight/semantic") {
            contentType(ContentType.Application.Json)
            setBody(request)
        }.bodyOrThrow()

    private suspend inline fun <reified T> HttpResponse.bodyOrThrow(): T {
        if (status.isSuccess()) return body()
        val errorBody = runCatching { body<ErrorResponse>() }.getOrNull()
        throw ShikiApiException(
            statusCode = status.value,
            error = errorBody?.error ?: status.description,
            details = errorBody?.details,
        )
    }
}
