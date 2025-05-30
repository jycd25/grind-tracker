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

## CLI reference

```
usage: grind-tracker [command] [options]

commands:
  serve (default)   start the local web UI
  export [file]     write all data as JSON (stdout if no file)
  import <file>     merge a JSON export into the database
  import-legacy <grind.db>
                    one-time import from the legacy Python tracker

options:
  --db <path>       database file (default ~/.grind-tracker/grind.db)
  --port <n>        serve port (default 8777)
  --notes <dir>     index *.md / *.txt headings from this folder
  --no-open         do not open the browser
```

## Export, import, and migrating from the legacy tracker

`grind-tracker export [file]` writes a versioned JSON snapshot of your
ladder and every item (with its full review history), either to stdout or to
`file` if given. `grind-tracker import <file>` merges an export back in;
items are matched by label, so importing the same file twice just skips the
duplicates instead of doubling them up.

If you're moving from the legacy Python tracker, run:

```bash
grind-tracker import-legacy path/to/grind.db
```

This is a one-time read of the old SQLite schema (`entries`, `reviews`,
`settings`) into the same versioned export format, then merges it into your
grind-tracker database.

## Security note

The web server only binds to `127.0.0.1`, so it is never reachable from
another machine on your network.

## License

Apache License 2.0. See [LICENSE](LICENSE).
