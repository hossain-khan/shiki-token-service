import { createHighlighter, type HighlighterGeneric, type BundledLanguage, type BundledTheme } from "shiki";

const SUPPORTED_LANGUAGES: BundledLanguage[] = [
  "kotlin", "java", "python", "javascript", "typescript", "swift", "go", "rust",
  "json", "yaml", "bash", "sql", "html", "css", "c", "cpp", "ruby", "php",
  "markdown", "xml", "toml", "dockerfile", "graphql",
];

const SUPPORTED_THEMES: BundledTheme[] = [
  "github-dark", "github-light", "one-dark-pro", "dracula", "min-light",
];

let highlighterPromise: Promise<HighlighterGeneric<BundledLanguage, BundledTheme>> | null = null;

export function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: SUPPORTED_THEMES,
      langs: SUPPORTED_LANGUAGES,
    });
  }
  return highlighterPromise;
}

export function getSupportedLanguages(): string[] {
  return [...SUPPORTED_LANGUAGES];
}

export function getSupportedThemes(): string[] {
  return [...SUPPORTED_THEMES];
}
