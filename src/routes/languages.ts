import { Hono } from "hono";
import { getSupportedLanguages, getSupportedThemes } from "../lib/highlighter.js";

const app = new Hono();

/**
 * GET /languages
 *
 * Returns the lists of supported language identifiers and theme names that the
 * service accepts on the highlight endpoints. Clients should call this once at
 * startup to populate language/theme selectors rather than hard-coding values.
 *
 * Response shape: `{ languages: string[], themes: string[] }`
 */
app.get("/languages", (c) => {
  return c.json({
    languages: getSupportedLanguages(),
    themes: getSupportedThemes(),
  });
});

export default app;
