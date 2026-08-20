/**
 * Public entry point of the library.
 *
 *  - `LRUCache.ts`              → Hash Map + list = the cache    (STEP 4) ✔
 *  - `core/DoublyLinkedList.ts` → O(1) ordering mechanism        (STEP 3) ✔
 *  - `core/Node.ts`             → generic doubly linked list node (STEP 2) ✔
 */

export { LRUCache } from './LRUCache';

// Building blocks, exported for reuse and for readers who want to see the internals.
export { DoublyLinkedList } from './core/DoublyLinkedList';
export { Node } from './core/Node';
