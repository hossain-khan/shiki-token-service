# Shiki Token Service — SDK Sample

A Kotlin JVM application that demonstrates all five endpoints of the
[Shiki Token Service](../README.md) using the KMP SDK published via JitPack.

## What it does

`Main.kt` exercises each endpoint in sequence and prints the results to stdout:

| Step | Endpoint | What is shown |
|------|----------|---------------|
| 1 | `GET /health` | Service status and version |
| 2 | `GET /languages` | Supported language and theme lists |
| 3 | `POST /highlight` | Per-line token list with colors (Kotlin / `github-dark`) |
| 4 | `POST /highlight/dual` | Tokens with both dark and light theme colors |
| 5 | `POST /highlight/semantic` | Tokens with semantic type annotations (JavaScript) |

If the server is unreachable the app prints a clear error and exits cleanly after step 1.

## Prerequisites

- JDK 17+
- The Shiki Token Service running locally **or** a deployed URL

## Running the sample

### 1. Start the Shiki Token Service

From the repository root:

```bash
npm install      # first time only
npm start        # starts on http://localhost:3000
```

### 2. Run the sample

```bash
# From the repository root — uses localhost:3000 by default
./gradlew :sample:run

# Point at a deployed instance
SHIKI_BASE_URL=https://your-deployed-url.example.com ./gradlew :sample:run
```

### Expected output

```
╔══════════════════════════════════════╗
║   Shiki Token Service — SDK Sample   ║
╚══════════════════════════════════════╝
Server: http://localhost:3000

▶ Health Check
  status=ok  version=1.0.0

▶ Supported Languages & Themes
  languages: kotlin, javascript, typescript, ...
  themes:    github-dark, github-light, ...

▶ Highlight — Kotlin / github-dark
  language=kotlin  theme=github-dark  lines=3
  Line 1: "fun greet(name: String): String {"  (first token color: #ff7b72)
  ...

▶ Dual Theme — kotlin / github-dark + github-light
  darkTheme=github-dark  lightTheme=github-light
  'val' dark=#ff7b72  light=#cf222e
  ...

▶ Semantic Tokens — JavaScript
  token types used: keyword, variable, parameter, ...
  'const' → keyword
  ...

✓ All done!
```

## SDK dependency

The sample pulls the SDK from JitPack:

```kotlin
// sample/build.gradle.kts
dependencies {
    implementation("com.github.hossain-khan.shiki-token-service:sdk-jvm:sdk-1.0.5")
}
```

See the [root README](../README.md) for full SDK integration instructions and Android usage.
