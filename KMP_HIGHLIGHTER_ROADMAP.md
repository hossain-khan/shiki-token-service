# KMP TextMate Syntax Highlighter — Roadmap

A Kotlin Multiplatform library that provides VS Code-quality syntax highlighting using TextMate grammars, targeting Android, iOS, and Desktop (JVM).

## Key Discovery

**[kotlin-textmate](https://github.com/ivan-magda/kotlin-textmate)** already exists as a JVM-only TextMate grammar engine using joni. It provides a working tokenizer, theme resolver, and Compose integration — but only for JVM/Android. The KMP effort is primarily about making this architecture multiplatform.

---

## Milestone 1: Regex Engine Abstraction Layer
**Effort: 2-3 weeks**

| Task | Description | Effort |
|------|-------------|--------|
| Define `expect` API | `RegexEngine` interface in `commonMain` with `compile()`, `search()`, `findAll()`, named capture support | 2-3 days |
| JVM/Android `actual` (joni) | Wrap `org.jruby.joni.Regex` / `Matcher` / `Region` | 3-4 days |
| iOS `actual` (Oniguruma cinterop) | Create `.def` file, build static `liboniguruma.a` for iOS, write Kotlin/Native wrapper | 5-7 days |
| Test suite | Cross-platform regex tests covering TextMate patterns (begin/end, captures, lookahead, backreferences) | 3-4 days |

**Dependencies:** joni (Maven Central: `org.jruby.joni:joni:2.2.7`), Oniguruma C library (v6.9.10)

**Risks:**
- Joni and Oniguruma C may have subtle behavioral differences — need extensive cross-platform regex tests
- Kotlin/Native cinterop memory management (manual `memScoped` blocks)

---

## Milestone 2: TextMate Grammar Engine (Common)
**Effort: 4-6 weeks**

| Task | Description | Effort |
|------|-------------|--------|
| Port grammar parser | Parse `.tmLanguage.json` into `IRawGrammar` data classes (patterns, repository, captures, begin/end rules) | 1 week |
| Port tokenization state machine | `Grammar.tokenizeLine()` with scope stack, rule matching, begin/end handling — reference vscode-textmate (~1500 lines TS) and kotlin-textmate | 2-3 weeks |
| `StateStack` implementation | Immutable functional data structure carrying rule context across lines | 3-4 days |
| Grammar includes/injection | Support `include: "#rule"`, `include: "source.other"`, and grammar injection | 3-4 days |
| Performance tuning | Regex caching, compiled rule memoization, target ~10,000+ lines/sec | 3-4 days |

**Dependencies:** Milestone 1 (regex engine)

**Key reference:** [vscode-textmate](https://github.com/microsoft/vscode-textmate) (grammar.ts, rule.ts, matcher.ts — the canonical implementation)

---

## Milestone 3: Theme Engine (Common)
**Effort: 1-2 weeks**

| Task | Description | Effort |
|------|-------------|--------|
| Theme JSON parser | Parse VS Code theme files (`tokenColors` array with scope selectors and settings) | 2-3 days |
| Scope-to-style resolver | Trie-based matching: given a scope stack, find the most specific theme rule. Returns foreground color, background color, font style (bold/italic/underline) | 3-4 days |
| Bundle default themes | Package github-dark, github-light, one-dark-pro, dracula as resources | 1-2 days |

**Dependencies:** None (can run in parallel with Milestone 2)

---

## Milestone 4: Grammar Bundling & Resource Loading
**Effort: 1-2 weeks**

| Task | Description | Effort |
|------|-------------|--------|
| Grammar registry | Central registry that lazy-loads grammars by scope name | 2-3 days |
| Bundle core grammars | Package top ~20 language grammars as KMP resources (kotlin, swift, java, python, typescript, go, rust, etc.) | 2-3 days |
| KMP resource loading | `expect`/`actual` for loading bundled JSON from Android assets, iOS bundles, JVM classpath | 2-3 days |

**Dependencies:** Milestones 2 & 3

---

## Milestone 5: Compose Multiplatform UI Integration
**Effort: 2-3 weeks**

| Task | Description | Effort |
|------|-------------|--------|
| Token-to-AnnotatedString mapper | Convert tokenized output to Compose `AnnotatedString` with `SpanStyle(color, fontWeight, fontStyle)` | 3-4 days |
| `CodeBlock` composable | Reusable composable: takes code string + language + theme, renders highlighted code | 3-4 days |
| Line numbers | Optional line number gutter | 1-2 days |
| Dual theme support | Accept dark + light themes, switch based on `isSystemInDarkTheme()` | 2-3 days |
| Performance: incremental tokenization | Only re-tokenize changed lines on edit (for editor use cases) | 3-4 days |

**Dependencies:** Milestones 2, 3, 4

---

## Milestone 6: Testing, Docs & Release
**Effort: 2-3 weeks**

| Task | Description | Effort |
|------|-------------|--------|
| Cross-platform test suite | Tokenization output parity tests across Android, iOS, Desktop for all bundled languages | 1 week |
| Comparison tests vs Shiki | Verify token output matches Shiki for sample files (use the token service API as reference!) | 3-4 days |
| API documentation | KDoc for all public APIs, usage examples | 2-3 days |
| Sample app | Compose Multiplatform demo app (Android + iOS + Desktop) | 3-4 days |
| Maven Central publish | Configure publishing, signing, release to Maven Central | 2-3 days |

---

## Timeline Summary

| Milestone | Effort | Can Parallelize With |
|-----------|--------|---------------------|
| 1. Regex Engine Abstraction | 2-3 weeks | — |
| 2. Grammar Engine | 4-6 weeks | Milestone 3 |
| 3. Theme Engine | 1-2 weeks | Milestone 2 |
| 4. Grammar Bundling | 1-2 weeks | — |
| 5. Compose UI Integration | 2-3 weeks | — |
| 6. Testing, Docs & Release | 2-3 weeks | — |

**Total estimate: 12-19 weeks** (3-5 months) for a single developer

**Critical path:** Milestone 1 → Milestone 2 → Milestone 4 → Milestone 5

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Joni vs Oniguruma behavioral differences | High — tokens differ across platforms | Extensive regex test suite; document known divergences |
| Oniguruma C library iOS build issues | Medium — blocks iOS target | Pre-build `.xcframework` via CocoaPods; fallback to ICU regex with reduced grammar support |
| kotlin-textmate is JVM-only, hard to extract | Medium — more porting work | Fork and refactor incrementally; keep JVM working while extracting common |
| Performance on iOS (cinterop overhead) | Medium — slower than JVM | Profile early; batch regex calls; consider regex result caching |
| TextMate grammar edge cases | Low — most grammars work, some don't | Prioritize top 20 languages; document unsupported constructs |

---

## Decision: Build vs Use Token Service

| Factor | KMP Native Library | Token Service (current) |
|--------|-------------------|------------------------|
| Offline support | Yes | No |
| Latency | <15ms per file | 50-200ms (network) |
| Effort to build | 3-5 months | Done |
| Maintenance burden | Ongoing (grammar updates, platform bugs) | Low (server-side) |
| Mobile battery/memory | Higher (regex engine in-process) | Lower (just render tokens) |
| KMP coverage | Android + iOS + Desktop | Any HTTP client |

**Recommendation:** Use the token service for v1 of your app. Build the KMP library as a long-term investment for offline/low-latency use cases.
