# Android Native Syntax Highlighting - Assessment

Evaluating native on-device syntax highlighting for Android using [kotlin-textmate](https://github.com/ivan-magda/kotlin-textmate) as an alternative (or complement) to the Shiki Token Service.

## Why Native Highlighting?

The Shiki Token Service works well but requires network connectivity. A native library enables:
- **Offline support** - highlight code without a server
- **Lower latency** - ~12ms vs ~50-200ms (network round trip)
- **No server dependency** - no cold starts, no downtime concerns

## kotlin-textmate Overview

A pure Kotlin/JVM port of VS Code's `vscode-textmate` engine. Uses [joni](https://github.com/jruby/joni) (Java Oniguruma) for TextMate regex support.

| Attribute | Details |
|-----------|---------|
| **Repo** | [ivan-magda/kotlin-textmate](https://github.com/ivan-magda/kotlin-textmate) |
| **License** | MIT |
| **Stars** | 11 (as of April 2026) |
| **Commits** | ~120 |
| **Author** | Single developer |
| **Platforms** | JVM, Android |
| **Languages** | 600+ (any `.tmLanguage.json` grammar) |
| **Themes** | VS Code JSON themes |
| **Compose** | Built-in `CodeBlock` composable |

### Modules

- **core** - Grammar parsing, tokenization state machine, theme engine
- **compose-ui** - Jetpack Compose `CodeBlock` with `AnnotatedString` rendering
- **sample-app** - Android demo
- **benchmark** - JMH performance suite

### Usage

```kotlin
// Compose
CodeBlock(code = sourceCode, grammar = grammar, theme = theme)

// Manual tokenization
var state: StateStack? = null
for (line in code.lines()) {
    val result = grammar.tokenizeLine(line, state)
    state = result.ruleStack
    // result.tokens contains scopes + positions
}
```

## APK Size Impact

| Dependency | Size | Notes |
|-----------|------|-------|
| **joni** (Oniguruma regex) | ~225 KB | Core regex engine |
| **jcodings** (encoding tables) | ~1.7 MB | Unicode/encoding data - largest piece |
| **gson** (JSON parsing) | ~290 KB | Grammar/theme JSON parsing |
| **kotlin-textmate core** | ~50-100 KB | The library itself |
| **Grammar files** (bundled) | ~50-500 KB | Depends on language count |
| **Theme files** (bundled) | ~20-50 KB | Per theme |
| **Total (pre-shrink)** | **~2.3-2.9 MB** | |
| **Total (after R8)** | **~1.5-2 MB** | jcodings is hard to tree-shake |

### Concerns

- **jcodings** includes encoding tables for CJK, ISO-8859, etc. - mostly unused for UTF-8 workloads but bundled entirely
- **gson** - if the app already uses Moshi or kotlinx.serialization, this adds a second JSON library

## Runtime Performance

| Metric | Value |
|--------|-------|
| **Cold start** | ~100-300ms (regex compilation + grammar parsing) |
| **Kotlin tokenization** | ~79,300 lines/sec (12.6ms per 1,000 lines) |
| **JSON tokenization** | ~457,600 lines/sec (2.2ms per 1,000 lines) |
| **JavaScript tokenization** | ~10,300 lines/sec (97.1ms per 1,000 lines) |
| **Memory per grammar** | ~1-2 MB (compiled rules + regex cache) |
| **Thread safety** | Not thread-safe - one Grammar instance per thread |

## Known Limitations

- **No injection grammars** - parsed but not evaluated
- **Joni regex constraints** - backreferences in lookbehind assertions fail gracefully
- **JVM/Android only** - no iOS or KMP support
- **No incremental tokenization** - full file re-tokenization on changes
- **Not on Maven Central** - must use JitPack, git submodule, or local fork
- **No ProGuard rules provided** - may need custom rules for joni/jcodings

## Maturity Assessment

| Factor | Rating | Notes |
|--------|--------|-------|
| **Code quality** | Good | Has benchmarks, architecture docs, detekt config |
| **Test coverage** | Unknown | Tests exist but coverage not published |
| **Production usage** | None known | 11 stars, proof-of-concept maturity |
| **Maintenance** | Active | Updated April 2026, single author risk |
| **API stability** | Unstable | No versioned releases on a registry |

### How to Validate

The Shiki Token Service can serve as a **reference oracle**:
1. Tokenize sample code with both kotlin-textmate and the Shiki service
2. Compare token boundaries and scope assignments
3. Compare resolved colors using the same VS Code theme
4. Test edge cases: nested strings, multiline comments, regex literals, generics, template strings

## Comparison: Library vs Token Service

| Factor | kotlin-textmate | Shiki Token Service |
|--------|----------------|---------------------|
| **Offline** | Yes | No |
| **Latency** | ~12ms | ~50-200ms (network) |
| **APK size** | +~2 MB | +0 (HTTP client already in app) |
| **Cold start** | ~200ms one-time | ~400ms first request (Heroku cold start) |
| **Memory** | ~2 MB per grammar | None |
| **Server dependency** | None | Required |
| **Maintenance** | Grammar/library updates | Server-side, transparent |
| **Language coverage** | 600+ (any .tmLanguage) | 23 (configured in service) |
| **Theme coverage** | Any VS Code theme | 5 (configured in service) |

## Recommendation

1. **Use the token service for v1** - zero APK cost, proven (Shiki), already deployed
2. **Evaluate kotlin-textmate** by comparing its output against the token service for your target languages
3. **Adopt kotlin-textmate for v2** if offline support is needed, after validation confirms acceptable accuracy
4. **Hybrid approach** - token service as primary, kotlin-textmate as offline fallback
