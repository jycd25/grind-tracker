import { DatabaseSync } from "node:sqlite";
import { EXPORT_VERSION, type ExportFile, type ExportItem, type ExportReview } from "../core/exportFile.ts";
import { DEFAULT_LADDER } from "../core/schedule.ts";

interface LegacyEntry {
  id: number;
  label: string;
  file: string;
  anchor: string;
  note: string;
  first_date: string;
}

export function legacyToExport(legacyDbPath: string): ExportFile {
  const db = new DatabaseSync(legacyDbPath, { readOnly: true });
  try {
    const ladderRow = db.prepare("SELECT value FROM settings WHERE key = 'ladder'").get() as
      | { value: string }
      | undefined;
    const entries = db
      .prepare("SELECT id, label, file, anchor, note, first_date FROM entries ORDER BY id")
      .all() as unknown as LegacyEntry[];
    const reviewStmt = db.prepare(
      "SELECT due_date, step, done_at FROM reviews WHERE entry_id = ? ORDER BY due_date, id",
    );
    const items: ExportItem[] = entries.map((entry) => ({
      label: entry.label,
      source: entry.file,
      anchor: entry.anchor,
      note: entry.note,
      first_date: entry.first_date,
      reviews: reviewStmt.all(entry.id) as unknown as ExportReview[],
    }));
    return { version: EXPORT_VERSION, ladder: ladderRow?.value ?? DEFAULT_LADDER, items };
  } finally {
    db.close();
  }
}
