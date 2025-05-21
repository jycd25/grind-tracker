# grind-tracker

Local spaced-repetition tracker for things I'm grinding (algorithms, mostly).
Rewrite of my old Python tracker in TypeScript on Node's built-in sqlite.

Requires Node 24+ (`node:sqlite` and running `.ts` directly, no build step).

```bash
npm install
npm run dev
```

Point it at a folder of markdown notes and it will offer the headings as
items you can add with one click:

```bash
npm run dev -- --notes ~/notes
```
