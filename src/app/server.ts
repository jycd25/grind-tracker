import http from "node:http";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { parseExport } from "../core/exportFile.ts";
import * as store from "./db.ts";
import { scan } from "./indexer.ts";

export interface AppOptions {
  publicDir: string;
  notesDir?: string;
}

const STATIC: Record<string, [string, string]> = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/app.js": ["app.js", "application/javascript; charset=utf-8"],
  "/style.css": ["style.css", "text/css; charset=utf-8"],
};

const REVIEW_RE = /^\/api\/reviews\/(\d+)\/(done|undone)$/;
const ITEM_RE = /^\/api\/items\/(\d+)$/;

function send(res: http.ServerResponse, status: number, obj: unknown, headers: Record<string, string> = {}): void {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  res.end(body);
}

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("error", reject);
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf-8");
      try {
        resolvePromise(JSON.parse(raw));
      } catch {
        reject(new Error("invalid JSON body"));
      }
    });
  });
}

function asRecord(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
}

export function createApp(db: DatabaseSync, opts: AppOptions): http.Server {
  return http.createServer(async (req, res) => {
    try {
      await route(db, opts, req, res);
    } catch (err) {
      send(res, 400, { error: err instanceof Error ? err.message : String(err) });
    }
  });
}

async function route(
  db: DatabaseSync,
  opts: AppOptions,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  const method = req.method ?? "GET";

  if (method === "GET" && path in STATIC) {
    const [name, ctype] = STATIC[path];
    try {
      const body = readFileSync(join(opts.publicDir, name));
      res.writeHead(200, { "Content-Type": ctype });
      res.end(body);
    } catch {
      send(res, 404, { error: `missing static file: ${name}` });
    }
    return;
  }

  if (method === "GET") {
    if (path === "/api/items") return send(res, 200, store.listItems(db));
    if (path === "/api/settings") return send(res, 200, { ladder: store.getLadder(db) });
    if (path === "/api/sections") {
      return send(res, 200, {
        base: opts.notesDir ? resolve(opts.notesDir) : null,
        sections: opts.notesDir ? scan(opts.notesDir) : [],
      });
    }
    if (path === "/api/export") {
      return send(res, 200, store.exportData(db), {
        "Content-Disposition": 'attachment; filename="grind-export.json"',
      });
    }
    return send(res, 404, { error: "not found" });
  }

  if (method === "POST") {
    const payload = asRecord(await readBody(req));
    const review = REVIEW_RE.exec(path);
    if (path === "/api/items") {
      const item = store.addItem(db, {
        label: String(payload.label ?? ""),
        source: payload.source == null ? null : String(payload.source),
        anchor: payload.anchor == null ? null : String(payload.anchor),
        note: String(payload.note ?? ""),
        first_date: String(payload.first_date ?? ""),
      });
      return send(res, 201, item);
    }
    if (review) {
      const ok = store.markReview(db, Number(review[1]), review[2] === "done");
      return ok ? send(res, 200, { ok: true }) : send(res, 404, { error: "review not found" });
    }
    if (path === "/api/settings") {
      store.setLadder(db, String(payload.ladder ?? ""));
      return send(res, 200, { ok: true });
    }
    if (path === "/api/import") {
      return send(res, 200, store.importData(db, parseExport(payload)));
    }
    return send(res, 404, { error: "not found" });
  }

  if (method === "DELETE") {
    const m = ITEM_RE.exec(path);
    if (!m) return send(res, 404, { error: "not found" });
    const ok = store.deleteItem(db, Number(m[1]));
    return ok ? send(res, 200, { ok: true }) : send(res, 404, { error: "item not found" });
  }

  send(res, 404, { error: "not found" });
}
