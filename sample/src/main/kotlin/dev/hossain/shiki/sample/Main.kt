package dev.hossain.shiki.sample

import dev.hossain.shiki.ShikiClient
import dev.hossain.shiki.model.HighlightDualRequest
import dev.hossain.shiki.model.HighlightRequest
import dev.hossain.shiki.model.HighlightSemanticRequest
import dev.hossain.shiki.model.Language
import dev.hossain.shiki.model.Theme
import kotlinx.coroutines.runBlocking

/**
 * Set SHIKI_BASE_URL environment variable to point at your deployed instance.
 * Defaults to http://localhost:3000 for local development (run `npm start` in repo root).
 */
private val BASE_URL = System.getenv("SHIKI_BASE_URL") ?: "http://localhost:3000"

fun main() = runBlocking {
    println("╔══════════════════════════════════════╗")
    println("║   Shiki Token Service — SDK Sample   ║")
    println("╚══════════════════════════════════════╝")
    println("Server: $BASE_URL\n")

    val client = ShikiClient(baseUrl = BASE_URL)

    // ── 1. Health check ──────────────────────────────────────────────────────
    println("▶ Health Check")
    client.getHealth().fold(
        onSuccess = { println("  status=${it.status}  version=${it.version}") },
        onFailure = {
            println("  ✗ Cannot reach server: $it")
            println("  Make sure the service is running at $BASE_URL")
            client.close()
            return@runBlocking
        }
    )

    // ── 2. Supported languages & themes ──────────────────────────────────────
    println("\n▶ Supported Languages & Themes")
    client.getLanguages().onSuccess { resp ->
        println("  languages: ${resp.languages.joinToString()}")
        println("  themes:    ${resp.themes.joinToString()}")
    }.onFailure { println("  ✗ $it") }

    // ── 3. Single-theme highlight ─────────────────────────────────────────────
    println("\n▶ Highlight — Kotlin / github-dark")
    val kotlinCode = """
        fun greet(name: String): String {
            return "Hello, ${'$'}name!"
        }
    """.trimIndent()

    client.highlight(
        HighlightRequest(
            code = kotlinCode,
            language = Language.KOTLIN,
            theme = Theme.GITHUB_DARK,
        )
    ).onSuccess { resp ->
        println("  language=${resp.language}  theme=${resp.theme}  lines=${resp.tokens.size}")
        resp.tokens.forEachIndexed { i, line ->
            val lineText = line.joinToString("") { it.text }
            val firstColor = line.firstOrNull()?.color ?: ""
            println("  Line ${i + 1}: \"$lineText\"  (first token color: $firstColor)")
        }
    }.onFailure { println("  ✗ $it") }

    // ── 4. Dual-theme highlight ───────────────────────────────────────────────
    println("\n▶ Dual Theme — kotlin / github-dark + github-light")
    client.highlightDual(
        HighlightDualRequest(
            code = "val answer = 42",
            language = Language.KOTLIN,
        )
    ).onSuccess { resp ->
        println("  darkTheme=${resp.darkTheme}  lightTheme=${resp.lightTheme}")
        resp.tokens.first().forEach { token ->
            println("  '${token.text}'  dark=${token.darkColor}  light=${token.lightColor}")
        }
    }.onFailure { println("  ✗ $it") }

    // ── 5. Semantic tokens ────────────────────────────────────────────────────
    println("\n▶ Semantic Tokens — JavaScript")
    client.highlightSemantic(
        HighlightSemanticRequest(
            code = "const add = (a, b) => a + b;",
            language = Language.JAVASCRIPT,
        )
    ).onSuccess { resp ->
        println("  token types used: ${resp.tokenTypes.joinToString()}")
        resp.tokens.first().forEach { token ->
            println("  '${token.text}' → ${token.type}")
        }
    }.onFailure { println("  ✗ $it") }

    client.close()
    println("\n✓ All done!")
}
