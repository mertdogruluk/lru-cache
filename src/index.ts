/**
 * Public entry point of the library.
 *
 * Phase 1 will grow the cache core (TTL, byte budget, single-flight) around these
 * building blocks; the semantic layers land in later phases.
 */

export { LRUCache } from './LRUCache.js';

// Building blocks, exported for reuse and for readers who want to see the internals.
export { DoublyLinkedList } from './core/DoublyLinkedList.js';
export { Node } from './core/Node.js';
