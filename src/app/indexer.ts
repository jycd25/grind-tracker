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
    let inCode = false;
    lines.forEach((line, i) => {
      if (line.trimStart().startsWith("```")) { inCode = !inCode; return; }
      if (inCode) return;
      const m = HEADING_RE.exec(line);
      if (!m) return;
      const title = m[2];
      sections.push({
        file: name,
        anchor: githubSlug(title),
        label: `${stem} > ${title}`,
        line: i + 1,
        level: m[1].length,
      });
    });
  }
  return sections;
}
