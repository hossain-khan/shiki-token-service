[![](https://img.shields.io/badge/OpenAPI-3.1.0-green)](https://syntax-highlight.gohk.xyz/openapi.json) [![codecov](https://codecov.io/github/hossain-khan/shiki-token-service/graph/badge.svg?token=JZN1FOKJLJ)](https://codecov.io/github/hossain-khan/shiki-token-service) [![](https://jitpack.io/v/hossain-khan/shiki-token-service.svg)](https://jitpack.io/#hossain-khan/shiki-token-service)


# Shiki Token Service

A portable syntax highlighting microservice that tokenizes source code using [Shiki](https://shiki.style/) and returns colored tokens as JSON. Built with [Hono](https://hono.dev/) for deployment on Cloudflare Workers, Heroku (Node.js), or any JS runtime. Designed for rendering syntax-highlighted code in native mobile apps (Android/iOS) without client-side parsing.

> 💬 See https://hossain.dev/posts/syntax-highlighting-on-android-bringing-shiki-engine-to-compose/

## Quick Start

```bash
npm install
npm run build
PORT=3000 npm start
```

For local development with Cloudflare Workers:

```bash
npm run dev
```

To run the test suite:

```bash
npm test
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/demo` | Interactive demo page — [try it live](https://syntax-highlight.gohk.xyz/demo) |
| `GET` | `/docs` | Interactive Swagger UI API explorer |
| `GET` | `/openapi.json` | OpenAPI 3.1 specification |
| `GET` | `/health` | Health check |
| `GET` | `/languages` | List supported languages and themes |
| `POST` | `/highlight` | Tokenize code with a single theme |
| `POST` | `/highlight/dual` | Tokenize with dark + light themes |
| `POST` | `/highlight/semantic` | Tokenize with semantic token types |

## Usage

### `POST /highlight`

Tokenizes code with a single color theme.

**Request:**

```bash
curl -X POST https://your-host/highlight \
  -H "Content-Type: application/json" \
  -d '{
    "code": "fun main() {\n    println(\"Hello\")\n}",
    "language": "kotlin",
    "theme": "github-dark"
  }'
```

**Response:**

```json
{
  "language": "kotlin",
  "theme": "github-dark",
  "tokens": [
    [
      { "text": "fun", "color": "#F97583" },
      { "text": " ", "color": "#E1E4E8" },
      { "text": "main", "color": "#B392F0" },
      { "text": "() {", "color": "#E1E4E8" }
    ],
    [
      { "text": "    ", "color": "#E1E4E8" },
      { "text": "println", "color": "#B392F0" },
      { "text": "(", "color": "#E1E4E8" },
      { "text": "\"Hello\"", "color": "#9ECBFF" },
      { "text": ")", "color": "#E1E4E8" }
    ],
    [
      { "text": "}", "color": "#E1E4E8" }
    ]
  ]
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `code` | string | yes | - |
| `language` | string | no | `"text"` |
| `theme` | string | no | `"github-dark"` |
| `debug` | boolean | no | `false` |

### `POST /highlight/dual`

Tokenizes code with both dark and light themes in a single request - useful for apps that support both modes.

**Request:**

```bash
curl -X POST https://your-host/highlight/dual \
  -H "Content-Type: application/json" \
  -d '{
    "code": "val x = 42",
    "language": "kotlin"
  }'
```

**Response:**

```json
{
  "language": "kotlin",
  "darkTheme": "github-dark",
  "lightTheme": "github-light",
  "tokens": [
    [
      { "text": "val", "darkColor": "#F97583", "lightColor": "#D73A49" },
      { "text": " x ", "darkColor": "#E1E4E8", "lightColor": "#24292E" },
      { "text": "=", "darkColor": "#F97583", "lightColor": "#D73A49" },
      { "text": " ", "darkColor": "#E1E4E8", "lightColor": "#24292E" },
      { "text": "42", "darkColor": "#79B8FF", "lightColor": "#005CC5" }
    ]
  ]
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `code` | string | yes | - |
| `language` | string | no | `"text"` |
| `darkTheme` | string | no | `"github-dark"` |
| `lightTheme` | string | no | `"github-light"` |
| `debug` | boolean | no | `false` |

### `POST /highlight/semantic`

Returns token types (keyword, function, string, etc.) instead of colors - useful when the client app manages its own color palette.

**Request:**

```bash
curl -X POST https://your-host/highlight/semantic \
  -H "Content-Type: application/json" \
  -d '{
    "code": "const x = 1;",
    "language": "javascript"
  }'
```

**Response:**

```json
{
  "language": "javascript",
  "tokenTypes": ["type", "plain", "variable", "keyword", "number", "punctuation"],
  "tokens": [
    [
      { "text": "const", "type": "type" },
      { "text": " ", "type": "plain" },
      { "text": "x", "type": "variable" },
      { "text": " ", "type": "plain" },
      { "text": "=", "type": "keyword" },
      { "text": " ", "type": "plain" },
      { "text": "1", "type": "number" },
      { "text": ";", "type": "punctuation" }
    ]
  ]
}
```

### Debug Mode

All highlight endpoints accept `"debug": true` in the request body to include processing metrics. The response will contain a `_debug` object:

```json
{
  "language": "kotlin",
  "theme": "github-dark",
  "tokens": [ ... ],
  "_debug": {
    "totalMs": 1.2,
    "tokenizerMs": 0.2,
    "requestBodyBytes": 55,
    "language": "kotlin",
    "theme": "github-dark"
  }
}
```

A `Server-Timing` header is also included on every highlight response (regardless of debug flag) for use with browser DevTools or monitoring.

### `GET /languages`

Returns all supported languages and themes.

```bash
curl https://your-host/languages
```

### Error Responses

All errors return JSON with an `error` field and optional `details`:

```json
{ "error": "Unsupported language: brainfuck", "details": "Supported languages: kotlin, java, ..." }
```

| Status | Meaning |
|--------|---------|
| `400` | Bad request (invalid body, unsupported language/theme) |
| `413` | Payload too large (body over 200KB) |
| `500` | Internal server error |

## Supported Languages

`kotlin`, `java`, `python`, `javascript`, `typescript`, `swift`, `go`, `rust`, `json`, `yaml`, `bash`, `sql`, `html`, `css`, `c`, `cpp`, `ruby`, `php`, `markdown`, `xml`, `toml`, `dockerfile`, `graphql`, `csharp`, `scala`, `r`, `dart`, `powershell`, `lua`, `perl`, `shellscript`

## Supported Themes

`github-dark`, `github-light`, `one-dark-pro`, `dracula`, `min-light`, `dark-plus`, `light-plus`

## Deployment

### Heroku

```bash
heroku create your-app-name
heroku buildpacks:set heroku/nodejs
git push heroku main
```

### Cloudflare Workers

```bash
npm run deploy
```

### Standalone Node.js

Set the `PORT` environment variable and the server starts automatically:

```bash
npm run build
PORT=3000 node dist/index.js
```

## Architecture

### Why the JavaScript Regex Engine?

Shiki uses [TextMate grammars](https://macromates.com/manual/en/language_grammars) which rely on [Oniguruma](https://github.com/kkos/oniguruma), a regex engine from Ruby. Shiki's default engine compiles Oniguruma to WebAssembly, which works on Node.js but **fails on Cloudflare Workers** with `WebAssembly.instantiate(): Wasm code generation disallowed by embedder`.

This service uses Shiki's [pre-compiled JavaScript regex engine](https://shiki.style/guide/regex-engines) (`@shikijs/langs-precompiled` + `createJavaScriptRawEngine`) instead. This approach:

- **Works everywhere** - no WASM dependency, runs on Workers, Node.js, and any JS runtime
- **Fastest cold start** - grammar patterns are pre-transpiled at build time, so there's zero regex compilation at runtime
- **Tiny footprint** - ~3 KB engine vs ~456 KB WASM binary
- **Full language support** - all built-in Shiki languages are supported as of v3.9.1

The tradeoff is slightly less regex accuracy for edge-case grammars (e.g., C++ can exhibit backtracking), but for the 31 mainstream languages supported by this service, results are identical to the WASM engine.

## Kotlin / Android SDK

A Kotlin Multiplatform client library for the Shiki Token Service is available in the [`sdk/`](./sdk) subdirectory. It targets **JVM and Android** and uses only KMP-compatible libraries (`ktor-client`, `kotlinx.serialization`).

### Add via JitPack

```kotlin
// settings.gradle.kts
dependencyResolutionManagement {
    repositories {
        maven("https://jitpack.io")
    }
}

// build.gradle.kts - pick the artifact for your target:
dependencies {
    // Android projects
    implementation("com.github.hossain-khan.shiki-token-service:sdk-android:sdk-1.0.5")

    // JVM projects (non-Android)
    implementation("com.github.hossain-khan.shiki-token-service:sdk-jvm:sdk-1.0.5")

    // KMP projects (includes metadata for all targets)
    implementation("com.github.hossain-khan.shiki-token-service:sdk:sdk-1.0.5")
}
```

> Latest release: `sdk-1.0.5`. For JitPack multi-module projects the group id uses dots (`com.github.User.Repo`) and the artifact is the module name (`sdk-android`, `sdk-jvm`, or `sdk`).

### Usage

```kotlin
import dev.hossain.shiki.ShikiClient
import dev.hossain.shiki.model.HighlightRequest
import dev.hossain.shiki.model.Language
import dev.hossain.shiki.model.Theme

val client = ShikiClient(baseUrl = "https://syntax-highlight.gohk.xyz")

// Single theme
val result = client.highlight(
    HighlightRequest(
        code = "fun main() { println(\"Hello\") }",
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

// Dark + light themes in one request
val dual = client.highlightDual(
    HighlightDualRequest(code = "val x = 42", language = Language.KOTLIN)
)

// Semantic token types (keyword, function, string, …)
val semantic = client.highlightSemantic(
    HighlightSemanticRequest(code = "const x = 1;", language = Language.JAVASCRIPT)
)

client.close()
```

All `ShikiClient` methods are `suspend` functions and return `kotlin.Result<T>`, so failures (network errors, unsupported language/theme, etc.) are surfaced without exceptions.

### SDK Tech Stack

- **HTTP**: [ktor-client](https://ktor.io/docs/client-create-multiplatform-application.html) - OkHttp engine on Android, CIO on JVM
- **JSON**: [kotlinx.serialization](https://github.com/Kotlin/kotlinx.serialization)
- **Coroutines**: [kotlinx.coroutines](https://github.com/Kotlin/kotlinx.coroutines)
- **Published via**: [JitPack](https://jitpack.io)

---

## Tech Stack

- **Framework**: [Hono](https://hono.dev/) (portable across runtimes)
- **Highlighting**: [Shiki](https://shiki.style/) (TextMate grammar-based, same engine as VS Code)
- **Regex Engine**: [Pre-compiled JavaScript](https://shiki.style/guide/regex-engines) (via `@shikijs/langs-precompiled`)
- **Validation**: [Zod](https://zod.dev/)
- **Language**: TypeScript
