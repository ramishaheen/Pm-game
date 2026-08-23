# CLAUDE.md — Pm-game

Guidance for Claude Code working in this repository.

## Repository

Currently a bare repository — no application code has landed yet. Explore before assuming a
stack; update this file as the project takes shape.

## Big & complicated data — `bigdata` skill (auto-trigger)

This repo carries the **`bigdata`** skill at `.claude/skills/bigdata/`. It is the performance
playbook distilled from fixing the HBL DMS Intelligence Finance System document tree.

**Check on every task whether it applies, and invoke it yourself — do not wait to be asked.**

### Trigger conditions

Invoke `bigdata` (`Skill(skill: "bigdata")`) when any of these hold:

- A table/collection that can realistically exceed **~1,000 rows** is listed, searched,
  paginated, exported, or rendered as a tree.
- The data is **self-referencing** (`parentId`, `folderId`, `managerId`, `replyToId`) — i.e. a
  hierarchy, tree, folder structure, org chart, category tree, or BOM.
- The domain is document management, files/folders, transactions, ledgers, journal entries,
  invoices, logs, audit trails, events, notifications, or messages.
- The code under discussion contains a query with `include` / `join` / `select *` feeding a
  view that renders only a few columns, a `_count` / `COUNT(*)` per row, a `.find()` /
  `.filter()` inside a loop over the same array, a `LIKE '%x%'` / `contains` search, or a fetch
  hook with no `staleTime`.
- Anyone reports **slow load, lag, timeouts, huge payloads, freezing, memory spikes**, or asks
  about performance, scale, indexes, `EXPLAIN`, or query plans.
- A database index, migration, or search feature is being added or changed.

Say briefly that you are running the bigdata audit, then follow the skill.

### The four levers, in order of payoff

1. **Don't fetch what you don't render** — `minimal=true` mode that skips relational includes
   and count queries entirely, returning only the bare fields the view needs. Detail data is
   fetched lazily by id when a row is actually clicked.
2. **Right-size the page, then cache it** — page size and payload width are one decision
   (1000 slim rows beat 200 fat ones); set `staleTime` to match the data's real volatility;
   invalidate on every structural mutation; leave a dev-only row-count/ms log behind.
3. **Kill O(n^2) on the client** — never search a collection while looping over it. Two linear
   passes and a `Map` keyed on `parentId`. For 1,000 items that is ~2,000 operations instead
   of ~1,000,000.
4. **Index the database, then verify the code uses the index** — trigram GIN indexes for
   substring search, composite indexes ordered equality-first, always `CREATE INDEX
   CONCURRENTLY` on a live table (slower to build, but no lock, so the app stays usable).
   Then audit **every** read path — list, badge/count, search, export, background jobs — because
   an index buys nothing on a path whose predicate cannot use it.

### Non-negotiables

- Test at realistic scale (10k–100k rows). A 50-row dev seed hides every one of these problems.
- Never claim a speedup without before/after numbers: row count, payload bytes, server ms,
  render ms, and the `EXPLAIN (ANALYZE, BUFFERS)` plan.
- Never `CREATE INDEX` without `CONCURRENTLY` on a live, large table.
- Never wrap a column in a function inside `WHERE` (`LOWER`, `CAST`, `date_trunc`) — it
  silently disables the index.
- Fix in the order above. Do not reach for caching layers, read replicas, or read models to
  paper over a missing `select` and an O(n^2) loop.

Full detail: `.claude/skills/bigdata/SKILL.md` and its `references/` files.
