import type { ItemWithReviews } from "./types.ts";

export const EXPORT_VERSION = 1;

export interface ExportReview {
  due_date: string;
  step: number;
  done_at: string | null;
}

export interface ExportItem {
  label: string;
  source: string | null;
  anchor: string | null;
  note: string;
  first_date: string;
  reviews: ExportReview[];
}

export interface ExportFile {
  version: 1;
  ladder: string;
  items: ExportItem[];
}

export function buildExport(ladder: string, items: ItemWithReviews[]): ExportFile {
  return {
    version: EXPORT_VERSION,
    ladder,
    items: items.map((item) => ({
      label: item.label,
      source: item.source,
      anchor: item.anchor,
      note: item.note,
      first_date: item.first_date,
      reviews: item.reviews.map((r) => ({ due_date: r.due_date, step: r.step, done_at: r.done_at })),
    })),
  };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function fail(path: string, expected: string): never {
  throw new Error(`invalid export file: ${path} must be ${expected}`);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseReview(v: unknown, path: string): ExportReview {
  if (!isRecord(v)) fail(path, "an object");
  if (typeof v.due_date !== "string" || !DATE_RE.test(v.due_date)) fail(`${path}.due_date`, "a YYYY-MM-DD string");
  if (typeof v.step !== "number" || !Number.isInteger(v.step) || v.step <= 0) fail(`${path}.step`, "a positive integer");
  if (v.done_at !== null && typeof v.done_at !== "string") fail(`${path}.done_at`, "a string or null");
  return { due_date: v.due_date, step: v.step, done_at: v.done_at ?? null };
}

function parseItem(v: unknown, path: string): ExportItem {
  if (!isRecord(v)) fail(path, "an object");
  if (typeof v.label !== "string" || v.label.trim() === "") fail(`${path}.label`, "a non-empty string");
  if (v.source !== null && v.source !== undefined && typeof v.source !== "string") fail(`${path}.source`, "a string or null");
  if (v.anchor !== null && v.anchor !== undefined && typeof v.anchor !== "string") fail(`${path}.anchor`, "a string or null");
  if (v.note !== undefined && typeof v.note !== "string") fail(`${path}.note`, "a string");
  if (typeof v.first_date !== "string" || !DATE_RE.test(v.first_date)) fail(`${path}.first_date`, "a YYYY-MM-DD string");
  if (!Array.isArray(v.reviews)) fail(`${path}.reviews`, "an array");
  return {
    label: v.label,
    source: (v.source as string | null | undefined) ?? null,
    anchor: (v.anchor as string | null | undefined) ?? null,
    note: (v.note as string | undefined) ?? "",
    first_date: v.first_date,
    reviews: v.reviews.map((r, i) => parseReview(r, `${path}.reviews[${i}]`)),
  };
}

export function parseExport(data: unknown): ExportFile {
  if (!isRecord(data)) throw new Error("invalid export file: expected a JSON object");
  if (data.version !== EXPORT_VERSION) throw new Error(`unsupported export file version: ${String(data.version)}`);
  if (typeof data.ladder !== "string") fail("ladder", "a string");
  if (!Array.isArray(data.items)) fail("items", "an array");
  return {
    version: EXPORT_VERSION,
    ladder: data.ladder,
    items: data.items.map((item, i) => parseItem(item, `items[${i}]`)),
  };
}
