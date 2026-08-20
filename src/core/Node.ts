/**
 * A single node of a doubly linked list, used as the storage cell of the LRU cache.
 *
 * ### Why the node stores the key as well as the value
 * Intuitively a cache entry only needs its value — the key is already the Map key.
 * But eviction runs in the opposite direction: the cache finds the least-recently-used
 * node through the list's tail, and then has to remove that entry **from the Map too**.
 * `map.delete(...)` needs a key, and walking the Map to find which key points at this
 * node would be O(n) — destroying the very guarantee the design exists for.
 * Storing the key back-reference on the node makes eviction O(1).
 *
 * ### Why `prev` as well as `next`
 * A singly linked list can only be traversed forward, so unlinking a node requires
 * finding its predecessor first — O(n). With a `prev` pointer, a node knows both of its
 * neighbours, so it can splice itself out by rewiring them directly, in constant time.
 * That is the whole reason the design uses a *doubly* linked list.
 *
 * @typeParam K - Type of the cache key.
 * @typeParam V - Type of the cached value.
 *
 * @example
 * ```ts
 * const node = new Node<string, number>('answer', 42);
 * node.next = new Node('other', 7);
 * ```
 */
export class Node<K, V> {
  /**
   * Key this node was stored under.
   *
   * `readonly` on purpose: a node's identity in the Map must never drift away from the
   * key it is registered under. Updating a cache entry replaces {@link value}, never this.
   */
  public readonly key: K;

  /** Cached value. Mutable, because `put` on an existing key overwrites it in place. */
  public value: V;

  /**
   * Previous neighbour, i.e. the node one step closer to the head (more recently used).
   * `null` only for a detached node that is not currently linked into a list.
   */
  public prev: Node<K, V> | null = null;

  /**
   * Next neighbour, i.e. the node one step closer to the tail (less recently used).
   * `null` only for a detached node that is not currently linked into a list.
   */
  public next: Node<K, V> | null = null;

  /**
   * @param key   - Key the value is cached under.
   * @param value - Value to cache.
   */
  constructor(key: K, value: V) {
    this.key = key;
    this.value = value;
  }

  /**
   * Creates a **sentinel** (dummy) node — a permanent, keyless placeholder that guards
   * one end of a list so that insertion and removal never face an empty-list or
   * end-of-list special case (see `DoublyLinkedList`).
   *
   * A sentinel carries no real key/value: it is never returned to callers and never
   * registered in the Map. The unavoidable cast is deliberately confined to this single
   * factory instead of being scattered across the list implementation, so the rest of
   * the codebase stays honestly typed.
   *
   * @returns A node with `null` masquerading as its key and value.
   * @internal
   */
  public static createSentinel<K, V>(): Node<K, V> {
    return new Node<K, V>(null as unknown as K, null as unknown as V);
  }

  /**
   * Detaches this node from its neighbours by clearing both pointers.
   *
   * Called after a node has been unlinked, so the evicted node no longer keeps its
   * former neighbours reachable — otherwise a discarded entry could pin an entire chain
   * of live nodes in memory and defeat garbage collection.
   */
  public unlink(): void {
    this.prev = null;
    this.next = null;
  }
}
