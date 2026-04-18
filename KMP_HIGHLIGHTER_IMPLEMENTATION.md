# KMP TextMate Syntax Highlighter — Detailed Implementation Plan

## Project Overview

Build a Kotlin Multiplatform library (`kmp-textmate`) that tokenizes source code using TextMate grammars and VS Code themes. Targets: Android (JVM/ART), iOS (Kotlin/Native), Desktop (JVM).

**Key reference:** [kotlin-textmate](https://github.com/ivan-magda/kotlin-textmate) — an existing JVM-only implementation using joni. Our work extracts the common logic and adds iOS support via Oniguruma cinterop.

---

## Project Structure

```
kmp-textmate/
├── build.gradle.kts                          # Root build config
├── settings.gradle.kts
│
├── textmate-core/                            # Core library (KMP)
│   ├── build.gradle.kts
│   └── src/
│       ├── commonMain/kotlin/com/example/textmate/
│       │   ├── grammar/
│       │   │   ├── Grammar.kt               # Main tokenizer class
│       │   │   ├── GrammarRepository.kt      # Grammar registry & lazy loading
│       │   │   ├── RawGrammar.kt             # Data classes for .tmLanguage.json
│       │   │   ├── RuleResolver.kt           # Pattern matching & rule application
│       │   │   ├── StateStack.kt             # Immutable tokenizer state
│       │   │   └── ScopeName.kt              # Scope name value class
│       │   ├── theme/
│       │   │   ├── Theme.kt                  # Theme loader & scope matcher
│       │   │   ├── ThemeTrie.kt              # Trie for scope-to-style resolution
│       │   │   ├── RawTheme.kt               # Data classes for theme JSON
│       │   │   └── StyleAttributes.kt        # Foreground, background, fontStyle
│       │   ├── regex/
│       │   │   └── OnigRegex.kt              # expect class declaration
│       │   ├── tokenizer/
│       │   │   ├── Tokenizer.kt              # Line-by-line tokenization orchestrator
│       │   │   ├── TokenizeResult.kt         # Result: tokens + new state
│       │   │   └── Token.kt                  # Token data class (scopes, range)
│       │   └── Highlighter.kt                # High-level API: code → colored tokens
│       │
│       ├── commonTest/kotlin/
│       │   ├── grammar/GrammarTest.kt
│       │   ├── regex/OnigRegexTest.kt
│       │   ├── theme/ThemeTest.kt
│       │   └── tokenizer/TokenizerTest.kt
│       │
│       ├── androidMain/kotlin/com/example/textmate/regex/
│       │   └── OnigRegex.android.kt          # actual: joni wrapper
│       │
│       ├── iosMain/
│       │   ├── kotlin/com/example/textmate/regex/
│       │   │   └── OnigRegex.ios.kt          # actual: Oniguruma cinterop
│       │   └── interop/
│       │       └── oniguruma.def             # cinterop definition file
│       │
│       ├── jvmMain/kotlin/com/example/textmate/regex/
│       │   └── OnigRegex.jvm.kt              # actual: joni wrapper (same as Android)
│       │
│       └── resources/
│           ├── grammars/                     # Bundled .tmLanguage.json files
│           │   ├── kotlin.tmLanguage.json
│           │   ├── swift.tmLanguage.json
│           │   ├── typescript.tmLanguage.json
│           │   └── ...
│           └── themes/                       # Bundled VS Code themes
│               ├── github-dark.json
│               ├── github-light.json
│               └── ...
│
├── textmate-compose/                         # Compose Multiplatform UI (KMP)
│   ├── build.gradle.kts
│   └── src/
│       └── commonMain/kotlin/com/example/textmate/compose/
│           ├── CodeBlock.kt                  # @Composable code display
│           ├── TokenToAnnotatedString.kt     # Token → AnnotatedString mapper
│           └── CodeBlockDefaults.kt          # Default styles, line numbers
│
└── sample/                                   # Demo app
    ├── composeApp/                           # Compose Multiplatform app
    ├── androidApp/
    └── iosApp/
```

---

## Step 1: Gradle & KMP Setup

### `settings.gradle.kts`
```kotlin
rootProject.name = "kmp-textmate"
include(":textmate-core")
include(":textmate-compose")
include(":sample:composeApp")
```

### `textmate-core/build.gradle.kts`
```kotlin
plugins {
    kotlin("multiplatform")
    kotlin("plugin.serialization")
    id("com.android.library")
}

kotlin {
    androidTarget()
    jvm("desktop")

    listOf(iosX64(), iosArm64(), iosSimulatorArm64()).forEach {
        it.compilations.getByName("main") {
            cinterops {
                create("oniguruma") {
                    defFile = file("src/iosMain/interop/oniguruma.def")
                    packageName = "org.oniguruma"
                    // Headers from pre-built Oniguruma
                    includeDirs("$rootDir/libs/oniguruma/include")
                }
            }
        }
        it.binaries.framework {
            baseName = "TextMateCore"
            linkerOpts("-L$rootDir/libs/oniguruma/lib", "-loniguruma")
        }
    }

    sourceSets {
        commonMain.dependencies {
            implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
        }
        val androidMain by getting {
            dependencies {
                implementation("org.jruby.joni:joni:2.2.7")
            }
        }
        val desktopMain by getting {
            dependencies {
                implementation("org.jruby.joni:joni:2.2.7")
            }
        }
        commonTest.dependencies {
            implementation(kotlin("test"))
        }
    }
}
```

### Building Oniguruma for iOS

Create a build script `scripts/build-oniguruma-ios.sh`:
```bash
#!/bin/bash
# Download Oniguruma source
curl -L https://github.com/kkos/oniguruma/releases/download/v6.9.10/onig-6.9.10.tar.gz | tar xz

# Build for iOS arm64
cd onig-6.9.10
./configure --host=aarch64-apple-ios \
  CC="xcrun -sdk iphoneos clang" \
  CFLAGS="-arch arm64 -isysroot $(xcrun --sdk iphoneos --show-sdk-path) -mios-version-min=15.0" \
  --prefix=$PWD/../libs/oniguruma \
  --disable-shared --enable-static
make && make install

# Build for iOS simulator (arm64 + x86_64)
# ... repeat with -sdk iphonesimulator
# Combine with lipo for fat binary
```

---

## Step 2: Regex Engine — `expect`/`actual`

### Common API (`commonMain`)

```kotlin
// regex/OnigRegex.kt
package com.example.textmate.regex

data class MatchResult(
    val index: Int,                         // Start of overall match
    val captureIndices: List<CaptureIndex>, // Capture groups (index 0 = full match)
)

data class CaptureIndex(
    val start: Int,
    val end: Int,
    val length: Int,
)

expect class OnigRegex(pattern: String) {
    fun search(text: String, startPosition: Int): MatchResult?
    fun hasMatch(text: String): Boolean
}

expect class OnigScanner(patterns: List<String>) {
    fun findNextMatch(text: String, startPosition: Int): ScannerMatch?
}

data class ScannerMatch(
    val index: Int,             // Which pattern matched (index into patterns list)
    val captureIndices: List<CaptureIndex>,
)
```

### JVM/Android `actual` (joni)

```kotlin
// androidMain (and desktopMain) — regex/OnigRegex.android.kt
package com.example.textmate.regex

import org.jruby.joni.Regex as JoniRegex
import org.jruby.joni.Option
import org.jruby.joni.Encoding
import org.jruby.joni.Syntax

actual class OnigRegex actual constructor(pattern: String) {
    private val regex: JoniRegex

    init {
        val patternBytes = pattern.toByteArray(Charsets.UTF_8)
        regex = JoniRegex(
            patternBytes, 0, patternBytes.size,
            Option.CAPTURE_GROUP,
            Encoding.UTF8,
            Syntax.DEFAULT
        )
    }

    actual fun search(text: String, startPosition: Int): MatchResult? {
        val textBytes = text.toByteArray(Charsets.UTF_8)
        val matcher = regex.matcher(textBytes)
        val byteStart = text.substring(0, startPosition).toByteArray(Charsets.UTF_8).size
        val result = matcher.search(byteStart, textBytes.size, Option.NONE)
        if (result == -1) return null

        val region = matcher.eagerRegion
        val captures = (0 until region.numRegs).map { i ->
            CaptureIndex(
                start = byteOffsetToCharOffset(text, textBytes, region.getBeg(i)),
                end = byteOffsetToCharOffset(text, textBytes, region.getEnd(i)),
                length = region.getEnd(i) - region.getBeg(i),
            )
        }
        return MatchResult(
            index = captures[0].start,
            captureIndices = captures,
        )
    }

    actual fun hasMatch(text: String): Boolean = search(text, 0) != null

    private fun byteOffsetToCharOffset(text: String, bytes: ByteArray, byteOffset: Int): Int {
        if (byteOffset < 0) return -1
        return String(bytes, 0, byteOffset, Charsets.UTF_8).length
    }
}

actual class OnigScanner actual constructor(private val patterns: List<String>) {
    private val regexes = patterns.map { OnigRegex(it) }

    actual fun findNextMatch(text: String, startPosition: Int): ScannerMatch? {
        var bestMatch: MatchResult? = null
        var bestIndex = -1

        for ((i, regex) in regexes.withIndex()) {
            val match = regex.search(text, startPosition) ?: continue
            if (bestMatch == null || match.index < bestMatch.index) {
                bestMatch = match
                bestIndex = i
            }
        }

        if (bestMatch == null) return null
        return ScannerMatch(index = bestIndex, captureIndices = bestMatch.captureIndices)
    }
}
```

### iOS `actual` (Oniguruma cinterop)

```kotlin
// iosMain — regex/OnigRegex.ios.kt
package com.example.textmate.regex

import kotlinx.cinterop.*
import org.oniguruma.*

actual class OnigRegex actual constructor(pattern: String) {
    private val compiledRegex: CPointer<regex_t>

    init {
        compiledRegex = memScoped {
            val regPtr = alloc<CPointerVar<regex_t>>()
            val errorInfo = alloc<OnigErrorInfo>()
            val patternBytes = pattern.encodeToByteArray()

            patternBytes.usePinned { pinned ->
                val patternPtr = pinned.addressOf(0)
                val result = onig_new(
                    regPtr.ptr,
                    patternPtr.reinterpret(),
                    (patternPtr + patternBytes.size).reinterpret(),
                    ONIG_OPTION_CAPTURE_GROUP,
                    OnigEncodingUTF8.ptr,
                    OnigSyntaxDefault.ptr,
                    errorInfo.ptr
                )
                if (result != ONIG_NORMAL) {
                    error("Failed to compile regex: $pattern (error: $result)")
                }
            }
            regPtr.value!!
        }
    }

    actual fun search(text: String, startPosition: Int): MatchResult? {
        val textBytes = text.encodeToByteArray()
        return memScoped {
            val region = onig_region_new() ?: return null
            try {
                val byteStart = text.substring(0, startPosition)
                    .encodeToByteArray().size

                textBytes.usePinned { pinned ->
                    val start = pinned.addressOf(0)
                    val end = start + textBytes.size
                    val result = onig_search(
                        compiledRegex,
                        start.reinterpret(),
                        end.reinterpret(),
                        (start + byteStart).reinterpret(),
                        end.reinterpret(),
                        region,
                        ONIG_OPTION_NONE
                    )
                    if (result < 0) return null

                    val captures = (0 until region.pointed.num_regs).map { i ->
                        CaptureIndex(
                            start = byteOffsetToCharOffset(textBytes, region.pointed.beg!![i]),
                            end = byteOffsetToCharOffset(textBytes, region.pointed.end!![i]),
                            length = region.pointed.end!![i] - region.pointed.beg!![i],
                        )
                    }
                    MatchResult(index = captures[0].start, captureIndices = captures)
                }
            } finally {
                onig_region_free(region, 1)
            }
        }
    }

    actual fun hasMatch(text: String): Boolean = search(text, 0) != null

    private fun byteOffsetToCharOffset(bytes: ByteArray, byteOffset: Int): Int {
        if (byteOffset < 0) return -1
        return bytes.decodeToString(0, byteOffset).length
    }

    // Release native regex on GC
    @Suppress("unused")
    private val cleaner = CoroutineScope(Dispatchers.Default).launch {
        // Note: consider calling onig_free(compiledRegex) via leak-safe ref tracking
    }
}
```

---

## Step 3: TextMate Grammar Data Model

### Raw Grammar (JSON parsing)

```kotlin
// grammar/RawGrammar.kt
@Serializable
data class RawGrammar(
    val scopeName: String,
    val name: String? = null,
    val fileTypes: List<String> = emptyList(),
    val patterns: List<RawRule> = emptyList(),
    val repository: Map<String, RawRule> = emptyMap(),
    val injections: Map<String, RawRule>? = null,
)

@Serializable
data class RawRule(
    val match: String? = null,
    val begin: String? = null,
    val end: String? = null,
    val name: String? = null,
    val contentName: String? = null,
    val patterns: List<RawRule>? = null,
    val captures: Map<String, RawCapture>? = null,
    val beginCaptures: Map<String, RawCapture>? = null,
    val endCaptures: Map<String, RawCapture>? = null,
    val include: String? = null,
    val repository: Map<String, RawRule>? = null,
)

@Serializable
data class RawCapture(
    val name: String? = null,
    val patterns: List<RawRule>? = null,
)
```

---

## Step 4: Grammar Tokenization State Machine

This is the core ~1500 lines, ported from vscode-textmate's `grammar.ts` + `rule.ts`.

### Key Classes

```kotlin
// grammar/StateStack.kt
class StateStack private constructor(
    val parent: StateStack?,
    val ruleId: Int,
    val scopeName: ScopeName,
    val beginRuleCapturedEOL: Boolean,
    val endRule: String?,
) {
    companion object {
        val INITIAL = StateStack(null, 0, ScopeName(""), false, null)
    }

    fun push(ruleId: Int, scopeName: ScopeName, endRule: String?): StateStack {
        return StateStack(this, ruleId, scopeName, false, endRule)
    }

    fun pop(): StateStack = parent ?: error("Cannot pop root state")

    val depth: Int get() = if (parent == null) 1 else parent.depth + 1

    fun scopeStack(): List<ScopeName> {
        val scopes = mutableListOf<ScopeName>()
        var current: StateStack? = this
        while (current != null) {
            scopes.add(0, current.scopeName)
            current = current.parent
        }
        return scopes
    }
}

// tokenizer/Token.kt
data class Token(
    val startIndex: Int,
    val endIndex: Int,
    val scopes: List<String>,
)

data class TokenizeResult(
    val tokens: List<Token>,
    val ruleStack: StateStack,
    val stoppedEarly: Boolean = false,
)
```

### Tokenizer Core Logic

```kotlin
// tokenizer/Tokenizer.kt
class Tokenizer(
    private val grammar: CompiledGrammar,
    private val scanner: OnigScanner,
) {
    fun tokenizeLine(
        line: String,
        previousState: StateStack?,
        timeLimit: Duration = 1.seconds,
    ): TokenizeResult {
        val state = previousState ?: StateStack.INITIAL
        val tokens = mutableListOf<Token>()
        var currentState = state
        var linePos = 0

        while (linePos < line.length) {
            // 1. Collect all applicable rules from current state
            val rules = grammar.getRulesForState(currentState)

            // 2. Use OnigScanner to find first matching rule
            val patterns = rules.map { it.pattern }
            val scanResult = scanner.findNextMatch(line, linePos) ?: break

            val matchedRule = rules[scanResult.index]
            val matchStart = scanResult.captureIndices[0].start
            val matchEnd = scanResult.captureIndices[0].end

            // 3. Emit token for text before the match
            if (matchStart > linePos) {
                tokens.add(Token(linePos, matchStart, currentState.scopeStack().map { it.value }))
            }

            // 4. Process the matched rule
            when {
                matchedRule.isBeginRule() -> {
                    // Push new scope, apply beginCaptures
                    currentState = currentState.push(
                        matchedRule.id,
                        ScopeName(matchedRule.name ?: ""),
                        matchedRule.resolveEndPattern(scanResult)
                    )
                    emitCaptureTokens(tokens, matchedRule.beginCaptures, scanResult, currentState)
                }
                matchedRule.isEndRule(currentState) -> {
                    // Pop scope, apply endCaptures
                    emitCaptureTokens(tokens, matchedRule.endCaptures, scanResult, currentState)
                    currentState = currentState.pop()
                }
                matchedRule.isMatchRule() -> {
                    // Simple match — emit token with scope
                    val scopes = currentState.scopeStack().map { it.value } +
                        (matchedRule.name ?: "")
                    tokens.add(Token(matchStart, matchEnd, scopes))
                    emitCaptureTokens(tokens, matchedRule.captures, scanResult, currentState)
                }
            }

            linePos = matchEnd
        }

        // 5. Emit remaining text as token
        if (linePos < line.length) {
            tokens.add(Token(linePos, line.length, currentState.scopeStack().map { it.value }))
        }

        return TokenizeResult(tokens, currentState)
    }
}
```

---

## Step 5: Theme Engine

### Theme Data Model

```kotlin
// theme/RawTheme.kt
@Serializable
data class RawTheme(
    val name: String? = null,
    val type: String? = null,                    // "dark" or "light"
    val colors: Map<String, String> = emptyMap(),
    val tokenColors: List<TokenColorRule> = emptyList(),
)

@Serializable
data class TokenColorRule(
    val scope: ScopeSelector? = null,   // String or List<String>
    val settings: TokenColorSettings,
)

@Serializable
data class TokenColorSettings(
    val foreground: String? = null,     // e.g. "#F97583"
    val background: String? = null,
    val fontStyle: String? = null,      // "bold", "italic", "bold italic", ""
)

// theme/StyleAttributes.kt
data class StyleAttributes(
    val foreground: Long,               // 0xAARRGGBB
    val background: Long,
    val isBold: Boolean,
    val isItalic: Boolean,
    val isUnderline: Boolean,
    val isStrikethrough: Boolean,
) {
    companion object {
        val DEFAULT = StyleAttributes(0xFFFFFFFF, 0x00000000, false, false, false, false)

        fun parseFontStyle(fontStyle: String?): FontStyleFlags {
            if (fontStyle == null) return FontStyleFlags()
            return FontStyleFlags(
                bold = "bold" in fontStyle,
                italic = "italic" in fontStyle,
                underline = "underline" in fontStyle,
                strikethrough = "strikethrough" in fontStyle,
            )
        }
    }
}
```

### Theme Trie (Scope-to-Color Resolution)

```kotlin
// theme/ThemeTrie.kt
class ThemeTrie {
    private val root = TrieNode()

    fun insert(scopeSelector: String, style: StyleAttributes) {
        // "keyword.control" → trie path: keyword → control
        val segments = scopeSelector.split(".")
        var node = root
        for (segment in segments) {
            node = node.children.getOrPut(segment) { TrieNode() }
        }
        node.style = style
    }

    fun match(scopes: List<String>): StyleAttributes {
        // For scope stack ["source.kotlin", "keyword.control.break"],
        // try matching most specific scope first (right to left),
        // and deepest trie match within each scope
        var result = StyleAttributes.DEFAULT
        for (scope in scopes) {
            val segments = scope.split(".")
            var node = root
            for (segment in segments) {
                node = node.children[segment] ?: break
                if (node.style != null) {
                    result = node.style!!  // Deepest match wins
                }
            }
        }
        return result
    }

    private class TrieNode {
        val children = mutableMapOf<String, TrieNode>()
        var style: StyleAttributes? = null
    }
}
```

---

## Step 6: High-Level API

```kotlin
// Highlighter.kt — the main public API
class Highlighter private constructor(
    private val grammarRepository: GrammarRepository,
    private val theme: Theme,
) {
    data class ColoredToken(
        val text: String,
        val foreground: Long,       // 0xAARRGGBB
        val isBold: Boolean,
        val isItalic: Boolean,
    )

    fun tokenize(code: String, language: String): List<List<ColoredToken>> {
        val grammar = grammarRepository.grammarForScope("source.$language")
            ?: error("Unsupported language: $language")

        val lines = code.lines()
        val result = mutableListOf<List<ColoredToken>>()
        var state: StateStack? = null

        for (line in lines) {
            val lineResult = grammar.tokenizeLine(line, state)
            state = lineResult.ruleStack
            result.add(lineResult.tokens.map { token ->
                val style = theme.match(token.scopes)
                ColoredToken(
                    text = line.substring(token.startIndex, token.endIndex),
                    foreground = style.foreground,
                    isBold = style.isBold,
                    isItalic = style.isItalic,
                )
            })
        }
        return result
    }

    companion object {
        suspend fun create(
            languages: List<String> = DEFAULT_LANGUAGES,
            theme: String = "github-dark",
        ): Highlighter {
            val grammarRepo = GrammarRepository.load(languages)
            val themeData = Theme.load(theme)
            return Highlighter(grammarRepo, themeData)
        }

        val DEFAULT_LANGUAGES = listOf(
            "kotlin", "swift", "java", "python", "typescript", "javascript",
            "go", "rust", "json", "yaml", "bash", "sql", "html", "css",
        )
    }
}
```

---

## Step 7: Compose UI Integration

```kotlin
// compose/CodeBlock.kt
@Composable
fun CodeBlock(
    code: String,
    language: String,
    modifier: Modifier = Modifier,
    highlighter: Highlighter,
    showLineNumbers: Boolean = false,
    style: CodeBlockStyle = CodeBlockDefaults.style(),
) {
    val coloredTokens = remember(code, language) {
        highlighter.tokenize(code, language)
    }

    val annotatedString = remember(coloredTokens) {
        buildAnnotatedString(coloredTokens)
    }

    SelectionContainer {
        Row(modifier = modifier.horizontalScroll(rememberScrollState())) {
            if (showLineNumbers) {
                LineNumberGutter(
                    lineCount = coloredTokens.size,
                    style = style.lineNumberStyle,
                )
            }
            BasicText(
                text = annotatedString,
                style = style.textStyle,
                modifier = Modifier.padding(style.contentPadding),
            )
        }
    }
}

// compose/TokenToAnnotatedString.kt
internal fun buildAnnotatedString(
    tokenizedLines: List<List<Highlighter.ColoredToken>>
): AnnotatedString = buildAnnotatedString {
    for ((lineIndex, line) in tokenizedLines.withIndex()) {
        if (lineIndex > 0) append('\n')
        for (token in line) {
            withStyle(SpanStyle(
                color = Color(token.foreground),
                fontWeight = if (token.isBold) FontWeight.Bold else FontWeight.Normal,
                fontStyle = if (token.isItalic) FontStyle.Italic else FontStyle.Normal,
            )) {
                append(token.text)
            }
        }
    }
}
```

### Usage in App

```kotlin
@Composable
fun CodeScreen() {
    val highlighter = remember { /* create in ViewModel/init */ }

    CodeBlock(
        code = """
            fun main() {
                println("Hello, World!")
            }
        """.trimIndent(),
        language = "kotlin",
        highlighter = highlighter,
        showLineNumbers = true,
    )
}
```

---

## Step 8: Testing Strategy

### Cross-Platform Regex Tests (`commonTest`)

```kotlin
class OnigRegexTest {
    @Test
    fun testSimpleMatch() {
        val regex = OnigRegex("\\b(fun|val|var)\\b")
        val result = regex.search("fun main()", 0)
        assertEquals(0, result?.index)
        assertEquals("fun", "fun main()".substring(result!!.captureIndices[0].start, result.captureIndices[0].end))
    }

    @Test
    fun testNamedCaptures() { /* ... */ }

    @Test
    fun testLookahead() { /* ... */ }

    @Test
    fun testBeginEndPattern() { /* ... */ }

    @Test
    fun testUnicodeSupport() { /* ... */ }
}
```

### Tokenization Parity Tests

Use the token service API as a reference oracle:

```kotlin
class TokenizationParityTest {
    @Test
    fun testKotlinTokensMatchShiki() {
        val code = "fun main() { println(\"Hello\") }"
        val localTokens = highlighter.tokenize(code, "kotlin")

        // Compare against known Shiki output (snapshot from token service)
        val expectedColors = listOf("#F97583", "#E1E4E8", "#B392F0", ...)
        val actualColors = localTokens[0].map { "#${it.foreground.toHexString().takeLast(6).uppercase()}" }
        assertEquals(expectedColors, actualColors)
    }
}
```

---

## Step 9: Build Order & Verification

| Step | What to build | How to verify |
|------|--------------|---------------|
| 1 | Gradle KMP project setup | `./gradlew build` compiles all targets |
| 2 | `OnigRegex` expect/actual (JVM first) | `OnigRegexTest` passes on JVM |
| 3 | `OnigRegex` iOS actual | Same tests pass on iOS simulator |
| 4 | `RawGrammar` JSON parsing | Parse `kotlin.tmLanguage.json` → verify structure |
| 5 | `StateStack` + `Tokenizer` | Tokenize "val x = 1" → verify scope stack contains `keyword`, `variable` |
| 6 | `Theme` + `ThemeTrie` | Match scopes against github-dark → verify hex colors |
| 7 | `Highlighter` (full pipeline) | Tokenize Kotlin code → compare output to Shiki token service |
| 8 | `CodeBlock` composable | Render in sample app, visual comparison |
| 9 | iOS actual + cinterop | Run full test suite on iOS simulator |
| 10 | Publish to Maven Central | Consume from a separate project |

---

## Dependencies Summary

| Dependency | Platform | Version | Purpose |
|-----------|----------|---------|---------|
| `org.jruby.joni:joni` | JVM, Android | 2.2.7 | Oniguruma regex engine |
| Oniguruma C library | iOS (cinterop) | 6.9.10 | Native regex engine |
| `kotlinx-serialization-json` | Common | 1.7.3 | Parse grammar & theme JSON |
| Compose Multiplatform | Common | Latest | UI rendering |
| Kotlin Multiplatform | Common | 2.1.x | Build system |

---

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Tokenization speed | >10,000 lines/sec | Benchmark with 1000-line Kotlin file |
| First tokenization | <500ms | Cold start including grammar load |
| Memory per grammar | <2MB | Profile with Android Studio |
| Library size (AAR) | <3MB | Including joni + grammars + themes |
| Compose render | <16ms per frame | No jank during scroll |
