import { Hono } from "hono";
import { HighlightRequestSchema } from "../lib/schemas.js";
import { getHighlighter, getSupportedLanguages, getSupportedThemes } from "../lib/highlighter.js";
import { badRequest, unsupportedLanguage, unsupportedTheme, internalError } from "../lib/errors.js";

const app = new Hono();

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
    const result = highlighter.codeToTokensBase(code, { lang: language as any, theme: theme as any });
    const tokens = result.map((line) =>
      line.map((token) => ({ text: token.content, color: token.color || "" }))
    );
    return c.json({ language, theme, tokens });
  } catch (e) {
    return internalError(c, "Highlighting failed");
  }
});

export default app;
