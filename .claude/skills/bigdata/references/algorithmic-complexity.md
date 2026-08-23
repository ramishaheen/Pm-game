# Algorithmic Complexity — Hash Maps Instead of Nested Loops

**Principle:** if you are searching a collection while looping over that same collection, you
are doing O(n^2) work. Build an index once (a `Map`), then look up in O(1).

Scale of the difference:

| Items | Nested loops (n^2) | Two passes + map (2n) |
|---:|---:|---:|
| 100 | 10,000 | 200 |
| 1,000 | 1,000,000 | 2,000 |
| 5,000 | 25,000,000 | 10,000 |
| 20,000 | 400,000,000 | 40,000 |

O(n^2) does not degrade gracefully. It is fine in dev with 50 rows and freezes the tab at 5,000.

## Pattern 1 — Building a tree / hierarchy

**Before (O(n^2)) — the shape to hunt for:**
```ts
function buildFolderHierarchy(items: Item[]): Node[] {
  return items
    .filter((i) => i.parentId === null)
    .map((root) => ({
      ...root,
      // for EVERY item, scan the ENTIRE array again
      children: items.filter((i) => i.parentId === root.id).map(/* ...recurses, scanning again */),
    }))
}
```

**After (O(n)) — single-pass grouping, then direct lookup:**
```ts
type Node<T> = T & { children: Node<T>[] }

export function buildHierarchy<T extends { id: string; parentId: string | null }>(
  items: T[],
): Node<T>[] {
  // PASS 1: one loop, bucket every item under its parentId
  const childrenByParent = new Map<string | null, T[]>()
  for (const item of items) {
    const key = item.parentId ?? null
    const bucket = childrenByParent.get(key)
    if (bucket) bucket.push(item)
    else childrenByParent.set(key, [item])
  }

  // PASS 2: one loop, attach children by O(1) lookup
  const nodeById = new Map<string, Node<T>>()
  for (const item of items) {
    nodeById.set(item.id, { ...item, children: [] } as Node<T>)
  }
  for (const node of nodeById.values()) {
    for (const child of childrenByParent.get(node.id) ?? []) {
      const childNode = nodeById.get(child.id)
      if (childNode) node.children.push(childNode)
    }
  }

  // Roots = explicit roots + orphans (parentId points at a row we do not have).
  // Orphans must surface, never silently disappear.
  const roots: Node<T>[] = []
  for (const node of nodeById.values()) {
    const parentId = node.parentId
    if (parentId === null || !nodeById.has(parentId)) roots.push(node)
  }
  return roots
}
```

**Cycle safety.** A corrupted `parentId` chain (A → B → A) makes naive recursion hang.
The version above never recurses, so it cannot hang; if you do recurse, carry a `Set` of
visited ids and bail on a repeat.

**Memoize it:**
```ts
const tree = useMemo(() => buildHierarchy(items), [items])
```
Stable input reference in, stable tree out — no rebuild on unrelated renders.

## Pattern 2 — Joining two collections

```ts
// BEFORE: O(n*m)
const rows = docs.map((d) => ({ ...d, owner: users.find((u) => u.id === d.ownerId) }))

// AFTER: O(n+m)
const userById = new Map(users.map((u) => [u.id, u]))
const rows = docs.map((d) => ({ ...d, owner: userById.get(d.ownerId) }))
```

## Pattern 3 — Membership tests

```ts
// BEFORE: O(n*m) — array.includes scans
const selected = docs.filter((d) => selectedIds.includes(d.id))

// AFTER: O(n+m)
const selectedSet = new Set(selectedIds)
const selected = docs.filter((d) => selectedSet.has(d.id))
```
A `Set` for `selectedIds` in component state pays for itself the moment selection exceeds a
handful of rows.

## Pattern 4 — Grouping / aggregating

```ts
// BEFORE: O(n*k) — one full scan per group
const byType = types.map((t) => ({ type: t, items: docs.filter((d) => d.type === t) }))

// AFTER: O(n)
const byType = new Map<string, Doc[]>()
for (const d of docs) {
  const bucket = byType.get(d.type)
  if (bucket) bucket.push(d)
  else byType.set(d.type, [d])
}
```
`Object.groupBy` / `Map.groupBy` do the same thing natively where available.

## Pattern 5 — Dedupe

```ts
// BEFORE: O(n^2)
const unique = items.filter((it, i) => items.findIndex((o) => o.id === it.id) === i)

// AFTER: O(n)
const unique = [...new Map(items.map((it) => [it.id, it])).values()]
```

## Pattern 6 — Ancestor path / breadcrumbs

```ts
const byId = new Map(items.map((i) => [i.id, i]))

function pathTo(id: string): Item[] {
  const path: Item[] = []
  const seen = new Set<string>()          // cycle guard
  let cur = byId.get(id)
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    path.unshift(cur)
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
  }
  return path
}
```
Build `byId` once and reuse it for every breadcrumb, not once per breadcrumb.

## `Map` vs plain object

Prefer `Map` for id-keyed indexes:
- no prototype-key collisions (`__proto__`, `constructor`)
- keys keep their type; `null` is a legal key (useful for tree roots)
- better performance on large, frequently-mutated key sets
- `.size` is O(1); `Object.keys(o).length` allocates an array

## How to spot it in review

Any of these is a finding:
- `.find(` / `.filter(` / `.some(` / `.includes(` / `.indexOf(` inside `.map(` or a `for` loop
  over the same or a comparably-sized collection
- two nested loops over arrays that both scale with data volume
- a recursive tree builder that takes the full array as an argument at every level
- `sort()` called inside a loop
- an index (`Map`/`Set`) constructed **inside** the loop that uses it

## Measuring

```ts
const t0 = performance.now()
const tree = buildHierarchy(items)
console.warn(`[bigdata] tree: ${items.length} items in ${(performance.now() - t0).toFixed(1)}ms`)
```
Test with 10k+ items. At 50 items both implementations look identical — that is exactly how
this ships to production.
