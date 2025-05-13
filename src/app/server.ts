import http from "node:http";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";
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

function send(res: http.ServerResponse, status: number, obj: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("error", reject);
    req.on("end", () => resolvePromise(JSON.parse(Buffer.concat(chunks).toString("utf-8"))));
  });
}

export function createApp(db: DatabaseSync, opts: AppOptions): http.Server {
  return http.createServer(async (req, res) => {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    const method = req.method ?? "GET";

    if (method === "GET" && path in STATIC) {
      const [name, ctype] = STATIC[path];
      res.writeHead(200, { "Content-Type": ctype });
      res.end(readFileSync(join(opts.publicDir, name)));
      return;
    }

    if (method === "GET" && path === "/api/items") return send(res, 200, store.listItems(db));
    if (method === "GET" && path === "/api/settings") return send(res, 200, { ladder: store.getLadder(db) });
    if (method === "GET" && path === "/api/sections") {
      return send(res, 200, {
        base: opts.notesDir ? resolve(opts.notesDir) : null,
        sections: opts.notesDir ? scan(opts.notesDir) : [],
      });
    }

    if (method === "POST" && path === "/api/settings") {
      const payload = (await readBody(req)) as { ladder?: string };
      try {
        store.setLadder(db, String(payload.ladder ?? ""));
      } catch (err) {
        return send(res, 400, { error: err instanceof Error ? err.message : String(err) });
      }
      return send(res, 200, { ok: true });
    }

    if (method === "POST" && path === "/api/items") {
      const payload = (await readBody(req)) as {
        label?: string; source?: string | null; anchor?: string | null; note?: string; first_date?: string;
      };
      const item = store.addItem(db, {
        label: String(payload.label ?? ""),
        source: payload.source == null ? null : String(payload.source),
        anchor: payload.anchor == null ? null : String(payload.anchor),
        note: String(payload.note ?? ""),
        first_date: String(payload.first_date ?? ""),
      });
      return send(res, 201, item);
    }

    const review = REVIEW_RE.exec(path);
    if (method === "POST" && review) {
      const ok = store.markReview(db, Number(review[1]), review[2] === "done");
      return ok ? send(res, 200, { ok: true }) : send(res, 404, { error: "review not found" });
    }

    const item = ITEM_RE.exec(path);
    if (method === "DELETE" && item) {
      const ok = store.deleteItem(db, Number(item[1]));
      return ok ? send(res, 200, { ok: true }) : send(res, 404, { error: "item not found" });
    }

    send(res, 404, { error: "not found" });
  });
}
