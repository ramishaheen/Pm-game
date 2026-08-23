# Payload Slimming — `minimal` mode

**Principle:** a list view is not a detail view. Fetch exactly the fields that are painted on
screen right now. Everything else is bytes on the wire, rows in the query plan, and memory in
the browser, in exchange for nothing.

The origin case: a document list returned every field + relational includes + per-row counts.
None of it was visible until the user clicked a file. Adding `minimal=true` — which skips the
relational includes and count queries entirely and returns only the bare fields the
tree-builder needs — was the single largest win.

## The contract

Define the minimal field set as an explicit, named contract, not an ad-hoc `select`:

```ts
// The exact fields the folder/file tree needs to render structure. Nothing else.
export const MINIMAL_DOCUMENT_SELECT = {
  id: true,
  name: true,
  parentId: true,
  type: true,
  updatedAt: true,
} as const

export type MinimalDocument = Prisma.DocumentGetPayload<{
  select: typeof MINIMAL_DOCUMENT_SELECT
}>
```

Now the tree-builder is typed against `MinimalDocument`, and if someone renders a field the
minimal query does not fetch, it fails at compile time instead of at 3am.

## API surface

```ts
// app/api/documents/route.ts
export async function GET(req: Request) {
  const url = new URL(req.url)
  const minimal = url.searchParams.get('minimal') === 'true'
  const pageSize = Math.min(Number(url.searchParams.get('pageSize') ?? 200), 1000)

  const rows = await prisma.document.findMany({
    where,
    ...(minimal
      ? { select: MINIMAL_DOCUMENT_SELECT }
      : {
          include: {
            owner: { select: { id: true, name: true, avatarUrl: true } },
            tags: true,
            _count: { select: { children: true, comments: true } },
          },
        }),
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
    take: pageSize,
    skip: (page - 1) * pageSize,
  })

  return Response.json({ items: rows, page, pageSize })
}
```

Note `minimal` is opt-in per request. The detail view keeps the rich payload; only the list
and tree consumers ask for `minimal=true`.

## Framework variants

**Prisma** — `select` and `include` are mutually exclusive. `select` wins for minimal mode.
Nested `select` inside `include` still beats a bare `include` when you do need a relation.

**Drizzle**
```ts
db.select({ id: docs.id, name: docs.name, parentId: docs.parentId, type: docs.type })
  .from(docs).where(eq(docs.workspaceId, id)).limit(1000)
```

**TypeORM**
```ts
repo.createQueryBuilder('d')
  .select(['d.id', 'd.name', 'd.parentId', 'd.type'])
  .where('d.workspaceId = :id', { id })
  .take(1000)
  .getMany()   // no `relations:` — that is the include you are avoiding
```

**Raw SQL** — never `SELECT *` on a list endpoint. Name the columns. A narrow projection can
also enable an **index-only scan**, where Postgres answers entirely from the index and never
touches the heap.

**Mongo**
```js
db.documents.find({ workspaceId }, { _id: 1, name: 1, parentId: 1, type: 1 }).limit(1000)
```

**GraphQL** — the client already controls the field set; the risk is resolvers that eagerly
load relations regardless. Use DataLoader, and check `info.fieldNodes` before doing expensive
relation work.

## The count-query trap

`_count` / `COUNT(*)` per row is a hidden N+1: it is a separate aggregate per row, often the
most expensive part of a "simple" list query.

Options, cheapest first:
1. **Don't show the count in the list.** Usually nobody needs it there.
2. **Denormalize** — a `childCount` column updated on write. Reads become free.
3. **One grouped query** — `SELECT "parentId", COUNT(*) FROM "Document" GROUP BY "parentId"`
   returns every count in a single indexed pass; join it in memory via a `Map`.
4. **Lazy** — fetch counts only for expanded/visible rows.

## Detail-on-demand

```ts
// fired only when a row is actually clicked
export function useDocumentDetail(id: string | null) {
  return useQuery({
    queryKey: ['document', id],
    queryFn: () => fetch(`/api/documents/${id}`).then((r) => r.json()),
    enabled: id != null,      // no id, no request
    staleTime: 60 * 1000,
  })
}
```

Optionally prefetch on hover/focus so the click still feels instant — with 1 request for
1 row instead of the full payload for 10,000.

## Verifying the win

```bash
# payload bytes, minimal vs full
curl -s "$API/documents?minimal=true&pageSize=1000" | wc -c
curl -s "$API/documents?pageSize=1000"              | wc -c
```

Also watch the **query count** (Prisma `log: ['query']`, or `pg_stat_statements`). Dropping
includes and counts usually collapses a dozen queries per request into one.

## Checklist

- [ ] Explicit projection on every list query.
- [ ] Minimal field set defined once, exported, and typed.
- [ ] No relational includes on list views.
- [ ] No per-row aggregates on list views.
- [ ] Detail fetched lazily by id.
- [ ] Before/after payload bytes and query count recorded.
