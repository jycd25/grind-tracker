# grind-tracker

A local-first spaced-repetition tracker for things you're learning, with a
local web UI.

## Quick start

```bash
npx grind-tracker
```

This opens `http://127.0.0.1:8777` in your browser. All data lives in a
SQLite file at `~/.grind-tracker/grind.db`, so nothing leaves your machine.
Requires Node 24+.

## How it works

- **Add items manually** in the web UI, or point the server at a folder of
  notes with `--notes <dir>` to pull in `*.md` / `*.txt` headings as
  candidates you can add with one click.
- Each item gets a **review ladder**: by default `1, 3, 7, 14, 30` days from
  its grind date (the date you added it). Five reviews get scheduled up
  front, one per ladder step.
- The **due list** on the home page shows everything due today or overdue,
  across all items.
- Mark a review **done** when you've reviewed it, or **undo** if you marked
  it by mistake.
- The ladder can be changed in settings, but an edit only affects items added
  afterward. Existing items keep the schedule they were created with.

## License

Apache License 2.0. See [LICENSE](LICENSE).
