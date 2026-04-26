# Copilot Instructions

## Git Workflow

Always follow this order when making changes:

1. **Create a local branch** from `main` — never work directly on `main` or push directly to `origin` without a local branch first.
2. **Commit locally** on that branch.
3. **Push the local branch** to `origin` (`git push origin <branch-name>`).
4. Open a PR from the pushed branch.

```bash
git checkout main && git pull
git checkout -b feature/my-feature
# ... make changes ...
git add <files>
git commit -m "Description of changes"
git push origin feature/my-feature
# then open a PR
```

---

## Repository Overview

This repo has two independent components:

1. **API service** (`src/`) - A TypeScript/Hono syntax highlighting microservice deployed on Cloudflare Workers. Uses Shiki to tokenize code and return token arrays (with colors or semantic types) as JSON.
2. **KMP SDK** (`sdk/`) - A Kotlin Multiplatform library that wraps the API for use in JVM and Android projects. Published to JitPack under tags like `sdk-x.y.z`.
3. **Sample app** (`sample/`) - A JVM Kotlin app demonstrating SDK usage against the live server.

The live API is at `https://syntax-highlight.gohk.xyz`. API versions are tagged `api-x.y.z`, SDK versions are tagged `sdk-x.y.z`.

---

## API Service (TypeScript)

### Commands

```bash
npm run dev          # Local dev via Wrangler (Cloudflare Workers runtime)
npm run build        # tsc compile to dist/
npm run typecheck    # tsc --noEmit (type-check only)
npm run lint         # ESLint on src/
npm run lint:fix     # ESLint with auto-fix
npm run format       # Prettier --write src/
npm run format:check # Prettier check (used in CI)
```

There are no automated tests - the service is verified by manual smoke tests against the live URL.

### Architecture

Request flow: `src/index.ts` (Hono app + middleware) → route handlers in `src/routes/` → `src/lib/highlighter.ts` (Shiki singleton).

- **`src/index.ts`** - Registers all routes, applies CORS middleware, injects `requestStart`/`requestBodyBytes`/`tokenizerMs` into Hono context via middleware, emits `Server-Timing` headers.
- **`src/env.d.ts`** - Defines the `Env` type (Hono context variables). All route files use `Hono<Env>`.
- **`src/lib/highlighter.ts`** - The Shiki highlighter singleton. **Critical**: uses `@shikijs/langs-precompiled` + `createJavaScriptRawEngine()` instead of the default WASM engine - required because Cloudflare Workers blocks `WebAssembly.instantiate()`. The singleton is reset to `null` on failure so the next request retries.
- **`src/lib/schemas.ts`** - Zod schemas for all three request types. Code is capped at 100 KB. Language and theme default if omitted.
- **`src/lib/errors.ts`** - Shared error response helpers (`badRequest`, `unsupportedLanguage`, `unsupportedTheme`, `internalError`).
- **`src/lib/debug.ts`** - `withDebug()` wraps a response body with timing info when `debug: true` is in the request.
- **`src/lib/scope-mapper.ts`** - Maps TextMate scope arrays to semantic token types. Order in `SCOPE_RULES` matters; more specific prefixes must come before broader ones.

### Key Conventions

**Adding a new language** requires updates in four places:
1. `src/lib/highlighter.ts` - import from `@shikijs/langs-precompiled/<lang>`, add to `SUPPORTED_LANGS` array and `LANGUAGE_NAMES` string array.
2. `src/openapi.json` - add to the three `enum` arrays (lang in request body, lang in response, error details string) and the example array.
3. `sdk/src/commonMain/kotlin/dev/hossain/shiki/model/Language.kt` - add a constant and add it to the `ALL` list.
4. Update `README.md` and `sdk/README.md` language tables.

**Only use languages from `@shikijs/langs-precompiled`** - this package pre-transpiles Oniguruma regex to native JS RegExp at build time. Standard Shiki grammars will not work in the Cloudflare Workers environment.

**Shell scripting language** - use identifier `shellscript` (not `shell` or `sh`). The canonical name in `@shikijs/langs-precompiled` is `shellscript` with `displayName: "Shell"`.

**Type casts in route handlers** - `lang` and `theme` params are cast to `string` (e.g., `lang: language as string`) because Shiki's generic type parameter is inferred narrowly at the call site. This is correct since Zod validates before the Shiki call. Do not widen to `as any`.

---

## KMP SDK (Kotlin)

### Commands

```bash
./gradlew :sdk:build          # Build the SDK
./gradlew :sdk:publishToMavenLocal  # Publish locally (used by JitPack)
./gradlew :sample:run         # Run the sample app
```

### Architecture

- **`ShikiClient`** - Public entry point. All methods are `suspend` and return `Result<T>`. Owns an `HttpClient` unless one is passed in (caller owns externally-provided clients).
- **`ShikiApiService`** - Internal Ktor HTTP calls. Not part of the public API.
- **`model/`** - `@Serializable` data classes for requests/responses. `Language` and `Theme` are `object`s with `const val` string constants.
- **Platform engines** - Android uses `ktor-client-okhttp`, JVM uses `ktor-client-cio`. Both are `implementation` dependencies scoped to their respective source sets. `ktor-client-core` is `api` (exposed to consumers).

### Publishing

JitPack builds on new tags matching `sdk-x.y.z`. The `jitpack.yml` specifies JDK 17 and runs `./gradlew :sdk:publishToMavenLocal`. Consumers add:

```kotlin
// settings.gradle.kts
maven("https://jitpack.io")

// build.gradle.kts
implementation("com.github.hossain-khan.shiki-token-service:sdk:<tag>")
```

---

## CI

`.github/workflows/ci.yml` runs on push to `main` and all PRs:
1. `npm run typecheck`
2. `npm run lint`
3. `npm run format:check`
4. `npm run build`

Deployment to Cloudflare Workers is triggered separately (not via CI) by pushing to `main`.
