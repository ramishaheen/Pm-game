# Big Data Audit Checklist

Run this before shipping any list / tree / search screen over data that can grow past ~1,000
rows, and any time something is reported slow. Work top to bottom; each answer of "no" is a
finding to fix in the order given in SKILL.md section 3.

## Step 0 — Establish scale (2 minutes, non-negotiable)

- [ ] What is the **production** row count of the driving table? (Not the dev seed.)
- [ ] What is the realistic 12-month row count?
- [ ] How many rows does the screen load in one shot?
- [ ] What is the current payload size, server time, and render time? Write them down.

If the answer to #1 is "I don't know", stop and go find out. Every decision below depends on it.

## Step 1 — Payload (lever 1)

- [ ] Does the list query have an explicit `select` / projection?
- [ ] Does every selected field actually appear in the rendered row?
- [ ] Are there relational `include`s / joins whose data is not rendered in the list?
- [ ] Are there `_count` / `COUNT(*)` aggregates computed per row?
- [ ] Is detail data (metadata, permissions, versions, comments, tags) fetched eagerly for
      rows the user has not clicked?
- [ ] Is there a `minimal` mode, and does the list view use it?

Grep:
```bash
rg -n "include\s*:" --type ts | rg -v "test|spec"
rg -n "_count|COUNT\(\*\)|select \*" -i
rg -n "findMany\(\{[^}]*\}\)" --multiline --type ts | rg -v "select"
```

## Step 2 — Pagination & caching (lever 2)

- [ ] Is the page size a deliberate number, chosen with the per-row payload size in mind?
- [ ] Are page size and payload width decided together (slim rows → bigger page is fine)?
- [ ] Is `staleTime` (or equivalent cache TTL) set, and does it match how fast the data changes?
- [ ] Is the cache key stable and specific (includes `minimal`, filters, sort)?
- [ ] Is the cache invalidated on create / rename / move / delete?
- [ ] Is there a dev-only log of row count + elapsed ms to catch regressions?

Grep:
```bash
rg -n "pageSize|per_page|limit\s*[:=]|take\s*:" --type ts
rg -n "useQuery\(" -A6 --type ts | rg -n "staleTime" -c   # count how many have one
```

## Step 3 — Client-side complexity (lever 3)

- [ ] Any `.find()` / `.filter()` / `.some()` / `.includes()` / `.indexOf()` inside a loop
      or `.map()` over the same collection? → replace with a prebuilt `Map`.
- [ ] Any nested `for` / `forEach` over the same array?
- [ ] Is a tree/hierarchy built by scanning the array per node? → two-pass `Map` grouping.
- [ ] Is the transform memoized so it does not rerun on unrelated renders?
- [ ] Are orphans (missing parent) and cycles handled without dropping rows or infinite looping?
- [ ] Is a sort or dedupe being done in a loop that could be done once?

Grep:
```bash
rg -n --multiline "\.map\([^)]*\)\s*=>[\s\S]{0,400}?\.(find|filter|some)\(" --type ts
rg -n "for\s*\(.*\)\s*\{[\s\S]{0,300}?for\s*\(" --multiline --type ts
rg -n "buildHierarchy|buildTree|buildFolder|toTree|nest" -i --type ts
```

## Step 4 — Database (lever 4)

- [ ] Does every column used in `WHERE`, `JOIN`, and `ORDER BY` on a large table have an index?
- [ ] Is any `LIKE '%x%'` / `ILIKE '%x%'` / `contains` search running without a trigram index?
- [ ] Are composite indexes ordered to match the actual predicate + sort?
- [ ] Was every index on a live table created with `CONCURRENTLY`?
- [ ] Are all `CONCURRENTLY` indexes valid (`pg_index.indisvalid = true`)?
- [ ] **Does every code path that reads this table actually hit the index?** Check the list
      query, the badge/count query, search, export, and any background job — they often
      diverge, and only some are indexed.
- [ ] Any function applied to a column in `WHERE` (`LOWER`, `CAST`, `date_trunc`, `::text`)
      that silently disables the index?
- [ ] `EXPLAIN (ANALYZE, BUFFERS)` run before and after, and captured in the PR?

SQL:
```sql
-- indexes on a table
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'Document';

-- invalid indexes left behind by a failed CONCURRENTLY build
SELECT c.relname FROM pg_class c JOIN pg_index i ON i.indexrelid = c.oid
WHERE i.indisvalid = false;

-- indexes nobody uses (candidates for removal — they cost writes)
SELECT relname, indexrelname, idx_scan FROM pg_stat_user_indexes
WHERE idx_scan = 0 ORDER BY relname;

-- sequential scans on big tables
SELECT relname, seq_scan, seq_tup_read, idx_scan FROM pg_stat_user_tables
ORDER BY seq_tup_read DESC LIMIT 20;
```

## Step 5 — Prove it

- [ ] Re-measured the same four numbers from Step 0.
- [ ] Tested at realistic scale (10k–100k rows), not the dev seed.
- [ ] Query plan shows `Index Scan` / `Bitmap Index Scan`, not `Seq Scan`, on the hot path.
- [ ] Before → after table written into the PR description.
- [ ] No behavioural regression: same rows, same order, same counts as before.

## Escalation — only after all of the above

If it is still slow with slim payloads, sane paging, linear transforms, and used indexes:

1. **Virtualize the list** (`react-window`, `@tanstack/virtual`) — render only visible rows.
2. **Cursor pagination** instead of offset — `OFFSET 50000` scans and discards 50,000 rows.
3. **Lazy tree loading** — fetch children on expand rather than the whole tree.
4. **Server-side search/filter/sort** — stop shipping the whole set to the client.
5. **Denormalized read model / materialized view** — precompute the expensive shape.
6. **Background aggregation** — counts and badges computed on write, read from a column.
7. **Streaming / chunked responses** — first paint before the last row arrives.
