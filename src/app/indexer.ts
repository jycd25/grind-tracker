import { readFileSync, readdirSync } from "node:fs";
import { basename, extname, join } from "node:path";

export interface Section {
  file: string;
  anchor: string;
  label: string;
  line: number;
  level: number;
}

const HEADING_RE = /^(#{2,4})\s+(.+?)\s*$/;

export function githubSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\- ]/g, "")
    .replace(/ /g, "-");
}

export function scan(notesDir: string): Section[] {
  const sections: Section[] = [];
  let names: string[];
  try {
    names = readdirSync(notesDir).filter((n) => [".md", ".txt"].includes(extname(n).toLowerCase()));
  } catch {
    return sections;
  }
  names.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  for (const name of names) {
    let lines: string[];
    try {
      lines = readFileSync(join(notesDir, name), "utf-8").split("\n");
    } catch {
      continue;
    }
    const stem = basename(name, extname(name));
    const counts = new Map<string, number>();
    let inCode = false;
    let inToc = false;
    lines.forEach((line, i) => {
      if (line.includes("<!-- START doctoc")) { inToc = true; return; }
      if (line.includes("<!-- END doctoc")) { inToc = false; return; }
      if (inToc) return;
      if (line.trimStart().startsWith("```")) { inCode = !inCode; return; }
      if (inCode) return;
      const m = HEADING_RE.exec(line);
      if (!m) return;
      const title = m[2];
      const base = githubSlug(title);
      const n = counts.get(base) ?? 0;
      counts.set(base, n + 1);
      sections.push({
        file: name,
        anchor: n === 0 ? base : `${base}-${n}`,
        label: `${stem} > ${title}`,
        line: i + 1,
        level: m[1].length,
      });
    });
  }
  return sections;
}
