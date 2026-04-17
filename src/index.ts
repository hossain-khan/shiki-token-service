import { Hono } from "hono";
import { cors } from "hono/cors";
import health from "./routes/health.js";
import languages from "./routes/languages.js";
import highlight from "./routes/highlight.js";
import highlightDual from "./routes/highlight-dual.js";
import highlightSemantic from "./routes/highlight-semantic.js";

const app = new Hono();

app.use("*", cors());

app.use("*", async (c, next) => {
  const contentLength = parseInt(c.req.header("content-length") || "0", 10);
  if (contentLength > 200 * 1024) {
    return c.json({ error: "Payload too large", details: "Maximum body size is 200KB" }, 413);
  }
  await next();
});

app.route("/", health);
app.route("/", languages);
app.route("/", highlight);
app.route("/", highlightDual);
app.route("/", highlightSemantic);

app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

export default app;

if (typeof process !== "undefined" && process.env.PORT) {
  const { serve } = await import("@hono/node-server");
  serve({ fetch: app.fetch, port: parseInt(process.env.PORT) }, (info) => {
    console.log(`Server running on port ${info.port}`);
  });
}
