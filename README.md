# LRU Cache

**A fixed-capacity, in-memory LRU (Least Recently Used) cache in TypeScript — with a guaranteed O(1) `get` and `put`, built from a Hash Map and a Doubly Linked List working in tandem.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A518-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/tests-76%20passing-success?logo=jest&logoColor=white)](#testing)
[![Coverage](https://img.shields.io/badge/coverage-100%25-success)](#testing)
[![Strict](https://img.shields.io/badge/strict--typed-blue)](tsconfig.json)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

```ts
const cache = new LRUCache<string, User>(1000);

cache.put('u:42', user);
cache.get('u:42');   // → user, and it is now the most recently used
```

No dependencies. No `setInterval` sweeper. No hidden `O(n)` scan.

---

## Contents

- [The problem](#the-problem)
- [The idea in one picture](#the-idea-in-one-picture)
- [Why two data structures](#why-two-data-structures)
- [A walkthrough](#a-walkthrough)
- [Two details that make it O(1)](#two-details-that-make-it-o1)
- [Complexity](#complexity)
- [Benchmarks](#benchmarks)
- [Installation](#installation)
- [API](#api)
- [Project structure](#project-structure)
- [Testing](#testing)
- [Design decisions](#design-decisions)
- [License](#license)

---

## The problem

A cache has limited room. When it is full and something new arrives, one entry has to go. The LRU policy picks the entry **nobody has touched for the longest time** — the best guess at what will be missed least.

Implementing that policy is where it gets interesting, because a cache must answer two very different questions on *every single operation*:

1. **"Where is the entry for this key?"** — a lookup problem.
2. **"Which entry is the least recently used?"** — an ordering problem.

Neither of the obvious single-structure solutions can answer both quickly:

| Approach | Lookup | Find the LRU entry | Verdict |
| --- | --- | --- | --- |
| `Map` alone | ✅ O(1) | ❌ O(n) — must scan every entry to compare timestamps | Reads are fast, eviction crawls |
| Array / sorted list alone | ❌ O(n) | ✅ O(1) — it is at the end | Eviction is fast, reads crawl |
| `Map` + timestamps | ✅ O(1) | ❌ O(n) — still has to find the minimum | Only looks clever |
| **Map + doubly linked list** | ✅ **O(1)** | ✅ **O(1)** | ✔ this project |

The insight: **use one structure for each question, and connect them so no operation ever has to search.**

---

## The idea in one picture

The Map stores keys. The list stores *order*. And the Map does not point at values — **it points at the list nodes themselves**.

```text
   Map (lookup)        "a" ──┐        "b" ──┐        "c" ──┐
                             │              │              │
                             ▼              ▼              ▼
   List (recency)   head ⇄ [ c ] ⇄ [ b ] ⇄ [ a ] ⇄ tail
                  (sentinel)  ▲                ▲   (sentinel)
                              │                │
                       most recently    least recently used
                            used         → evicted first
```

That one design choice is what makes everything else constant time:

- A **lookup** hands back the exact node — not a copy, not an index, the node.
- Because you hold the node, you can **re-link it to the front immediately**, without walking the list to find it.
- Because the list is always in recency order, the **eviction victim is already sitting at a known address** — just before the tail. Nothing is searched, nothing is compared, nothing is sorted.

---

## Why two data structures

### The Map solves lookup, but is blind to order

`Map` gives you constant-time access by key, but it has no notion of "recently used". Finding the oldest entry means examining every entry — O(n), on every single insert once the cache is full.

### The list solves order, but is blind to lookup

A list keeps entries in recency order, so the oldest is always at the end. But finding a *specific* key in it means walking from one end — O(n), on every single read.

### Together, each covers the other's blind spot

The Map never has to think about order; the list never has to search. Every operation is a fixed handful of pointer assignments, whether the cache holds ten entries or ten million.

### Why the list has to be *doubly* linked

Promoting an entry means pulling it out of the middle of the list. To unlink node `B`, its neighbours `A` and `C` have to be joined:

```text
before:   [ A ] ⇄ [ B ] ⇄ [ C ]
after:    [ A ] ⇄────────⇄ [ C ]          B moves to the front
```

With a `prev` pointer, `B` already knows both neighbours and joins them in constant time. In a **singly** linked list, `B` would only know `C` — finding `A` would mean walking from the head, which is O(n) and would sink the entire design. The second pointer is not decoration; it is the whole reason the promotion is O(1).

---

## A walkthrough

A cache with capacity 2, one operation at a time:

```ts
const cache = new LRUCache<string, number>(2);
```

| Operation | What happens internally | List (newest → oldest) |
| --- | --- | --- |
| `put('a', 1)` | New node, added to Map + front of list | `a` |
| `put('b', 2)` | New node, added to front | `b → a` |
| `get('a')` → `1` | Hit: node found via Map, moved to front | `a → b` |
| `put('c', 3)` | Full → evict the node before the tail (`b`), then insert | `c → a` |
| `get('b')` → `undefined` | Miss: `b` was evicted. **Order untouched** | `c → a` |
| `put('a', 9)` | Key exists → overwrite value, move to front. **Nothing is evicted** | `a → c` |

Two behaviours worth pointing out, because they are exactly where naive implementations go wrong:

- **`get('a')` changed the eviction outcome.** Without that read, `put('c', 3)` would have evicted `a`. LRU evicts by *recency of use*, never by insertion order.
- **`put('a', 9)` on an existing key evicted nothing.** The entry count did not grow, so nothing needed to leave. An implementation that evicts on every `put` silently loses data.

---

## Two details that make it O(1)

### 1. Sentinel (dummy) head and tail nodes

The list is bounded by two permanent placeholder nodes that hold no data and are never handed to callers.

Without them, every insert and remove has to ask: *is the list empty? is this the first node? is this the last one?* Each `yes` needs its own branch that updates a `head`/`tail` field instead of a neighbour's pointer — and that is precisely where linked-list bugs breed.

With sentinels, **every real node is guaranteed to have both a `prev` and a `next`**, even when it is the only node in the list. One unconditional rewiring covers every case:

```ts
public addToFront(node: Node<K, V>): void {
  const first = this.head.next!;   // never null: at worst it is the tail sentinel

  node.prev = this.head;
  node.next = first;
  this.head.next = node;
  first.prev = node;

  this.length++;
}
```

No `if`. No empty-list case. The special cases were not *handled* — they were designed out of existence.

### 2. Each node stores its own key

Intuitively a node only needs to hold a value; the key is already the Map's key. But eviction runs in the opposite direction:

1. The list identifies the victim node (at the tail).
2. That entry must also be removed **from the Map**.
3. `map.delete(...)` needs a **key**.

Without a key stored on the node, the only way to find which Map entry points at it would be to scan the whole Map — O(n), destroying the guarantee the architecture exists for. One back-reference keeps eviction constant time:

```ts
private evictLeastRecentlyUsed(): void {
  const lru = this.list.removeLast();   // O(1) — it is always just before the tail
  this.map.delete(lru.key);             // O(1) — thanks to the stored key
}
```

---

## Complexity

| Operation | Time | Space | Why |
| --- | --- | --- | --- |
| `get(key)` | **O(1)** | — | One Map lookup + a constant-time re-link |
| `put(key, value)` — new | **O(1)** | O(1) | One Map insert + four pointer writes |
| `put(key, value)` — existing | **O(1)** | — | Value overwritten in place, node promoted |
| `put(key, value)` — evicting | **O(1)** | — | Victim is at a known position; no search |
| `has(key)` / `peek(key)` | **O(1)** | — | Map lookup only, order untouched |
| `delete(key)` | **O(1)** | — | Unlink via known neighbours + Map delete |
| `clear()` | **O(1)** | — | Sentinels re-linked; the old chain is collected wholesale |
| `keys()` | O(n) | O(n) | Debug/inspection helper — never on the hot path |
| **Total** | | **O(capacity)** | Memory is bounded by capacity, not by traffic |

---

## Benchmarks

1,000,000 operations, Node.js v24, on an ordinary laptop:

```text
put w/ eviction   (capacity 1,000)                55 ms     18.0 M ops/s
put w/ eviction   (capacity 100,000)             114 ms      8.8 M ops/s
put w/ eviction   (capacity 1,000,000)           181 ms      5.5 M ops/s

get hit + promote (capacity 1,000)                 8 ms    129.3 M ops/s
get hit + promote (capacity 100,000)              21 ms     48.3 M ops/s
get hit + promote (capacity 1,000,000)            58 ms     17.2 M ops/s

after 5,000,000 inserts -> size = 10000 (capacity 10,000)
```

The `put` runs evict on nearly every call, and each `get` is a hit that forces a promotion to the head — so these are the expensive paths, not a favourable one.

**Reading the numbers honestly:** growing the capacity **1000×** (1,000 → 1,000,000) makes a single operation roughly **3× slower**, not 1000× slower. The work per operation is constant; what changes is memory locality — a larger working set spills out of the CPU cache and hardware, not the algorithm, absorbs the difference. An O(n) implementation over the same range would have slowed down by three orders of magnitude.

The last line is the capacity guarantee in practice: after five million inserts the cache still holds exactly 10,000 entries, and memory stayed flat.

---

## Installation

```bash
git clone https://github.com/mertdogruluk/lru-cache.git
cd lru-cache
npm install
npm test
```

```bash
npm run build   # compile to dist/ with type declarations
```

### Usage

```ts
import { LRUCache } from './src';

interface User {
  id: number;
  name: string;
}

const users = new LRUCache<string, User>(500);

function getUser(id: string): User {
  const cached = users.get(id);        // O(1), and marks the entry as recently used
  if (cached !== undefined) {
    return cached;
  }

  const user = expensiveDatabaseCall(id);
  users.put(id, user);                 // evicts the coldest entry if full
  return user;
}
```

The cache is generic over both key and value: `LRUCache<K, V>` works with `string`, `number`, object keys — anything a `Map` accepts.

---

## API

### `new LRUCache<K, V>(capacity: number)`

Creates a cache holding at most `capacity` entries.

Throws `RangeError` if `capacity` is not a positive integer. A capacity of `0`, `1.5` or `Infinity` has no coherent eviction behaviour, so the mistake surfaces at construction instead of turning into strange behaviour months later.

| Member | Returns | Description |
| --- | --- | --- |
| `get(key)` | `V \| undefined` | Reads a value **and marks it as most recently used**. |
| `put(key, value)` | `void` | Inserts or overwrites. Evicts the LRU entry only when a *new* key overflows the capacity. |
| `has(key)` | `boolean` | Whether the key is cached — **without** counting as a use. |
| `peek(key)` | `V \| undefined` | Reads a value **without** changing the recency order. For metrics and debugging. |
| `delete(key)` | `boolean` | Removes an entry from both structures. `false` if it was not cached. |
| `clear()` | `void` | Empties the cache; capacity and usability are retained. |
| `size` | `number` | Entries currently cached. |
| `capacity` | `number` | The configured maximum. |
| `keys()` | `K[]` | Keys from most to least recently used. O(n) — for tests and debugging. |

**Note on `undefined` values:** `get` returns `undefined` for a miss, so if `V` itself can be `undefined`, use `has(key)` to tell a stored `undefined` from an absent key.

**Note on object keys:** keys are compared with `Map` semantics (SameValueZero), so objects match by **reference**, not by shape. `cache.get({ id: 1 })` will not find an entry stored under a different — even if structurally identical — object.

---

## Project structure

```text
src/
├── index.ts                  # public entry point
├── LRUCache.ts               # the cache: Map + list, capacity & eviction policy
└── core/
    ├── Node.ts               # generic node: key, value, prev, next
    └── DoublyLinkedList.ts   # recency ordering, all operations O(1)

tests/
├── Node.test.ts              #  9 tests
├── DoublyLinkedList.test.ts  # 25 tests
└── LRUCache.test.ts          # 42 tests
```

The layering is deliberate: `DoublyLinkedList` knows nothing about caching, and `LRUCache` never touches a `prev`/`next` pointer. Each piece is independently testable, and the eviction policy could be swapped without rewriting the list.

---

## Testing

```bash
npm test              # 76 tests
npm run test:coverage # 100% statements, branches, functions, lines
npm run typecheck     # tsc --noEmit
npm run lint          # eslint
```

Beyond the happy path, the suite pins down the cases where LRU implementations usually break:

- **Eviction follows use, not insertion** — reading `a` changes which entry dies next.
- **Updating an existing key evicts nothing**, even at full capacity.
- **A cache miss leaves the recency order untouched** and creates no phantom entry.
- **Falsy and `undefined` values** are stored and retrieved without being mistaken for misses.
- **Structural integrity under load** — across 5,000 mixed `put`/`get`/`delete` operations, the list length never drifts from the Map size and no key is duplicated. Drift between the two structures is the signature of a memory leak or a phantom hit.
- **Edge cases** — capacity 1, empty-list removal, double deletes, re-inserting an evicted key, clearing an empty cache.

The build is configured under TypeScript `strict` mode with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`, so the null-handling around `prev`/`next` pointers is enforced by the compiler rather than by discipline.

---

## Design decisions

**Why does the Map store nodes instead of values?** So that a lookup produces something that can be re-linked in place. If the Map stored values, promoting an entry would mean finding it in the list first — O(n), and the whole architecture collapses.

**Why evict before inserting?** So the cache never momentarily exceeds its capacity, and so the entry being inserted can never be the one evicted.

**Why do `has` and `peek` exist next to `get`?** Because inspecting a cache should not change what it evicts next. Metrics, debugging and tests need to observe without disturbing.

**Why is `key` on the node `readonly`?** A node's identity must never drift from the key it is registered under in the Map. Updating an entry replaces the value, never the key.

**Why does `unlink()` clear pointers on removal?** An evicted node holding references to its former neighbours can keep an entire chain of dropped entries reachable, defeating garbage collection. In a bounded in-memory cache that is a silent leak.

**What is intentionally *not* here?** Per-entry TTL, thread safety, async loaders and persistence are all out of scope. This project exists to demonstrate the O(1) LRU mechanism cleanly; each of those features would be a layer on top, not a change to the core.

---

## License

[MIT](LICENSE) © Mert Dogruluk
