import { Hono } from "hono";

const app = new Hono();

/**
 * GET /health
 *
 * Lightweight liveness probe. Returns `{ status: "ok", version: "1.2.0" }`.
 * Used by uptime monitors and load-balancer health checks.
 */
app.get("/health", (c) => {
  return c.json({ status: "ok", version: "1.2.0" });
});

export default app;
