import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DEFAULT_LADDER, parseLadder, scheduleDates, todayStr } from "../core/schedule.ts";
import { buildExport, type ExportFile } from "../core/exportFile.ts";
import type { ItemRow, ItemWithReviews, ReviewRow } from "../core/types.ts";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS items (
  id         INTEGER PRIMARY KEY,
  label      TEXT NOT NULL,
  source     TEXT,
  anchor     TEXT,
  note       TEXT NOT NULL DEFAULT '',
  first_date TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reviews (
  id       INTEGER PRIMARY KEY,
  item_id  INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  due_date TEXT NOT NULL,
  step     INTEGER NOT NULL,
  done_at  TEXT
);
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export interface NewItem {
  label: string;
  source?: string | null;
  anchor?: string | null;
  note?: string;
  first_date: string;
}

export function openDb(path: string): DatabaseSync {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(SCHEMA);
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('ladder', ?)").run(DEFAULT_LADDER);
  return db;
}

export function getLadder(db: DatabaseSync): string {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'ladder'").get() as { value: string };
  return row.value;
}

export function setLadder(db: DatabaseSync, s: string): void {
  parseLadder(s);
  db.prepare("UPDATE settings SET value = ? WHERE key = 'ladder'").run(s.trim());
}

export function getItem(db: DatabaseSync, id: number): ItemWithReviews | null {
  const item = db.prepare("SELECT * FROM items WHERE id = ?").get(id) as unknown as ItemRow | undefined;
  if (!item) return null;
  const reviews = db
    .prepare("SELECT * FROM reviews WHERE item_id = ? ORDER BY due_date, id")
    .all(id) as unknown as ReviewRow[];
  return { ...item, reviews };
}

export function addItem(db: DatabaseSync, input: NewItem): ItemWithReviews {
  const label = (input.label ?? "").trim();
  if (!label) throw new Error("label is required");
  const steps = parseLadder(getLadder(db));
  const dues = scheduleDates(input.first_date, steps);
  const cur = db
    .prepare("INSERT INTO items (label, source, anchor, note, first_date) VALUES (?, ?, ?, ?, ?)")
    .run(label, input.source ?? null, input.anchor ?? null, input.note ?? "", input.first_date);
  const id = Number(cur.lastInsertRowid);
  const ins = db.prepare("INSERT INTO reviews (item_id, due_date, step) VALUES (?, ?, ?)");
  steps.forEach((step, i) => ins.run(id, dues[i], step));
  return getItem(db, id)!;
}

export function listItems(db: DatabaseSync): ItemWithReviews[] {
  const ids = db.prepare("SELECT id FROM items ORDER BY first_date DESC, id DESC").all() as unknown as Array<{ id: number }>;
  return ids.map((row) => getItem(db, row.id)!);
}

export function findItemByLabel(db: DatabaseSync, label: string): ItemWithReviews | null {
  const row = db.prepare("SELECT id FROM items WHERE label = ?").get(label.trim()) as { id: number } | undefined;
  return row ? getItem(db, row.id) : null;
}

export function updateItem(
  db: DatabaseSync,
  id: number,
  fields: Partial<Pick<ItemRow, "label" | "note" | "source" | "anchor">>,
): ItemWithReviews | null {
  const existing = getItem(db, id);
  if (!existing) return null;
  const label = fields.label !== undefined ? fields.label.trim() : existing.label;
  if (!label) throw new Error("label is required");
  db.prepare("UPDATE items SET label = ?, note = ?, source = ?, anchor = ? WHERE id = ?").run(
    label,
    fields.note !== undefined ? fields.note : existing.note,
    fields.source !== undefined ? fields.source : existing.source,
    fields.anchor !== undefined ? fields.anchor : existing.anchor,
    id,
  );
  return getItem(db, id);
}

export function deleteItem(db: DatabaseSync, id: number): boolean {
  return db.prepare("DELETE FROM items WHERE id = ?").run(id).changes > 0;
}

export function markReview(db: DatabaseSync, reviewId: number, done: boolean): boolean {
  const doneAt = done ? new Date().toISOString().slice(0, 19) : null;
  return db.prepare("UPDATE reviews SET done_at = ? WHERE id = ?").run(doneAt, reviewId).changes > 0;
}

export function listDue(db: DatabaseSync, date?: string): Array<{ review: ReviewRow; item: ItemRow }> {
  const cutoff = date ?? todayStr();
  const rows = db
    .prepare(
      `SELECT r.id AS r_id, r.item_id, r.due_date, r.step, r.done_at,
              i.id AS i_id, i.label, i.source, i.anchor, i.note, i.first_date
       FROM reviews r JOIN items i ON i.id = r.item_id
       WHERE r.done_at IS NULL AND r.due_date <= ?
       ORDER BY r.due_date, r.id`,
    )
    .all(cutoff) as unknown as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    review: {
      id: row.r_id as number,
      item_id: row.item_id as number,
      due_date: row.due_date as string,
      step: row.step as number,
      done_at: row.done_at as string | null,
    },
    item: {
      id: row.i_id as number,
      label: row.label as string,
      source: row.source as string | null,
      anchor: row.anchor as string | null,
      note: row.note as string,
      first_date: row.first_date as string,
    },
  }));
}

export function exportData(db: DatabaseSync): ExportFile {
  return buildExport(getLadder(db), listItems(db));
}

export function importData(db: DatabaseSync, file: ExportFile): { added: number; skipped: number } {
  let added = 0;
  let skipped = 0;
  const exists = db.prepare("SELECT id FROM items WHERE label = ? AND first_date = ?");
  const insItem = db.prepare("INSERT INTO items (label, source, anchor, note, first_date) VALUES (?, ?, ?, ?, ?)");
  const insReview = db.prepare("INSERT INTO reviews (item_id, due_date, step, done_at) VALUES (?, ?, ?, ?)");
  for (const item of file.items) {
    if (exists.get(item.label, item.first_date)) {
      skipped += 1;
      continue;
    }
    const id = Number(insItem.run(item.label, item.source, item.anchor, item.note, item.first_date).lastInsertRowid);
    for (const r of item.reviews) insReview.run(id, r.due_date, r.step, r.done_at);
    added += 1;
  }
  return { added, skipped };
}
