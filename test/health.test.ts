import { describe, it, expect } from "vitest";
import app from "../src/index.js";

describe("GET /health", () => {
  it("returns 200 with status ok and current version", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok", version: "1.2.0" });
  });

  it("includes Server-Timing header", async () => {
    const res = await app.request("/health");
    expect(res.headers.get("Server-Timing")).toMatch(/total;dur=/);
  });
});
