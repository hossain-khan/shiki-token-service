import { Hono } from "hono";
import { HighlightDualRequestSchema } from "../lib/schemas.js";
import { getHighlighter, getSupportedLanguages, getSupportedThemes } from "../lib/highlighter.js";
import { badRequest, unsupportedLanguage, unsupportedTheme, internalError } from "../lib/errors.js";
import { withDebug } from "../lib/debug.js";

const app = new Hono<Env>();

app.post("/highlight/dual", async (c) => {
  const parsed = HighlightDualRequestSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return badRequest(c, "Invalid request", parsed.error.message);
  }

  const { code, language, darkTheme, lightTheme } = parsed.data;
  const languages = getSupportedLanguages();
  const themes = getSupportedThemes();

  if (language !== "text" && !languages.includes(language)) {
    return unsupportedLanguage(c, language, languages);
  }
  if (!themes.includes(darkTheme)) {
    return unsupportedTheme(c, darkTheme, themes);
  }
  if (!themes.includes(lightTheme)) {
    return unsupportedTheme(c, lightTheme, themes);
  }

  try {
    const highlighter = await getHighlighter();
    const t0 = performance.now();
    const darkTokens = highlighter.codeToTokensBase(code, { lang: language as any, theme: darkTheme as any });
    const lightTokens = highlighter.codeToTokensBase(code, { lang: language as any, theme: lightTheme as any });
    c.set("tokenizerMs", performance.now() - t0);

    const tokens = darkTokens.map((line, i) =>
      line.map((token, j) => ({
        text: token.content,
        darkColor: token.color || "",
        lightColor: lightTokens[i]?.[j]?.color || "",
      }))
    );

    return c.json(withDebug(c, { language, darkTheme, lightTheme, tokens }, { language, darkTheme, lightTheme }));
  } catch (e) {
    return internalError(c, "Highlighting failed");
  }
});

export default app;
