# Shiki Token Service - Kotlin SDK

A Kotlin Multiplatform (KMP) client library for the
[Shiki Token Service](../README.md) API. Targets **Android** and **JVM**, using only
KMP-compatible libraries so the same source works on both platforms.

## Installation

Add the JitPack repository and pick the artifact for your target:

```kotlin
// settings.gradle.kts
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        maven("https://jitpack.io")
    }
}
```

```kotlin
// build.gradle.kts
dependencies {
    // Android projects
    implementation("com.github.hossain-khan.shiki-token-service:sdk-android:sdk-1.0.5")

    // JVM projects (non-Android)
    implementation("com.github.hossain-khan.shiki-token-service:sdk-jvm:sdk-1.0.5")

    // KMP projects (metadata + all targets)
    implementation("com.github.hossain-khan.shiki-token-service:sdk:sdk-1.0.5")
}
```

> **Latest release:** `sdk-1.0.5`  
> Group id uses dots for multi-module JitPack projects: `com.github.hossain-khan.shiki-token-service`

## Quick Start

```kotlin
import dev.hossain.shiki.ShikiClient
import dev.hossain.shiki.model.HighlightRequest
import dev.hossain.shiki.model.Language
import dev.hossain.shiki.model.Theme

val client = ShikiClient(baseUrl = "https://syntax-highlight.gohk.xyz")

val result = client.highlight(
    HighlightRequest(
        code = "fun greet(name: String) = \"Hello, $name!\"",
        language = Language.KOTLIN,
        theme = Theme.GITHUB_DARK,
    )
)

result.onSuccess { response ->
    response.tokens.forEach { line ->
        line.forEach { token -> print(token.text) }
        println()
    }
}
result.onFailure { error -> println("Error: $error") }

client.close()
```

All `ShikiClient` methods are `suspend` functions and return `kotlin.Result<T>` -
failures (network errors, unsupported language/theme) surface as `Result.failure`
without throwing exceptions.

## API

### `ShikiClient`

| Method | Returns | Description |
|--------|---------|-------------|
| `highlight(request)` | `Result<HighlightResponse>` | Tokenize with a single color theme |
| `highlightDual(request)` | `Result<HighlightDualResponse>` | Tokenize with dark + light themes in one call |
| `highlightSemantic(request)` | `Result<HighlightSemanticResponse>` | Tokenize with semantic type labels instead of colors |
| `getLanguages()` | `Result<LanguagesResponse>` | List supported languages and themes |
| `getHealth()` | `Result<HealthResponse>` | Service health check |
| `close()` | `Unit` | Close the underlying HTTP client (no-op if you supplied your own) |

### Request models

#### `HighlightRequest`
| Field | Type | Required | Default |
|-------|------|----------|---------|
| `code` | `String` | ✅ | - |
| `language` | `String` | ➖ | `"text"` |
| `theme` | `String` | ➖ | `"github-dark"` |
| `debug` | `Boolean` | ➖ | `false` |

#### `HighlightDualRequest`
| Field | Type | Required | Default |
|-------|------|----------|---------|
| `code` | `String` | ✅ | - |
| `language` | `String` | ➖ | `"text"` |
| `darkTheme` | `String` | ➖ | `"github-dark"` |
| `lightTheme` | `String` | ➖ | `"github-light"` |
| `debug` | `Boolean` | ➖ | `false` |

#### `HighlightSemanticRequest`
| Field | Type | Required | Default |
|-------|------|----------|---------|
| `code` | `String` | ✅ | - |
| `language` | `String` | ➖ | `"text"` |
| `debug` | `Boolean` | ➖ | `false` |

### Constants

Use `Language` and `Theme` objects to avoid typos:

```kotlin
Language.KOTLIN      // "kotlin"
Language.JAVASCRIPT  // "javascript"
Language.PYTHON      // "python"
Language.CSHARP      // "csharp"
Language.SCALA       // "scala"
Language.DART        // "dart"
// … see Language.ALL for the full list (31 languages)

Theme.GITHUB_DARK    // "github-dark"
Theme.GITHUB_LIGHT   // "github-light"
Theme.ONE_DARK_PRO   // "one-dark-pro"
Theme.DRACULA        // "dracula"
Theme.MIN_LIGHT      // "min-light"
```

### Error handling

Non-2xx responses throw `ShikiApiException`, which `ShikiClient` wraps in `Result.failure`:

```kotlin
result.onFailure { error ->
    when (error) {
        is ShikiApiException -> println("API error ${error.statusCode}: ${error.error}")
        else -> println("Network error: $error")
    }
}
```

### Custom `HttpClient`

Supply your own configured `HttpClient` (must include `ContentNegotiation` and `HttpTimeout`):

```kotlin
val myClient = HttpClient(OkHttp) {
    install(HttpTimeout) { requestTimeoutMillis = 10_000 }
    install(ContentNegotiation) { json() }
}
val client = ShikiClient("https://syntax-highlight.gohk.xyz", httpClient = myClient)
// ShikiClient will NOT close myClient - you own its lifecycle.
```

## Tech Stack

| Concern | Library |
|---------|---------|
| HTTP | [ktor-client](https://ktor.io/docs/client-create-multiplatform-application.html) - OkHttp on Android, CIO on JVM |
| JSON | [kotlinx.serialization](https://github.com/Kotlin/kotlinx.serialization) |
| Coroutines | [kotlinx.coroutines](https://github.com/Kotlin/kotlinx.coroutines) |
| Publishing | [JitPack](https://jitpack.io/#hossain-khan/shiki-token-service) |

## Source layout

```
sdk/
├── src/
│   ├── commonMain/kotlin/dev/hossain/shiki/
│   │   ├── ShikiClient.kt          # Public entry point
│   │   ├── ShikiApiService.kt      # Ktor HTTP calls
│   │   ├── ShikiApiException.kt    # Non-2xx error type
│   │   └── model/                  # Request / response data classes
│   │       ├── Language.kt         # Language constants
│   │       ├── Theme.kt            # Theme constants
│   │       ├── HighlightRequest.kt / HighlightResponse.kt
│   │       ├── HighlightDualRequest.kt / HighlightDualResponse.kt
│   │       ├── HighlightSemanticRequest.kt / HighlightSemanticResponse.kt
│   │       ├── LanguagesResponse.kt
│   │       └── HealthResponse.kt
│   ├── androidMain/                # OkHttp engine wiring
│   └── jvmMain/                    # CIO engine wiring
└── build.gradle.kts
```

## See also

- [Root README](../README.md) - API documentation and service deployment
- [sample/](../sample/) - Runnable JVM app demonstrating all SDK endpoints
