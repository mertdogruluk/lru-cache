import { Node } from './Node.js';

/**
 * A doubly linked list that keeps cache entries ordered by recency of use:
 * the node nearest the head is the most recently used, the node nearest the tail is the
 * least recently used — i.e. the next eviction candidate.
 *
 * Every operation here is O(1). The list never searches; the caller always arrives
 * holding the exact node it wants to move or drop (it got that node from the Map).
 *
 * ### Why dummy head and tail nodes
 * The list is bounded by two permanent **sentinel** nodes that hold no data and are never
 * handed out to callers:
 *
 * ```text
 *   head ⇄ [ A ] ⇄ [ B ] ⇄ [ C ] ⇄ tail
 *  (dummy)  newest              oldest  (dummy)
 * ```
 *
 * Without them, every insert and remove would have to answer questions like "is the list
 * empty?", "is this the first node?", "is this the last node?" — and each `yes` needs its
 * own branch that updates a `head`/`tail` field instead of a neighbour's pointer. That is
 * where linked-list bugs live.
 *
 * With sentinels, **every real node is guaranteed to have both a `prev` and a `next`**,
 * so a single unconditional rewiring works in all cases, including the first insert and
 * the last removal. The special cases stop existing rather than being handled.
 *
 * @typeParam K - Type of the cache key.
 * @typeParam V - Type of the cached value.
 */
export class DoublyLinkedList<K, V> {
  /** Dummy node before the most recently used entry. Never holds data. */
  private readonly head: Node<K, V>;

  /** Dummy node after the least recently used entry. Never holds data. */
  private readonly tail: Node<K, V>;

  /** Number of real (non-sentinel) nodes currently linked in. */
  private length = 0;

  constructor() {
    this.head = Node.createSentinel<K, V>();
    this.tail = Node.createSentinel<K, V>();

    // The two sentinels start out pointing at each other: this is the empty list.
    // From here on the chain head → … → tail is never broken, which is precisely the
    // invariant that lets every other method skip null checks.
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  /** Number of entries currently in the list. O(1). */
  public get size(): number {
    return this.length;
  }

  /** Whether the list holds no real nodes. O(1). */
  public isEmpty(): boolean {
    return this.length === 0;
  }

  /**
   * Inserts a node directly after the head sentinel, marking it as most recently used.
   *
   * Four pointer assignments, no branching, no traversal — O(1).
   *
   * @param node - A detached node (must not currently be linked into a list).
   */
  public addToFront(node: Node<K, V>): void {
    // Invariant: head.next is never null — at worst it is the tail sentinel.
    const first = this.head.next!;

    // Wire the newcomer to its future neighbours...
    node.prev = this.head;
    node.next = first;

    // ...then make those neighbours point back at it. Order matters: `first` is read
    // before head.next is overwritten, otherwise the old first node would be orphaned.
    this.head.next = node;
    first.prev = node;

    this.length++;
  }

  /**
   * Unlinks a node from wherever it sits in the list.
   *
   * This is the payoff of the doubly linked design: the node already knows both of its
   * neighbours, so they can be stitched together directly. A singly linked list would
   * have to walk from the head to find the predecessor — O(n).
   *
   * Removing a node that is already detached is a no-op, so the method is safe to call
   * twice.
   *
   * @param node - The node to unlink.
   */
  public remove(node: Node<K, V>): void {
    const prev = node.prev;
    const next = node.next;

    // A detached node has no neighbours to stitch; nothing to do.
    if (prev === null || next === null) {
      return;
    }

    // Bypass the node: its neighbours now reference each other.
    prev.next = next;
    next.prev = prev;

    // Clear the node's own pointers so a dropped entry cannot keep live nodes reachable.
    node.unlink();

    this.length--;
  }

  /**
   * Moves an already-linked node to the front, marking it as most recently used.
   *
   * This is what a cache hit does: unlink from the current position, re-insert at the
   * head. Both halves are O(1), so the whole move is O(1).
   *
   * @param node - A node currently linked into this list.
   */
  public moveToFront(node: Node<K, V>): void {
    this.remove(node);
    this.addToFront(node);
  }

  /**
   * Removes and returns the least recently used node — the one just before the tail
   * sentinel. This is the eviction primitive.
   *
   * Because the list is kept in recency order on every access, the eviction candidate is
   * simply *there*, at a known position. Nothing has to be searched or compared, which is
   * what makes eviction O(1).
   *
   * The returned node is detached but still carries its `key`, which the cache needs in
   * order to drop the matching Map entry.
   *
   * @returns The evicted node, or `null` if the list is empty.
   */
  public removeLast(): Node<K, V> | null {
    // Invariant: tail.prev is never null — at worst it is the head sentinel.
    const last = this.tail.prev!;

    // Reaching the head sentinel means there is no real node between the two sentinels.
    if (last === this.head) {
      return null;
    }

    this.remove(last);
    return last;
  }

  /**
   * Empties the list in one shot by re-linking the two sentinels to each other.
   *
   * The discarded chain is not unlinked node by node: nothing references it any more, so
   * the whole chain becomes unreachable and is collected together. O(1).
   */
  public reset(): void {
    this.head.next = this.tail;
    this.tail.prev = this.head;
    this.length = 0;
  }

  /**
   * Returns the keys from most to least recently used.
   *
   * O(n) and intended for tests, debugging and documentation — never used on the hot
   * path of the cache itself.
   */
  public keysFromMostRecent(): K[] {
    const keys: K[] = [];

    for (let current = this.head.next; current !== null && current !== this.tail;) {
      keys.push(current.key);
      current = current.next;
    }

    return keys;
  }
}
