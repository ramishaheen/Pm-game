# Database Indexing — And Making Sure the Code Actually Uses It

**Two-part principle.** Part A: build the right index, without locking the table. Part B — the
part that actually bites — **verify every code path that reads the table hits that index**.
In the origin case, badge/count generation queried on non-indexed derived values, so a
correctly-built index bought nothing on that path until the query was rewritten.

## Part A — Building the index

### Trigram indexes for substring search

A B-tree index cannot serve `ILIKE '%needle%'` — the leading wildcard makes it useless.
`pg_trgm` + GIN can.

```sql
-- prisma/sql/manual_document_search_trgm.sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CONCURRENTLY builds slower on purpose: it does NOT take an ACCESS EXCLUSIVE lock,
-- so the application stays fully usable while the index builds. On a live table with
-- real data volume this is the only acceptable way to add an index.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_name_trgm
  ON "Document" USING gin (name gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_folder_name_trgm
  ON "Folder" USING gin (name gin_trgm_ops);

-- Hot path for the tree: children of a folder, ordered by name.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_parent_name
  ON "Document" ("parentId", name);
```

Apply it and expect it to take a while:
```bash
docker exec -i doc-mgmt-postgres psql -U docmgmt -d docmgmt_db < prisma/sql/manual_document_search_trgm.sql
# CREATE EXTENSION
# CREATE INDEX
# CREATE INDEX
# CREATE INDEX
```

`GIN` vs `GiST` for trigrams: GIN is faster to search, slower to build and update — right for
read-heavy search columns. GiST is smaller and cheaper to update — right for
write-heavy columns or when you also need similarity ranking with `%` / `<->`.

### `CONCURRENTLY` — the operational rules

- **Always** use it on a table that is live and large. A bare `CREATE INDEX` takes an
  `ACCESS EXCLUSIVE` lock: every read and write on that table blocks until the build finishes.
- It **cannot run inside a transaction block**. Most migration runners wrap migrations in a
  transaction, so ship it as a standalone SQL script (hence `prisma/sql/manual_*.sql`) run
  outside the migration pipeline, and record it in the runbook.
- It does **two** table passes, so it takes roughly twice as long. That is the trade you are
  making for zero downtime. Expect minutes to hours on a big table.
- It can **fail and leave an INVALID index** behind — which costs writes and serves no reads.
  Always check afterwards:

```sql
SELECT c.relname AS index_name
FROM pg_class c
JOIN pg_index i ON i.indexrelid = c.oid
WHERE i.indisvalid = false;
-- then: DROP INDEX CONCURRENTLY <name>;  and rebuild
```

- `DROP INDEX CONCURRENTLY` exists too — use it for the same reason.

### Composite index ordering

Column order decides usability. For `WHERE parentId = $1 ORDER BY name`:

```sql
CREATE INDEX CONCURRENTLY idx_document_parent_name ON "Document" ("parentId", name);
```

- **Equality columns first, then range/sort columns.**
- An index on `(a, b)` serves `WHERE a`, and `WHERE a AND b` — but **not** `WHERE b` alone.
- Put the sort column in the index to avoid a separate sort step in the plan.
- Partial indexes for a permanently-filtered subset are much smaller and faster:

```sql
CREATE INDEX CONCURRENTLY idx_document_active_parent
  ON "Document" ("parentId", name) WHERE "deletedAt" IS NULL;
```

### Prisma schema indexes

```prisma
model Document {
  id        String   @id @default(cuid())
  name      String
  parentId  String?
  type      String
  deletedAt DateTime?

  @@index([parentId, name])
  @@index([type, parentId])
}
```
Prisma cannot express trigram/GIN indexes — those stay in a manual SQL file. Keep that file in
version control next to the schema, and reference it in the README so it is not forgotten on a
fresh environment.

## Part B — Making the code hit the index

This is the failure mode that wastes an index build. Any function or cast applied to the
column in `WHERE` makes the index unusable, silently — no error, no warning, just a `Seq Scan`.

| Index-defeating | Index-using |
|---|---|
| `WHERE LOWER(name) = $1` | `WHERE name ILIKE $1` (trigram index), or store + index a `nameLower` column |
| `WHERE CAST(id AS text) = $1` | compare on the column's native type |
| `WHERE date_trunc('day', "createdAt") = $1` | `WHERE "createdAt" >= $1 AND "createdAt" < $1 + interval '1 day'` |
| `WHERE "createdAt" + interval '1 day' > now()` | `WHERE "createdAt" > now() - interval '1 day'` |
| `WHERE name LIKE '%x%'` with only a B-tree index | trigram GIN index, or anchor it: `LIKE 'x%'` |
| `WHERE a = $1 OR b = $2` | two indexed queries `UNION`ed, or an index on each column |
| `WHERE tags::text LIKE ...` | a proper GIN index on the array/jsonb column |
| counts computed in app code over a fetched array | `COUNT(*) ... GROUP BY <indexed column>` |
| `findMany()` then `.filter()` in JS | move the predicate into `where` on an indexed column |
| `ORDER BY` a column absent from the index | extend the composite index to cover the sort |

If you genuinely need a function in the predicate, index the expression itself:
```sql
CREATE INDEX CONCURRENTLY idx_document_name_lower ON "Document" (LOWER(name));
```
The expression in the index must match the expression in the query **exactly**.

### Audit every path, not just the slow one

The list query, the badge/count query, search, export, and background jobs frequently drift
apart. Grep for every read of the table and check each one's predicate against the indexes:

```bash
rg -n "prisma\.document\.(findMany|findFirst|count|aggregate|groupBy)" --type ts
rg -n 'FROM "Document"' -i
```

Standardise on shared, indexed query helpers so badges, lists, and search cannot diverge again.

## Proving it — `EXPLAIN`

```sql
EXPLAIN (ANALYZE, BUFFERS) SELECT id, name, "parentId", type
FROM "Document" WHERE "parentId" = 'abc' ORDER BY name LIMIT 1000;
```

Read the plan for:
- `Seq Scan` on a big table → the index is missing or not usable by this predicate. **Finding.**
- `Index Scan` / `Bitmap Index Scan` / `Index Only Scan` → good. `Index Only Scan` is best:
  the query is answered from the index without touching the heap (needs a narrow projection).
- `Rows Removed by Filter: <large>` → the index found far more rows than were kept; the
  predicate is not selective, consider a composite or partial index.
- `Sort` with a big `Sort Method: external merge Disk` → add the sort column to the index.
- Estimated vs actual rows off by an order of magnitude → stats are stale, `ANALYZE "Document";`

Capture the before and after plans in the PR. "Added an index" without a plan is not evidence.

## Health queries

```sql
-- what exists
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'Document';

-- index sizes
SELECT indexrelname, pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes WHERE relname = 'Document' ORDER BY pg_relation_size(indexrelid) DESC;

-- unused indexes: pure write cost, no read benefit
SELECT relname, indexrelname, idx_scan FROM pg_stat_user_indexes
WHERE idx_scan = 0 ORDER BY relname;

-- tables taking the most sequential scan damage
SELECT relname, seq_scan, seq_tup_read, idx_scan
FROM pg_stat_user_tables ORDER BY seq_tup_read DESC LIMIT 20;

-- slowest statements (needs pg_stat_statements)
SELECT calls, round(mean_exec_time::numeric, 2) AS mean_ms, left(query, 120)
FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 20;
```

## Costs — do not over-index

Every index slows `INSERT`/`UPDATE`/`DELETE` and consumes disk and cache. Add the indexes the
query plans ask for; drop the ones `idx_scan = 0` proves nobody uses. After heavy churn,
`REINDEX INDEX CONCURRENTLY <name>` reclaims bloat.

## Other engines

**MySQL/InnoDB** — `ALTER TABLE ... ADD INDEX` is mostly online (`ALGORITHM=INPLACE, LOCK=NONE`),
but verify per version. No trigram indexes: use `FULLTEXT` for word search, or a prefix index
for `LIKE 'x%'`. `EXPLAIN FORMAT=JSON` for plans; watch for `type: ALL` (full scan).

**MongoDB** — `db.coll.createIndex({ parentId: 1, name: 1 }, { background: true })` (implicit
and non-blocking from 4.2). Use `.explain('executionStats')` and check for `COLLSCAN`.
Compound-index prefix rules mirror Postgres. Text search needs a `text` index.

**SQLite** — `CREATE INDEX` locks, but databases are usually small enough not to matter;
`ANALYZE` matters more than most people expect. `EXPLAIN QUERY PLAN` shows `SCAN` vs `SEARCH`.

## Checklist

- [ ] Every `WHERE` / `JOIN` / `ORDER BY` column on a large table is indexed.
- [ ] Substring search is backed by a trigram (or full-text) index.
- [ ] Composite indexes ordered equality-first, sort column included.
- [ ] Every index on a live table created `CONCURRENTLY`, outside a transaction.
- [ ] No `INVALID` indexes left behind.
- [ ] No function or cast wrapped around a column in any predicate.
- [ ] **Every** read path on the table audited — list, badge/count, search, export, jobs.
- [ ] `EXPLAIN (ANALYZE, BUFFERS)` before and after, captured in the PR.
- [ ] No speculative indexes; unused ones dropped.
