import { Hono } from "hono";
import { getSupportedLanguages, getSupportedThemes } from "../lib/highlighter.js";

const app = new Hono();

app.get("/languages", (c) => {
  return c.json({
    languages: getSupportedLanguages(),
    themes: getSupportedThemes(),
  });
});

export default app;
