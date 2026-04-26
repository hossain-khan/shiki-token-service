import { z } from "zod";

// ── Schemas ──────────────────────────────────────────────────────────────────

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const SortSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export type Pagination = z.infer<typeof PaginationSchema>;
export type Sort = z.infer<typeof SortSchema>;

// ── Generic page wrapper ──────────────────────────────────────────────────────

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function buildPage<T>(
  items: T[],
  total: number,
  pagination: Pagination
): Page<T> {
  return {
    items,
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
    hasNext: pagination.page * pagination.pageSize < total,
    hasPrev: pagination.page > 1,
  };
}

// ── Result type ───────────────────────────────────────────────────────────────

export type Ok<T> = { ok: true; value: T };
export type Err<E extends string = string> = { ok: false; error: E; message?: string };
export type Result<T, E extends string = string> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E extends string>(error: E, message?: string): Err<E> {
  return { ok: false, error, message };
}

export function isOk<T>(result: Result<T>): result is Ok<T> {
  return result.ok;
}

// ── String utilities ──────────────────────────────────────────────────────────

export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function truncate(input: string, maxLength: number, suffix = "..."): string {
  if (input.length <= maxLength) return input;
  return input.slice(0, maxLength - suffix.length) + suffix;
}

export function capitalize(input: string): string {
  if (!input) return input;
  return input.charAt(0).toUpperCase() + input.slice(1);
}

// ── Date utilities ────────────────────────────────────────────────────────────

export function toISODateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function daysBetween(a: Date, b: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round(Math.abs(b.getTime() - a.getTime()) / msPerDay);
}

// ── Object utilities ──────────────────────────────────────────────────────────

export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) delete result[key];
  return result;
}

export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) result[key] = obj[key];
  return result;
}

export function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const key = keyFn(item);
    (acc[key] ??= []).push(item);
    return acc;
  }, {});
}
