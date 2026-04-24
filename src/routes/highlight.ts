import { Hono } from "hono";
import { HighlightRequestSchema } from "../lib/schemas.js";
import { getHighlighter, getSupportedLanguages, getSupportedThemes } from "../lib/highlighter.js";
import { badRequest, unsupportedLanguage, unsupportedTheme, internalError } from "../lib/errors.js";
import { withDebug } from "../lib/debug.js";

const app = new Hono<Env>();

/**
 * POST /highlight
 *
 * Tokenizes source code with a single color theme and returns an array of
 * lines, each containing an array of `{ text, color }` tokens.
 *
 * Request body (`HighlightRequestSchema`):
 * - `code`     {string}  Source code to highlight (max 100 KB).
 * - `language` {string}  Language identifier (default: `"text"`).
 * - `theme`    {string}  Color theme name (default: `"github-dark"`).
 * - `debug`    {boolean} Include `_debug` timing block in response (default: `false`).
 *
 * Response: `{ language, theme, tokens: Array<Array<{ text, color }>> }`
 * Sets `Server-Timing: total;dur=…, tokenizer;dur=…` on the response.
 */
app.post("/highlight", async (c) => {
  const parsed = HighlightRequestSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return badRequest(c, "Invalid request", parsed.error.message);
  }

  const { code, language, theme, debug } = parsed.data;
  const languages = getSupportedLanguages();
  const themes = getSupportedThemes();

  if (language !== "text" && !languages.includes(language)) {
    return unsupportedLanguage(c, language, languages);
  }
  if (!themes.includes(theme)) {
    return unsupportedTheme(c, theme, themes);
  }

  try {
    const highlighter = await getHighlighter();
    const t0 = performance.now();
    const result = highlighter.codeToTokensBase(code, {
      lang: language as string,
      theme: theme as string,
    });
    c.set("tokenizerMs", performance.now() - t0);
    const tokens = result.map((line) =>
      line.map((token) => ({ text: token.content, color: token.color || "" }))
    );
    return c.json(withDebug(c, { language, theme, tokens }, debug, { language, theme }));
  } catch (e) {
    console.error("Highlighting failed:", e);
    return internalError(c, "Highlighting failed");
  }
});

export default app;
