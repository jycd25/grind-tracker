import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DEFAULT_LADDER, parseLadder, scheduleDates, todayStr } from "../core/schedule.ts";
import type { ItemRow, ItemWithReviews, ReviewRow } from "../core/types.ts";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS items (
  id         INTEGER PRIMARY KEY,
  label      TEXT NOT NULL,
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

export function openDb(path: string): DatabaseSync {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
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

export function addItem(db: DatabaseSync, label: string, firstDate: string): ItemWithReviews {
  const steps = parseLadder(getLadder(db));
  const dues = scheduleDates(firstDate, steps);
  const cur = db.prepare("INSERT INTO items (label, first_date) VALUES (?, ?)").run(label, firstDate);
  const id = Number(cur.lastInsertRowid);
  const ins = db.prepare("INSERT INTO reviews (item_id, due_date, step) VALUES (?, ?, ?)");
  steps.forEach((step, i) => ins.run(id, dues[i], step));
  return getItem(db, id)!;
}

export function listItems(db: DatabaseSync): ItemWithReviews[] {
  const ids = db.prepare("SELECT id FROM items ORDER BY first_date DESC, id DESC").all() as unknown as Array<{ id: number }>;
  return ids.map((row) => getItem(db, row.id)!);
}

export function deleteItem(db: DatabaseSync, id: number): boolean {
  return db.prepare("DELETE FROM items WHERE id = ?").run(id).changes > 0;
}

export function markReview(db: DatabaseSync, reviewId: number, done: boolean): boolean {
  const doneAt = done ? new Date().toISOString().slice(0, 19) : null;
  return db.prepare("UPDATE reviews SET done_at = ? WHERE id = ?").run(doneAt, reviewId).changes > 0;
}

export function listDue(db: DatabaseSync, date?: string): ReviewRow[] {
  const cutoff = date ?? todayStr();
  return db
    .prepare("SELECT * FROM reviews WHERE done_at IS NULL AND due_date <= ? ORDER BY due_date, id")
    .all(cutoff) as unknown as ReviewRow[];
}
