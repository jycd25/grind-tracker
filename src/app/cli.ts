import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openDb } from "./db.ts";
import { createApp } from "./server.ts";

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../public");
const DB_PATH = join(homedir(), ".grind-tracker", "grind.db");
const PORT = 8777;

function openBrowser(url: string): void {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  try {
    spawn(cmd, [url], { stdio: "ignore", detached: true, shell: process.platform === "win32" }).unref();
  } catch {
    // best effort only
  }
}

const db = openDb(DB_PATH);
createApp(db, PUBLIC_DIR).listen(PORT, "127.0.0.1", () => {
  const url = `http://127.0.0.1:${PORT}/`;
  console.log(`Grind tracker running at ${url} (Ctrl+C to stop)`);
  openBrowser(url);
});
