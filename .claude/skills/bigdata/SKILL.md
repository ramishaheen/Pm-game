---
name: bigdata
description: Performance playbook for very large and complicated datasets. Use when building, reviewing, or debugging any feature that lists, nests, searches, or paginates thousands of records (documents, files, folders, transactions, ledgers, invoices, logs, tickets, audit trails) — and whenever the symptom is slow page loads, huge JSON payloads, timeouts, lag, spinner-forever, N+1 or count queries, over-fetched relational includes, O(n^2) client-side grouping/tree building, slow LIKE/ILIKE search, or missing/unused database indexes. Trigger keywords include performance, slow, scale, thousands of rows, big data, tree, hierarchy, folder structure, pagination, search index, EXPLAIN, query plan. Run the audit in references/audit-checklist.md proactively before shipping any data-heavy list, tree, or search screen — do not wait to be asked.
---

# bigdata — Big & Complicated Data Performance Playbook

Origin: the HBL DMS Intelligence Finance System. A document tree over tens of thousands of
files/folders was crawling. Four root causes were found and fixed. Every one of them
generalizes. This skill encodes them as a repeatable audit + fix procedure.

**Headline result from the origin case:** hierarchy building went from ~1,000,000 operations
to ~2,000 for 1,000 items. Payloads dropped by an order of magnitude. Search went from
sequential scans to trigram index hits.

---

## 1. Auto-trigger: when to run this without being asked

Run the audit (`references/audit-checklist.md`) the moment ANY of these are true. Do not wait
for the user to say "make it fast" — by then it is already slow in production.

**Data-shape signals**
- A table/collection that can realistically exceed ~1,000 rows is listed, searched, or trees out.
- Anything self-referencing: `parentId`, `folderId`, `managerId`, `replyToId` — i.e. a hierarchy.
- Documents, files, folders, transactions, journal entries, invoices, logs, audit trails,
  events, notifications, chat messages, org charts, BOMs, category trees.

**Code-shape signals**
- A query with `include:` / `join` / `select *` feeding a view that renders only 3–4 columns.
- `_count`, `COUNT(*)`, or an aggregate computed per row of a list.
- `.filter()`, `.find()`, `.some()`, or `.indexOf()` **inside** a `.map()` / `for` loop over the
  same array. That is O(n^2) wearing a nice suit.
- `LIKE '%foo%'` / `ILIKE '%foo%'` / `contains:` on a text column.
- A fetch/query hook with no `staleTime`, no cache key discipline, or a page size chosen by vibes.
- A function applied to a column in `WHERE` (`LOWER(name) = ...`, `CAST(...)`, `date_trunc(...)`)
  — this silently disables the index on that column.

**Symptom signals**
- Page load > 1s, API response > 300ms, JSON payload > ~500KB, visible lag on expand/scroll,
  timeouts, memory spikes, browser tab freeze.

When triggered, say so briefly ("this is a big-data-shaped screen, running the bigdata audit"),
run the checklist, then fix in the order in section 3.

---

## 2. The four levers

These are ordered by payoff-per-hour. Lever 1 and 3 are usually free wins; lever 4 is the
one that needs care in production.

### Lever 1 — Don't fetch what you don't render (`minimal=true`)

**The problem.** The list endpoint returned every field of every file, plus relational
includes, plus per-row count queries. But the UI at that moment renders only the tree:
name, id, parentId, type. All the rest — metadata, tags, permissions, versions, uploader
profile, counts — is invisible until the user *clicks a file*. We were paying for a detail
view on every row of a list view.

**The fix.** Add an explicit `minimal` mode to the endpoint that:
- skips ALL relational `include` / `join`
- skips ALL `_count` / `COUNT(*)` aggregates
- returns only the bare fields the consumer actually needs to draw the screen

```ts
// GET /api/documents?minimal=true
const minimal = searchParams.get('minimal') === 'true'

const rows = await prisma.document.findMany({
  where,
  // minimal: only what the tree-builder needs to draw folder/file structure
  select: minimal
    ? { id: true, name: true, parentId: true, type: true, updatedAt: true }
    : undefined,
  // full mode only: relations + counts are expensive, and invisible until a row is clicked
  include: minimal
    ? undefined
    : {
        owner: true,
        tags: true,
        versions: true,
        _count: { select: { children: true, comments: true } },
      },
  orderBy: { name: 'asc' },
})
```

**Rules**
- `minimal` is opt-**in** at the call site, not a magic default — the detail view must keep
  its full payload.
- The minimal field list is the tree-builder's contract. If the tree needs a new field,
  add it there deliberately; do not "just drop the select".
- Never compute a count for a row the user cannot see the count of.
- Detail data belongs in a separate, lazily-fetched, per-id query fired on click.

Details, framework variants (Prisma / TypeORM / Drizzle / raw SQL / GraphQL): `references/payload-slimming.md`

### Lever 2 — Right-size the page, then cache it

**The problem.** `use-all-folders-query.ts` paged at 200 rows — but each row was a **full**
payload. So we made many round trips AND each trip was fat. Worst of both worlds. There was
also no `staleTime`, so every remount refetched the whole tree.

**The fix.** Slim rows first (lever 1), *then* raise the page size, *then* cache.

```ts
export function useAllFoldersQuery() {
  return useQuery({
    queryKey: ['folders', 'all', 'minimal'],
    queryFn: async () => {
      const started = performance.now()
      // minimal=true + 1000/page: slim rows make a big page cheap.
      // Before: 200/page with full payloads = many trips, each one fat.
      const res = await fetch('/api/folders?minimal=true&pageSize=1000')
      const data = await res.json()
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `[bigdata] folders minimal fetch: ${data.items.length} rows in ` +
          `${Math.round(performance.now() - started)}ms`,
        )
      }
      return data
    },
    staleTime: 5 * 60 * 1000, // 5 min — folder structure is not real-time data
  })
}
```

**Rules**
- Page size and payload width are **one decision**, never two. 1000 slim rows can be
  cheaper than 200 fat ones. Measure both numbers before picking.
- `staleTime` must match how fast the data actually changes. Structural/reference data
  (folders, categories, chart-of-accounts, org units) = minutes. Balances/live status = seconds or 0.
- Leave a dev-only `console.warn` with row count + elapsed ms behind. It is how the next
  person notices a regression, and it costs nothing in production.
- Invalidate the cache key explicitly on create/rename/move/delete. A `staleTime` without
  invalidation is a stale-UI bug.

Details: `references/caching-and-pagination.md`

### Lever 3 — Kill O(n^2) on the client

**The problem.** `buildFolderHierarchy` in `documents-page.tsx` used nested loops: for every
item, it scanned the entire array again to find that item's children/parent.

- 1,000 items → up to 1,000 x 1,000 = **1,000,000 operations**
- 5,000 items → 25,000,000. It does not degrade, it falls off a cliff.

**The fix.** Two linear passes and a hash map.

```ts
// PASS 1 — group every item by its parentId. One loop. O(n).
const childrenByParent = new Map<string | null, Item[]>()
for (const item of items) {
  const key = item.parentId ?? null
  const bucket = childrenByParent.get(key)
  if (bucket) bucket.push(item)
  else childrenByParent.set(key, [item])
}

// PASS 2 — attach children by direct O(1) map lookup. One loop. O(n).
const nodes = items.map((item) => ({
  ...item,
  children: childrenByParent.get(item.id) ?? [],
}))

const roots = childrenByParent.get(null) ?? []
// 1,000 items ≈ 2,000 operations instead of 1,000,000.
```

**Rules**
- The tell: a `.find()` / `.filter()` / `.some()` whose input array is the array you are
  already looping over. Every one of those is a candidate for a pre-built `Map`.
- Build the index (`Map`) **once**, outside the loop. Building it inside the loop is the
  same O(n^2) with extra allocation.
- Use `Map`, not a plain object, for id keys — no prototype collisions, better perf on
  large key sets, and `null` is a legal key for roots.
- Memoize the built tree (`useMemo`) on the raw array reference, so it does not rebuild on
  every unrelated render.
- Guard against cycles and orphans: an item whose `parentId` points at a missing/deleted row
  must surface at root, not vanish.

Details, plus the same trick for joins, lookups, dedupe, and grouping: `references/algorithmic-complexity.md`

### Lever 4 — Index the database, then verify the code actually uses the index

**The problem, part A.** Search over document names/content was a sequential scan.

**The fix, part A.** A trigram (`pg_trgm`) GIN index makes `ILIKE '%needle%'` indexable —
plain B-tree indexes cannot help a leading-wildcard search.

```sql
-- prisma/sql/manual_document_search_trgm.sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CONCURRENTLY: deliberately slower to build, but it does NOT lock the table,
-- so the app stays fully usable while the index is created. On a live system
-- this is the only acceptable way to add an index to a big table.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_name_trgm
  ON "Document" USING gin (name gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_folder_name_trgm
  ON "Folder" USING gin (name gin_trgm_ops);

-- Hot access path for the tree: children of a folder, ordered by name.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_parent_name
  ON "Document" ("parentId", name);
```

Run it, expect it to take a while, and expect exactly this output:

```
$ docker exec -i doc-mgmt-postgres psql -U docmgmt -d docmgmt_db < prisma/sql/manual_document_search_trgm.sql
CREATE EXTENSION
CREATE INDEX
CREATE INDEX
CREATE INDEX
```

**The problem, part B — the one that actually bites.** An index only helps if the query
*shape* can use it. In the origin case the **badge/count generation code queried on
non-indexed derived values**, so all that index-building bought nothing on that path.

**The fix, part B.** Audit every query that touches the newly indexed table and make it hit
the index:

| Index-defeating code | Index-using replacement |
|---|---|
| `WHERE LOWER(name) = $1` | `WHERE name ILIKE $1` with a trigram index, or store+index a `nameLower` column |
| `WHERE CAST(id AS text) = $1` | compare on the column's own type |
| `WHERE date_trunc('day', "createdAt") = $1` | `WHERE "createdAt" >= $1 AND "createdAt" < $1 + interval '1 day'` |
| count computed in app code over a fetched array | `COUNT(*)` with a `GROUP BY` on the indexed column |
| filter in JS after `findMany()` | move the predicate into `where` on an indexed column |
| `ORDER BY` on a column not in the index | extend the composite index to cover the sort |

**Rules**
- Always `CREATE INDEX CONCURRENTLY` on a table that is live. Never a bare `CREATE INDEX`
  on a big production table — it takes an `ACCESS EXCLUSIVE` lock and stalls the app.
- `CONCURRENTLY` cannot run inside a transaction block — keep it out of the migration
  runner if the runner wraps migrations in a transaction; ship it as a manual SQL script
  (that is why the origin file is `prisma/sql/manual_*.sql`).
- A `CONCURRENTLY` build can fail and leave an `INVALID` index. Check
  `pg_index.indisvalid`, drop and rebuild if invalid.
- **Prove it with `EXPLAIN (ANALYZE, BUFFERS)`** before and after. `Seq Scan` on a big table
  in the "after" plan means the fix did not land.
- Every index costs write throughput and disk. Add the ones the query plan asks for, not a
  speculative index per column.

Details — Postgres/MySQL/Mongo variants, EXPLAIN reading, index bloat: `references/database-indexing.md`

---

## 3. Order of operations

Fix in this order. Each step shrinks the problem the next step has to solve, and stopping
early is often correct.

1. **Measure** — row counts, payload bytes, response ms, render ms. Write them down.
2. **Lever 1: slim the payload.** Biggest win, zero risk, no schema change.
3. **Lever 2: page size + `staleTime`.** Only meaningful once rows are slim.
4. **Lever 3: fix O(n^2).** Pure client-side, fully testable, no deploy risk.
5. **Lever 4: indexes** — `CONCURRENTLY`, then audit every query for index usage.
6. **Re-measure and report the deltas.** Same four numbers as step 1.
7. Only if still slow: virtualization, streaming/cursor pagination, denormalized read
   models, materialized views, background aggregation.

Do not start at step 7. Teams reach for caching layers and read replicas to paper over an
O(n^2) loop and a missing `select`.

---

## 4. Measurement protocol

Never claim a speedup without both numbers. Report as a before → after table.

| Metric | How |
|---|---|
| Row count | the actual production-scale count, not the dev seed |
| Payload bytes | DevTools Network → Size (uncompressed) |
| Server time | log elapsed ms around the query; or `EXPLAIN (ANALYZE, BUFFERS)` |
| Client build time | `performance.now()` around the transform |
| Render time | React Profiler / `performance.mark` |
| Query plan | `EXPLAIN (ANALYZE, BUFFERS)` — look for `Seq Scan` vs `Index Scan` |

Test at realistic scale. A 50-row dev seed hides every problem in this document — seed
10k–100k rows before believing anything.

---

## 5. Anti-patterns — reject these on sight

- `select *` / no `select` on a list endpoint.
- Relational `include` on a list view whose columns do not render the relation.
- `_count` / `COUNT(*)` per row of a list.
- `.find()` or `.filter()` inside a loop over the same collection.
- Fetching everything then filtering, sorting, or slicing in JavaScript.
- A page size picked without knowing the per-row payload size.
- `staleTime: 0` (or unset) on structural data that changes once a week.
- `CREATE INDEX` without `CONCURRENTLY` on a live, large table.
- Adding an index and never running `EXPLAIN` to confirm it is used.
- A function wrapped around a column in `WHERE` (`LOWER`, `CAST`, `date_trunc`) — it kills
  the index on that column silently.
- Different code paths (list vs badge vs export vs search) querying the same table with
  different, inconsistent predicates — only some of them indexed.
- Claiming a performance win without before/after numbers.

---

## 6. Reference files

Load these on demand; do not read them all up front.

- `references/audit-checklist.md` — the run-this-first checklist, with grep commands.
- `references/payload-slimming.md` — `minimal` mode across Prisma, Drizzle, TypeORM, raw SQL, GraphQL, REST.
- `references/algorithmic-complexity.md` — hash-map patterns: grouping, joins, dedupe, lookups, cycle-safe trees.
- `references/caching-and-pagination.md` — page sizing, `staleTime`, cursor vs offset, invalidation, virtualization.
- `references/database-indexing.md` — Postgres/MySQL/Mongo indexing, `CONCURRENTLY`, `EXPLAIN`, index-defeating predicates.
