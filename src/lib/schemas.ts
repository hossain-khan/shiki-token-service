import { z } from "zod";

export const HighlightRequestSchema = z.object({
  code: z.string().max(100_000),
  language: z.string().optional().default("text"),
  theme: z.string().optional().default("github-dark"),
});

export const HighlightDualRequestSchema = z.object({
  code: z.string().max(100_000),
  language: z.string().optional().default("text"),
  darkTheme: z.string().optional().default("github-dark"),
  lightTheme: z.string().optional().default("github-light"),
});

export const HighlightSemanticRequestSchema = z.object({
  code: z.string().max(100_000),
  language: z.string().optional().default("text"),
});
