# Shiki Token Service - Implementation Plan

A portable syntax highlighting microservice that tokenizes source code using [Shiki](https://shiki.style/) and returns colored tokens as JSON. Built with [Hono](https://hono.dev/) for deployment on Cloudflare Workers, Heroku (Node.js), or any JS runtime.

## Goal

Provide a REST API that accepts source code and returns tokenized spans with colors, suitable for rendering syntax-highlighted code in native mobile apps (Android/iOS) without client-side parsing.

## Tech Stack

- **Runtime**: Cloudflare Workers (primary), Node.js (secondary)
- **Framework**: Hono (portable across runtimes)
- **Highlighting**: Shiki (TextMate grammar-based, same engine as VS Code)
- **Language**: TypeScript
- **Validation**: Zod (request validation)
- **API Spec**: OpenAPI 3.1 (via hand-written YAML)
- **Package Manager**: npm

## Project Structure

```
shiki-token-service/
  src/
    index.ts              # Hono app entry point, route registration
    routes/
      highlight.ts        # POST /highlight - single theme tokenization
      highlight-dual.ts   # POST /highlight/dual - dark + light tokens
      highlight-semantic.ts # POST /highlight/semantic - token type-based
      health.ts           # GET /health
      languages.ts        # GET /languages - list supported languages
    lib/
      highlighter.ts      # Shiki highlighter singleton/initialization
      scope-mapper.ts     # TextMate scope to semantic token type mapping
      schemas.ts          # Zod request/response schemas
      errors.ts           # Error response helpers
  openapi.yaml            # OpenAPI 3.1 specification
  wrangler.toml           # Cloudflare Workers config
  tsconfig.json
  package.json
  README.md
```

## Step 1: Project Initialization

Create the project directory and initialize:

```bash
mkdir shiki-token-service && cd shiki-token-service
npm init -y
```

Install dependencies:

```bash
npm install hono shiki zod
npm install -D typescript wrangler @cloudflare/workers-types @types/node
```

### package.json

Set `"type": "module"` and add these scripts:

```json
{
  "type": "module",
  "scripts": {
    "dev": "wrangler dev src/index.ts",
    "deploy": "wrangler deploy",
    "start": "node dist/index.js",
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  },
  "engines": {
    "node": "20.x"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src"]
}
```

### wrangler.toml

```toml
name = "shiki-token-service"
main = "src/index.ts"
compatibility_date = "2024-12-01"
```

## Step 2: Shiki Highlighter Singleton

File: `src/lib/highlighter.ts`

- Use `createHighlighterCore` with lazy-loaded grammars from `shiki/langs` and `shiki/themes` for tree-shaking in Workers.
- Support these languages at launch: `kotlin`, `java`, `python`, `javascript`, `typescript`, `swift`, `go`, `rust`, `json`, `yaml`, `bash`, `sql`, `html`, `css`, `c`, `cpp`, `ruby`, `php`, `markdown`, `xml`, `toml`, `dockerfile`, `graphql`.
- Support these themes: `github-dark`, `github-light`, `one-dark-pro`, `dracula`, `min-light`.
- Export a `getHighlighter()` async function that initializes once (lazy singleton via promise caching).
- Export a `getSupportedLanguages()` function that returns the list of loaded language IDs.
- Export a `getSupportedThemes()` function that returns the list of loaded theme IDs.

## Step 3: Zod Schemas

File: `src/lib/schemas.ts`

### HighlightRequest

```typescript
{
  code: string,       // required, max 100_000 chars
  language: string,   // optional, defaults to "text"
  theme: string,      // optional, defaults to "github-dark"
}
```

### HighlightDualRequest

```typescript
{
  code: string,       // required, max 100_000 chars
  language: string,   // optional, defaults to "text"
  darkTheme: string,  // optional, defaults to "github-dark"
  lightTheme: string, // optional, defaults to "github-light"
}
```

### HighlightSemanticRequest

```typescript
{
  code: string,       // required, max 100_000 chars
  language: string,   // optional, defaults to "text"
}
```

### Token (response types)

```typescript
// Single theme token
{ text: string, color: string }

// Dual theme token
{ text: string, darkColor: string, lightColor: string }

// Semantic token
{ text: string, type: string }
```

### HighlightResponse

```typescript
{
  language: string,
  theme: string,
  tokens: Array<Array<{ text: string, color: string }>>
}
```

### HighlightDualResponse

```typescript
{
  language: string,
  darkTheme: string,
  lightTheme: string,
  tokens: Array<Array<{ text: string, darkColor: string, lightColor: string }>>
}
```

### HighlightSemanticResponse

```typescript
{
  language: string,
  tokenTypes: string[],  // list of all token types used (for client reference)
  tokens: Array<Array<{ text: string, type: string }>>
}
```

### ErrorResponse

```typescript
{
  error: string,
  details?: string
}
```

## Step 4: Scope Mapper

File: `src/lib/scope-mapper.ts`

Map TextMate scopes (from Shiki's explanation data) to simple semantic token types. Export a `mapScopeToTokenType(scopes)` function.

Mapping rules (check in order, match on `startsWith`):

| TextMate Scope Prefix | Token Type |
|----------------------|------------|
| `keyword` | `keyword` |
| `storage.type` | `type` |
| `storage.modifier` | `modifier` |
| `entity.name.function` | `function` |
| `entity.name.type` | `type` |
| `entity.name.tag` | `tag` |
| `entity.other.attribute-name` | `attribute` |
| `variable.parameter` | `parameter` |
| `variable` | `variable` |
| `constant.numeric` | `number` |
| `constant.language` | `constant` |
| `constant` | `constant` |
| `string` | `string` |
| `comment` | `comment` |
| `punctuation` | `punctuation` |
| `meta.import` | `keyword` |
| `support.function` | `function` |
| `support.type` | `type` |
| (default) | `plain` |

## Step 5: Error Helpers

File: `src/lib/errors.ts`

- `badRequest(c, message, details?)` - returns 400 JSON error
- `unsupportedLanguage(c, language, supported[])` - returns 400 with list of supported languages
- `unsupportedTheme(c, theme, supported[])` - returns 400 with list of supported themes
- `internalError(c, message)` - returns 500 JSON error

## Step 6: Route Implementations

### GET /health

File: `src/routes/health.ts`

Returns `{ status: "ok", version: "1.0.0" }` with 200.

### GET /languages

File: `src/routes/languages.ts`

Returns `{ languages: string[], themes: string[] }` from the highlighter singleton.

### POST /highlight

File: `src/routes/highlight.ts`

1. Parse and validate request body with Zod schema.
2. Check if `language` is supported; return 400 if not.
3. Check if `theme` is supported; return 400 if not.
4. Call `highlighter.codeToTokensBase(code, { lang, theme })`.
5. Map result to `Array<Array<{ text, color }>>`.
6. Return `{ language, theme, tokens }`.

### POST /highlight/dual

File: `src/routes/highlight-dual.ts`

1. Parse and validate request body.
2. Validate both themes are supported.
3. Call `codeToTokensBase` twice (dark and light themes).
4. Merge token arrays: for each line and token index, combine into `{ text, darkColor, lightColor }`.
5. Return `{ language, darkTheme, lightTheme, tokens }`.

### POST /highlight/semantic

File: `src/routes/highlight-semantic.ts`

1. Parse and validate request body.
2. Call `codeToTokensBase` with `includeExplanation: true` (NOTE: check if the Shiki API supports this; if not, use `codeToTokens` with the appropriate option to get scope information).
3. For each token, use `mapScopeToTokenType()` to determine the semantic type.
4. Collect unique token types used into a `tokenTypes` set.
5. Return `{ language, tokenTypes, tokens }`.

## Step 7: App Entry Point

File: `src/index.ts`

1. Create Hono app.
2. Add CORS middleware (allow all origins for now).
3. Add request size limit: reject bodies over 200KB with 413.
4. Register all routes:
   - `GET /health`
   - `GET /languages`
   - `POST /highlight`
   - `POST /highlight/dual`
   - `POST /highlight/semantic`
5. Add global error handler that catches exceptions and returns 500 JSON.
6. Export `default` for Cloudflare Workers: `export default app`

## Step 8: OpenAPI Specification

File: `openapi.yaml`

Write a complete OpenAPI 3.1 spec covering:

- Info: title "Shiki Token Service", version "1.0.0", description of the service
- Servers: `http://localhost:3000` (dev), placeholder for production
- All 5 endpoints with full request/response schemas
- Components/schemas for all Zod types (HighlightRequest, Token, etc.)
- Error responses (400, 413, 500)
- Examples for each endpoint showing Kotlin code tokenization

## Step 9: README

File: `README.md`

Include:
- One-paragraph description
- Quick start (local dev with `npm run dev`)
- API overview table (method, path, description)
- Example curl for each endpoint with sample response
- Deployment section:
  - Cloudflare Workers: `npm run deploy`
  - Heroku: Procfile with `web: node dist/index.js`, `npm run build` as build step
  - Node.js: explain adding `import { serve } from '@hono/node-server'` for standalone Node (add as optional dependency)
- Supported languages and themes lists
- Link to OpenAPI spec

## Step 10: Heroku Compatibility

Add a `Procfile` at root:

```
web: node dist/index.js
```

For Node.js standalone mode, add a conditional in `src/index.ts`:

```typescript
// Cloudflare Workers uses the default export
export default app;

// For Node.js, start the server if running directly
if (typeof process !== "undefined" && process.env.PORT) {
  const { serve } = await import("@hono/node-server");
  serve({ fetch: app.fetch, port: parseInt(process.env.PORT) });
}
```

Add `@hono/node-server` as an optional dependency:

```bash
npm install @hono/node-server
```

## Constraints and Guidelines

- Do NOT add authentication. This is a stateless utility service.
- Do NOT add a database or persistent storage.
- Do NOT add caching in v1. Keep it simple. (Can add Cloudflare KV or Redis later.)
- Keep all code in TypeScript with strict mode.
- Use `async/await` throughout. No callbacks.
- Every route handler should be in its own file for clarity.
- Use descriptive HTTP status codes: 200 success, 400 bad request, 413 payload too large, 500 internal error.
- The service must work with `wrangler dev` for local development (Cloudflare Workers-compatible).
- Shiki's WASM-based engine works in Cloudflare Workers natively.
- Total code should be small - aim for under 500 lines across all files.
