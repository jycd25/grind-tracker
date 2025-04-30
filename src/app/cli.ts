import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openDb } from "./db.ts";
import { createApp } from "./server.ts";

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../public");
const DB_PATH = join(homedir(), ".grind-tracker", "grind.db");
const PORT = 8777;

const db = openDb(DB_PATH);
createApp(db, PUBLIC_DIR).listen(PORT, "127.0.0.1", () => {
  console.log(`Grind tracker running at http://127.0.0.1:${PORT}/ (Ctrl+C to stop)`);
});
