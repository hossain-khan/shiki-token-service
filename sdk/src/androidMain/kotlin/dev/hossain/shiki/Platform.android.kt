package dev.hossain.shiki

import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.HttpTimeout
import io.ktor.serialization.kotlinx.json.json

internal actual fun createDefaultHttpClient(): HttpClient = HttpClient(OkHttp) {
    install(ContentNegotiation) { json(shikiJson) }
    install(HttpTimeout) { requestTimeoutMillis = 30_000 }
}
