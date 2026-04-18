// Shiki highlighter setup using the pre-compiled JavaScript regex engine.
//
// Shiki's default engine compiles Oniguruma (a Ruby regex library) to WASM.
// Cloudflare Workers blocks WebAssembly.instantiate(), so we use the JS engine
// with pre-compiled grammars (@shikijs/langs-precompiled) instead. Pre-compiled
// grammars have their Oniguruma patterns already transpiled to native JS RegExp
// at build time, eliminating both WASM loading and runtime regex transpilation.
//
// See: https://shiki.style/guide/regex-engines

import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRawEngine } from "shiki/engine/javascript";

import kotlin from "@shikijs/langs-precompiled/kotlin";
import java from "@shikijs/langs-precompiled/java";
import python from "@shikijs/langs-precompiled/python";
import javascript from "@shikijs/langs-precompiled/javascript";
import typescript from "@shikijs/langs-precompiled/typescript";
import swift from "@shikijs/langs-precompiled/swift";
import go from "@shikijs/langs-precompiled/go";
import rust from "@shikijs/langs-precompiled/rust";
import json from "@shikijs/langs-precompiled/json";
import yaml from "@shikijs/langs-precompiled/yaml";
import bash from "@shikijs/langs-precompiled/bash";
import sql from "@shikijs/langs-precompiled/sql";
import html from "@shikijs/langs-precompiled/html";
import css from "@shikijs/langs-precompiled/css";
import c from "@shikijs/langs-precompiled/c";
import cpp from "@shikijs/langs-precompiled/cpp";
import ruby from "@shikijs/langs-precompiled/ruby";
import php from "@shikijs/langs-precompiled/php";
import markdown from "@shikijs/langs-precompiled/markdown";
import xml from "@shikijs/langs-precompiled/xml";
import toml from "@shikijs/langs-precompiled/toml";
import dockerfile from "@shikijs/langs-precompiled/dockerfile";
import graphql from "@shikijs/langs-precompiled/graphql";

import githubDark from "@shikijs/themes/github-dark";
import githubLight from "@shikijs/themes/github-light";
import oneDarkPro from "@shikijs/themes/one-dark-pro";
import dracula from "@shikijs/themes/dracula";
import minLight from "@shikijs/themes/min-light";

const SUPPORTED_LANGS = [
  kotlin, java, python, javascript, typescript, swift, go, rust,
  json, yaml, bash, sql, html, css, c, cpp, ruby, php,
  markdown, xml, toml, dockerfile, graphql,
] as const;

const SUPPORTED_THEMES = [githubDark, githubLight, oneDarkPro, dracula, minLight] as const;

const LANGUAGE_NAMES = [
  "kotlin", "java", "python", "javascript", "typescript", "swift", "go", "rust",
  "json", "yaml", "bash", "sql", "html", "css", "c", "cpp", "ruby", "php",
  "markdown", "xml", "toml", "dockerfile", "graphql",
];

const THEME_NAMES = [
  "github-dark", "github-light", "one-dark-pro", "dracula", "min-light",
];

// Singleton: reusing prevents ~500ms+ re-initialization per request.
// Reset to null on failure so the next request retries.
let highlighterPromise: ReturnType<typeof createHighlighterCore> | null = null;

export function getHighlighter() {
  if (!highlighterPromise) {
    console.log("Initializing Shiki highlighter (pre-compiled JS engine)...");
    highlighterPromise = createHighlighterCore({
      themes: [...SUPPORTED_THEMES],
      langs: [...SUPPORTED_LANGS],
      // JS engine instead of WASM — required for Cloudflare Workers which blocks WebAssembly.instantiate()
      engine: createJavaScriptRawEngine(),
    }).then((h) => {
      console.log("Shiki highlighter initialized successfully");
      return h;
    }).catch((e) => {
      console.error("Shiki highlighter initialization failed:", e);
      highlighterPromise = null;
      throw e;
    });
  }
  return highlighterPromise;
}

export function getSupportedLanguages(): string[] {
  return [...LANGUAGE_NAMES];
}

export function getSupportedThemes(): string[] {
  return [...THEME_NAMES];
}
