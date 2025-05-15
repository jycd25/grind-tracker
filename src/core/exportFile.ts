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
