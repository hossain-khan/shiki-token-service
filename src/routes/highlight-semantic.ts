import { Hono } from "hono";
import { HighlightSemanticRequestSchema } from "../lib/schemas.js";
import { getHighlighter, getSupportedLanguages } from "../lib/highlighter.js";
import { badRequest, unsupportedLanguage, internalError } from "../lib/errors.js";
import { mapScopeToTokenType } from "../lib/scope-mapper.js";

const app = new Hono();

app.post("/highlight/semantic", async (c) => {
  const parsed = HighlightSemanticRequestSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return badRequest(c, "Invalid request", parsed.error.message);
  }

  const { code, language } = parsed.data;
  const languages = getSupportedLanguages();

  if (language !== "text" && !languages.includes(language)) {
    return unsupportedLanguage(c, language, languages);
  }

  try {
    const highlighter = await getHighlighter();
    const result = highlighter.codeToTokens(code, {
      lang: language as any,
      theme: "github-dark" as any,
      includeExplanation: true,
    });

    const tokenTypesSet = new Set<string>();
    const tokens = result.tokens.map((line) =>
      line.map((token) => {
        const scopes = token.explanation?.[0]?.scopes?.map((s) => s.scopeName) ?? [];
        const type = mapScopeToTokenType(scopes);
        tokenTypesSet.add(type);
        return { text: token.content, type };
      })
    );

    return c.json({
      language,
      tokenTypes: [...tokenTypesSet],
      tokens,
    });
  } catch (e) {
    return internalError(c, "Highlighting failed");
  }
});

export default app;
