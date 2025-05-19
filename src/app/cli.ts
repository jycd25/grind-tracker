#!/usr/bin/env node
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { parseExport } from "../core/exportFile.ts";
import { exportData, importData, openDb } from "./db.ts";
import { legacyToExport } from "./legacyImport.ts";
import { createApp } from "./server.ts";

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../public");
const DEFAULT_DB = join(homedir(), ".grind-tracker", "grind.db");

const USAGE = `usage: grind-tracker [command] [options]

commands:
  serve (default)   start the local web UI
  export [file]     write all data as JSON (stdout if no file)
  import <file>     merge a JSON export into the database
  import-legacy <grind.db>
                    one-time import from the legacy Python tracker

options:
  --db <path>       database file (default ${DEFAULT_DB})
  --port <n>        serve port (default 8777)
  --notes <dir>     index *.md / *.txt headings from this folder
`;

function openBrowser(url: string): void {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  try {
    spawn(cmd, [url], { stdio: "ignore", detached: true, shell: process.platform === "win32" }).unref();
  } catch {
    // best effort only
  }
}

function main(): number {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      db: { type: "string", default: DEFAULT_DB },
      port: { type: "string", default: "8777" },
      notes: { type: "string" },
    },
  });
  const command = positionals[0] ?? "serve";

  if (command === "serve") {
    const db = openDb(values.db);
    const port = Number(values.port);
    const app = createApp(db, { publicDir: PUBLIC_DIR, notesDir: values.notes });
    app.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        console.error(
          `Port ${port} is already in use — the tracker is probably already running. Open http://127.0.0.1:${port}/`,
        );
        process.exit(1);
      }
      throw err;
    });
    app.listen(port, "127.0.0.1", () => {
      const url = `http://127.0.0.1:${port}/`;
      console.log(`Grind tracker running at ${url} (Ctrl+C to stop)`);
      console.log(`Database: ${values.db}`);
      openBrowser(url);
    });
    return 0;
  }

  if (command === "export") {
    const db = openDb(values.db);
    const json = JSON.stringify(exportData(db), null, 2);
    if (positionals[1]) {
      writeFileSync(positionals[1], json + "\n");
      console.log(`Exported to ${positionals[1]}`);
    } else {
      process.stdout.write(json + "\n");
    }
    return 0;
  }

  if (command === "import") {
    if (!positionals[1]) {
      console.error("import requires a file argument");
      return 1;
    }
    const db = openDb(values.db);
    const file = parseExport(JSON.parse(readFileSync(positionals[1], "utf-8")));
    const result = importData(db, file);
    console.log(`Imported ${result.added} item(s), skipped ${result.skipped} duplicate(s).`);
    return 0;
  }

  if (command === "import-legacy") {
    if (!positionals[1]) {
      console.error("import-legacy requires the path to the legacy grind.db");
      return 1;
    }
    const db = openDb(values.db);
    const result = importData(db, legacyToExport(positionals[1]));
    console.log(`Imported ${result.added} item(s), skipped ${result.skipped} duplicate(s).`);
    return 0;
  }

  console.error(USAGE);
  return 1;
}

process.exitCode = main();
