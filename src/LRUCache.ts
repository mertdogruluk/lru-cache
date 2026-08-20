import { DoublyLinkedList } from './core/DoublyLinkedList';
import { Node } from './core/Node';

/**
 * A fixed-capacity, in-memory LRU (Least Recently Used) cache with **O(1)** `get` and
 * `put`.
 *
 * ### The architecture in one paragraph
 * Two structures cover for each other's weakness:
 *
 * - A **Map** answers *"where is the entry for this key?"* in constant time, but knows
 *   nothing about how recently anything was used.
 * - A **doubly linked list** keeps every entry ordered by recency — newest at the head,
 *   oldest at the tail — so the eviction victim is always sitting at a known position,
 *   with nothing to search or compare.
 *
 * The trick that binds them: the Map does not store values, it stores **the list nodes
 * themselves**. So a lookup hands back the exact node, and that node can be re-linked to
 * the front immediately — no traversal anywhere in the process.
 *
 * ```text
 *   Map:  "a" ─┐   "b" ─┐   "c" ─┐
 *              ▼        ▼        ▼
 *   List: head ⇄ [ c ] ⇄ [ b ] ⇄ [ a ] ⇄ tail
 *                newest            oldest → evicted first
 * ```
 *
 * @typeParam K - Type of the cache key. Keys are compared by `Map` semantics
 *                (SameValueZero), so objects match by reference, not by shape.
 * @typeParam V - Type of the cached value.
 *
 * @example
 * ```ts
 * const cache = new LRUCache<string, number>(2);
 * cache.put('a', 1);
 * cache.put('b', 2);
 * cache.get('a');      // 1 → 'a' is now the most recently used
 * cache.put('c', 3);   // capacity exceeded → 'b' (the oldest) is evicted
 * cache.get('b');      // undefined
 * ```
 */
export class LRUCache<K, V> {
  /** Maximum number of entries held before each insert forces an eviction. */
  private readonly maxSize: number;

  /**
   * Key → node index. Deliberately maps to the **node**, not the value: holding the node
   * is what lets a hit be promoted to most-recently-used without walking the list.
   */
  private readonly map: Map<K, Node<K, V>>;

  /** Recency order. Head = most recently used, tail = next eviction candidate. */
  private readonly list: DoublyLinkedList<K, V>;

  /**
   * @param capacity - Maximum number of entries. Must be a positive integer.
   * @throws {RangeError} If `capacity` is not a positive integer. A cache with capacity
   *         `0`, a fraction or `Infinity` has no coherent eviction behaviour, so the
   *         mistake is rejected at construction rather than producing silent nonsense
   *         later.
   */
  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError(`Capacity must be a positive integer, received: ${capacity}`);
    }

    this.maxSize = capacity;
    this.map = new Map<K, Node<K, V>>();
    this.list = new DoublyLinkedList<K, V>();
  }

  /** Maximum number of entries this cache will hold. */
  public get capacity(): number {
    return this.maxSize;
  }

  /** Number of entries currently cached. */
  public get size(): number {
    return this.map.size;
  }

  /**
   * Reads a value and marks the entry as most recently used.
   *
   * **O(1)**: one Map lookup, then a constant-time re-link of a node whose neighbours are
   * already known.
   *
   * @param key - Key to look up.
   * @returns The cached value, or `undefined` on a cache miss. If `V` itself can be
   *          `undefined`, use {@link has} to tell a stored `undefined` from a miss.
   */
  public get(key: K): V | undefined {
    const node = this.map.get(key);

    // Cache miss: nothing to return and, importantly, nothing to reorder.
    if (node === undefined) {
      return undefined;
    }

    // Cache hit: this entry just became the most recently used one.
    this.list.moveToFront(node);

    return node.value;
  }

  /**
   * Inserts a new entry, or overwrites an existing one. Either way the entry becomes the
   * most recently used. Once the cache is full, every insert of a *new* key evicts the
   * least recently used entry.
   *
   * **O(1)** in all three paths — update, plain insert, and insert-with-eviction.
   *
   * @param key   - Key to store under.
   * @param value - Value to store.
   */
  public put(key: K, value: V): void {
    const existing = this.map.get(key);

    if (existing !== undefined) {
      // Update path: the node keeps its identity and its place in the Map, only the
      // value changes. Nothing is evicted here — the entry count did not grow.
      existing.value = value;
      this.list.moveToFront(existing);
      return;
    }

    // Insert path. Evict *before* inserting so the cache never momentarily exceeds its
    // capacity, and so the entry being inserted can never be the one evicted.
    if (this.map.size >= this.maxSize) {
      this.evictLeastRecentlyUsed();
    }

    const node = new Node<K, V>(key, value);
    this.map.set(key, node);
    this.list.addToFront(node);
  }

  /**
   * Whether a key is cached — **without** counting as a use, so the recency order is left
   * untouched.
   *
   * @param key - Key to check.
   */
  public has(key: K): boolean {
    return this.map.has(key);
  }

  /**
   * Reads a value **without** marking it as recently used.
   *
   * Useful for inspection (metrics, debugging, tests) where observing the cache must not
   * change which entry gets evicted next.
   *
   * @param key - Key to look up.
   * @returns The cached value, or `undefined` on a cache miss.
   */
  public peek(key: K): V | undefined {
    return this.map.get(key)?.value;
  }

  /**
   * Removes an entry.
   *
   * Both structures must be updated together: an entry left in one but not the other is
   * exactly the kind of drift that turns into a memory leak or a phantom hit.
   *
   * @param key - Key to remove.
   * @returns `true` if an entry was removed, `false` if the key was not cached.
   */
  public delete(key: K): boolean {
    const node = this.map.get(key);

    if (node === undefined) {
      return false;
    }

    this.list.remove(node);
    this.map.delete(key);

    return true;
  }

  /** Removes every entry, leaving the cache empty and reusable. */
  public clear(): void {
    this.map.clear();

    // Dropping the old chain wholesale is cheaper than unlinking node by node; the
    // orphaned nodes are unreachable and get collected.
    this.list.reset();
  }

  /**
   * Keys ordered from most to least recently used — the last one is the next eviction
   * candidate.
   *
   * O(n) and meant for tests, debugging and documentation, not for the hot path.
   */
  public keys(): K[] {
    return this.list.keysFromMostRecent();
  }

  /**
   * Drops the least recently used entry from both structures.
   *
   * This is where the node's stored `key` earns its place: the victim is found through
   * the list, but it also has to leave the Map, and `Map.delete` needs a key. Without
   * that back-reference the cache would have to scan the Map to find it — O(n), which
   * would sink the entire design.
   */
  private evictLeastRecentlyUsed(): void {
    const lru = this.list.removeLast();

    // Defensive: with a positive capacity the list cannot be empty at this point, since
    // the caller only evicts when the cache is full. Unreachable by design, hence
    // excluded from coverage rather than left as a permanent gap in the report.
    /* istanbul ignore next -- @preserve: guards an impossible state */
    if (lru === null) {
      return;
    }

    this.map.delete(lru.key);
  }
}
