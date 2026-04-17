import { Hono } from "hono";
import { HighlightRequestSchema } from "../lib/schemas.js";
import { getHighlighter, getSupportedLanguages, getSupportedThemes } from "../lib/highlighter.js";
import { badRequest, unsupportedLanguage, unsupportedTheme, internalError } from "../lib/errors.js";
import { withDebug } from "../lib/debug.js";

const app = new Hono<Env>();

app.post("/highlight", async (c) => {
  const parsed = HighlightRequestSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return badRequest(c, "Invalid request", parsed.error.message);
  }

  const { code, language, theme } = parsed.data;
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
    const result = highlighter.codeToTokensBase(code, { lang: language as any, theme: theme as any });
    c.set("tokenizerMs", performance.now() - t0);
    const tokens = result.map((line) =>
      line.map((token) => ({ text: token.content, color: token.color || "" }))
    );
    return c.json(withDebug(c, { language, theme, tokens }, { language, theme }));
  } catch (e) {
    return internalError(c, "Highlighting failed");
  }
});

export default app;
