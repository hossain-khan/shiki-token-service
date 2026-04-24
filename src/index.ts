import { Hono } from "hono";
import { cors } from "hono/cors";
import health from "./routes/health.js";
import languages from "./routes/languages.js";
import highlight from "./routes/highlight.js";
import highlightDual from "./routes/highlight-dual.js";
import highlightSemantic from "./routes/highlight-semantic.js";
import docs from "./routes/docs.js";
import demo from "./routes/demo.js";

const app = new Hono<Env>();

app.use("*", cors());

app.use("*", async (c, next) => {
  const contentLength = parseInt(c.req.header("content-length") || "0", 10);
  if (contentLength > 200 * 1024) {
    return c.json({ error: "Payload too large", details: "Maximum body size is 200KB" }, 413);
  }
  c.set("requestStart", performance.now());
  c.set("requestBodyBytes", contentLength);
  await next();
  const totalMs = performance.now() - (c.get("requestStart") as number);
  const tokenizerMs = (c.get("tokenizerMs") as number | undefined) ?? undefined;
  const serverTiming =
    tokenizerMs !== undefined
      ? `total;dur=${totalMs.toFixed(1)}, tokenizer;dur=${tokenizerMs.toFixed(1)}`
      : `total;dur=${totalMs.toFixed(1)}`;
  c.header("Server-Timing", serverTiming);
});

app.route("/", health);
app.route("/", languages);
app.route("/", highlight);
app.route("/", highlightDual);
app.route("/", highlightSemantic);
app.route("/", docs);
app.route("/", demo);

app.get("/", (c) => c.redirect("/docs"));

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
