# Pagination & Caching

**Principle:** page size and payload width are one decision. A larger page of slim rows beats
a smaller page of fat rows — fewer round trips *and* fewer bytes. Deciding them separately is
how you end up with the worst of both.

Origin case: `use-all-folders-query.ts` paged at 200 rows with full payloads. Fix: `minimal=true`
at 1000 rows/page, `staleTime: 5 * 60 * 1000`, plus a dev console warning to verify and debug.

## Sizing the page

```
target response ≈ 200KB
per-row payload (minimal) ≈ 150 bytes   → ~1300 rows fits comfortably → use 1000
per-row payload (full)    ≈ 4KB         → ~50 rows → 200/page was already 800KB
```

Measure the per-row size before choosing:
```bash
curl -s "$API/documents?minimal=true&pageSize=100" | wc -c   # ÷ 100 = bytes/row
```

Rules of thumb:
- Slim rows (structure only): 500–2000 per page.
- Rich rows (detail cards, thumbnails): 20–100 per page.
- Never above ~5000 rows in one response regardless of width — client parse + render cost
  becomes the bottleneck instead.
- If the whole set is needed for a tree, fetch it in slim mode and page through it in a loop,
  rather than fetching a fat partial set.

## `staleTime` — match the data's real volatility

| Data | `staleTime` |
|---|---|
| Folder structure, categories, chart of accounts, org units | 5–15 min |
| Reference/lookup lists, user directory | 5–30 min |
| Document lists, search results | 30s – 2 min |
| Balances, live status, notifications | 0–10s |
| Anything the current user is actively editing | 0 (invalidate on mutation) |

```ts
export function useAllFoldersQuery() {
  return useQuery({
    queryKey: ['folders', 'all', 'minimal'],
    queryFn: fetchFoldersMinimal,
    staleTime: 5 * 60 * 1000,   // structure is not real-time data
    gcTime: 30 * 60 * 1000,     // keep it around for back-navigation
  })
}
```

`staleTime` = how long before a refetch is considered necessary.
`gcTime` (`cacheTime` in v4) = how long unused data stays in memory.

## Invalidation is mandatory

A `staleTime` without invalidation is a stale-UI bug waiting to be filed.

```ts
const queryClient = useQueryClient()

const createFolder = useMutation({
  mutationFn: postFolder,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['folders'] })   // prefix match
  },
})
```

Invalidate on every structural mutation: create, rename, move, delete, restore, bulk import.

## Cache keys

Every input that changes the response belongs in the key:
```ts
queryKey: ['documents', { folderId, minimal: true, search, sort, page }]
```
Missing an input means two different result sets share one cache entry — wrong data on
screen, and it looks like a backend bug for a week.

Do **not** put unstable values (a fresh object literal built each render, `Date.now()`) in
the key; it defeats the cache entirely.

## Offset vs cursor pagination

**Offset** (`LIMIT 50 OFFSET 50000`) — Postgres reads and discards 50,000 rows to answer.
Fine for the first few pages, degrades linearly, and rows shift under the user when data
changes between pages.

**Cursor / keyset** — constant time at any depth, stable under concurrent writes:
```sql
SELECT id, name, "parentId", type
FROM "Document"
WHERE "folderId" = $1 AND (name, id) > ($2, $3)   -- last row of previous page
ORDER BY name, id
LIMIT 1000;
```
Requires an index on the sort key — `(name, id)` — and a deterministic tiebreaker (`id`),
otherwise rows can be skipped or repeated.

Use cursor pagination for infinite scroll, exports, background jobs, and anything that goes
past page ~10.

## Dev instrumentation — leave it behind

```ts
const started = performance.now()
const data = await fetchFoldersMinimal()
if (process.env.NODE_ENV !== 'production') {
  console.warn(
    `[bigdata] folders: ${data.items.length} rows, ` +
    `${(JSON.stringify(data).length / 1024).toFixed(0)}KB, ` +
    `${Math.round(performance.now() - started)}ms`,
  )
}
```
Cheap, dev-only, and it is how the next person notices when someone drops the `select`.

## Prefetching

```ts
// warm the detail cache on hover — the click then feels instant
onMouseEnter={() =>
  queryClient.prefetchQuery({
    queryKey: ['document', id],
    queryFn: () => fetchDocument(id),
    staleTime: 60_000,
  })
}
```

## Virtualization — when paging is not enough

Once slim rows and sane paging still leave thousands of DOM nodes, render only what is visible:

```tsx
import { useVirtualizer } from '@tanstack/react-virtual'

const virtualizer = useVirtualizer({
  count: rows.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 36,
  overscan: 12,
})
```

For trees, flatten the expanded tree into a linear array first, then virtualize that array.
Rebuild the flat array only when expansion state or the underlying data changes.

## Checklist

- [ ] Per-row payload measured before choosing a page size.
- [ ] Page size and `minimal` mode decided together.
- [ ] `staleTime` set and justified by the data's volatility.
- [ ] Cache key includes every input that changes the response.
- [ ] Invalidation wired on every structural mutation.
- [ ] Dev-only row-count/size/ms log in place.
- [ ] Cursor pagination anywhere the user can get past page ~10.
- [ ] Virtualization once visible rows exceed ~200.
