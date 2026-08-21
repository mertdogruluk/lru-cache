import { bench, describe } from 'vitest';

import { LRUCache } from '../src/LRUCache.js';

/**
 * Baseline benchmarks for the cache core.
 *
 * These deliberately exercise the *expensive* paths rather than a flattering one:
 * every `put` overflows the capacity and therefore evicts, and every `get` is a hit,
 * which forces a promotion to the head of the recency list.
 *
 * The point is not the absolute numbers — those depend on the machine — but the shape:
 * a 1000x larger capacity must not make a single operation 1000x slower. That is the
 * O(1) claim, and this file is what keeps it honest as the cache grows TTL, byte
 * accounting and single-flight in Phase 1.
 */

const CAPACITIES = [1_000, 100_000] as const;

describe('put (every call evicts)', () => {
  for (const capacity of CAPACITIES) {
    const cache = new LRUCache<number, number>(capacity);
    let i = 0;

    bench(`capacity ${capacity.toLocaleString('en-US')}`, () => {
      // Cycling over twice the capacity guarantees the key is always new, so every
      // call takes the insert-with-eviction path.
      cache.put(i % (capacity * 2), i);
      i++;
    });
  }
});

describe('get (every call hits and promotes)', () => {
  for (const capacity of CAPACITIES) {
    const cache = new LRUCache<number, number>(capacity);
    for (let k = 0; k < capacity; k++) {
      cache.put(k, k);
    }
    let i = 0;

    bench(`capacity ${capacity.toLocaleString('en-US')}`, () => {
      cache.get(i % capacity);
      i++;
    });
  }
});

describe('mixed workload (80% read, 20% write)', () => {
  const capacity = 10_000;
  const cache = new LRUCache<number, number>(capacity);
  for (let k = 0; k < capacity; k++) {
    cache.put(k, k);
  }
  let i = 0;

  bench(`capacity ${capacity.toLocaleString('en-US')}`, () => {
    if (i % 5 === 0) {
      cache.put(i % (capacity * 2), i);
    } else {
      cache.get(i % capacity);
    }
    i++;
  });
});
