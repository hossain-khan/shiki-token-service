import { Hono } from "hono";
import { HighlightSemanticRequestSchema } from "../lib/schemas.js";
import { getHighlighter, getSupportedLanguages } from "../lib/highlighter.js";
import { badRequest, unsupportedLanguage, internalError } from "../lib/errors.js";
import { mapScopeToTokenType } from "../lib/scope-mapper.js";
import { withDebug } from "../lib/debug.js";

const app = new Hono<Env>();

/**
 * POST /highlight/semantic
 *
 * Tokenizes source code and maps each token to a theme-independent semantic
 * type (e.g. `"keyword"`, `"string"`, `"function"`) derived from the TextMate
 * scope hierarchy rather than from a color theme.
 *
 * Useful for clients that want to apply their own color palette or need
 * structured token classifications rather than hex colors.
 *
 * Internally uses `github-dark` as the driver theme (Shiki requires one) but
 * discards all color values — only the scope data from `includeExplanation` is
 * used, fed through `mapScopeToTokenType()`.
 *
 * Request body (`HighlightSemanticRequestSchema`):
 * - `code`     {string}  Source code to highlight (max 100 KB).
 * - `language` {string}  Language identifier (default: `"text"`).
 * - `debug`    {boolean} Include `_debug` timing block in response (default: `false`).
 *
 * Response: `{ language, tokenTypes: string[], tokens: Array<Array<{ text, type }>> }`
 * Sets `Server-Timing: total;dur=…, tokenizer;dur=…` on the response.
 */
app.post("/highlight/semantic", async (c) => {
  const parsed = HighlightSemanticRequestSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return badRequest(c, "Invalid request", parsed.error.message);
  }

  const { code, language, debug } = parsed.data;
  const languages = getSupportedLanguages();

  if (language !== "text" && !languages.includes(language)) {
    return unsupportedLanguage(c, language, languages);
  }

  try {
    const highlighter = await getHighlighter();
    const t0 = performance.now();
    // Theme is arbitrary here — semantic types come from scope analysis, not colors.
    // includeExplanation is required to get the TextMate scope hierarchy for mapping.
    const result = highlighter.codeToTokens(code, {
      lang: language as string,
      theme: "github-dark" as string,
      includeExplanation: true,
    });
    c.set("tokenizerMs", performance.now() - t0);

    const tokenTypesSet = new Set<string>();
    const tokens = result.tokens.map((line) =>
      line.map((token) => {
        const scopes = token.explanation?.[0]?.scopes?.map((s) => s.scopeName) ?? [];
        const type = mapScopeToTokenType(scopes);
        tokenTypesSet.add(type);
        return { text: token.content, type };
      })
    );

    return c.json(
      withDebug(c, { language, tokenTypes: [...tokenTypesSet], tokens }, debug, { language })
    );
  } catch (e) {
    console.error("Highlighting failed:", e);
    return internalError(c, "Highlighting failed");
  }
});

export default app;
