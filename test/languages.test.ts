import { describe, it, expect } from "vitest";
import app from "../src/index.js";

describe("GET /languages", () => {
  it("returns 200 with languages and themes arrays", async () => {
    const res = await app.request("/languages");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.languages)).toBe(true);
    expect(Array.isArray(body.themes)).toBe(true);
  });

  it("includes expected languages", async () => {
    const res = await app.request("/languages");
    const body = await res.json();
    for (const lang of ["kotlin", "java", "javascript", "typescript", "python", "shellscript"]) {
      expect(body.languages).toContain(lang);
    }
  });

  it("includes all supported themes including dark-plus and light-plus", async () => {
    const res = await app.request("/languages");
    const body = await res.json();
    for (const theme of [
      "github-dark",
      "github-light",
      "one-dark-pro",
      "dracula",
      "min-light",
      "dark-plus",
      "light-plus",
    ]) {
      expect(body.themes).toContain(theme);
    }
  });
});
