import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { openDb } from "./db.ts";
import { createApp } from "./server.ts";

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../public");
const DEFAULT_DB = join(homedir(), ".grind-tracker", "grind.db");

function openBrowser(url: string): void {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  try {
    spawn(cmd, [url], { stdio: "ignore", detached: true, shell: process.platform === "win32" }).unref();
  } catch {
    // best effort only
  }
}

const { values } = parseArgs({
  options: {
    db: { type: "string", default: DEFAULT_DB },
    port: { type: "string", default: "8777" },
  },
});

const db = openDb(values.db);
const port = Number(values.port);
const app = createApp(db, PUBLIC_DIR);
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
