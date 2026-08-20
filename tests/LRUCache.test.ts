import { LRUCache } from '../src/LRUCache';

describe('LRUCache', () => {
  describe('construction', () => {
    it('exposes the capacity it was built with and starts empty', () => {
      const cache = new LRUCache<string, number>(3);

      expect(cache.capacity).toBe(3);
      expect(cache.size).toBe(0);
      expect(cache.keys()).toEqual([]);
    });

    it.each([0, -1, -10, 1.5, NaN, Infinity])(
      'rejects the invalid capacity %p with a RangeError',
      (capacity) => {
        expect(() => new LRUCache<string, number>(capacity)).toThrow(RangeError);
      },
    );

    it('accepts a capacity of 1', () => {
      expect(() => new LRUCache<string, number>(1)).not.toThrow();
    });
  });

  describe('cache miss', () => {
    it('returns undefined for a key that was never stored', () => {
      const cache = new LRUCache<string, number>(2);

      expect(cache.get('missing')).toBeUndefined();
    });

    it('returns undefined for a key that was evicted', () => {
      const cache = new LRUCache<string, number>(2);
      cache.put('a', 1);
      cache.put('b', 2);
      cache.put('c', 3); // evicts 'a'

      expect(cache.get('a')).toBeUndefined();
    });

    it('does not disturb the recency order', () => {
      const cache = new LRUCache<string, number>(2);
      cache.put('a', 1);
      cache.put('b', 2);

      cache.get('missing');

      expect(cache.keys()).toEqual(['b', 'a']);
      expect(cache.size).toBe(2);
    });

    it('does not create an entry as a side effect', () => {
      const cache = new LRUCache<string, number>(2);

      cache.get('ghost');

      expect(cache.size).toBe(0);
      expect(cache.has('ghost')).toBe(false);
    });

    it('reports a miss through has()', () => {
      const cache = new LRUCache<string, number>(2);
      cache.put('a', 1);

      expect(cache.has('a')).toBe(true);
      expect(cache.has('b')).toBe(false);
    });
  });

  describe('basic reads and writes', () => {
    it('returns a stored value', () => {
      const cache = new LRUCache<string, number>(2);
      cache.put('a', 1);

      expect(cache.get('a')).toBe(1);
    });

    it('grows the size only up to the capacity', () => {
      const cache = new LRUCache<string, number>(2);

      cache.put('a', 1);
      expect(cache.size).toBe(1);

      cache.put('b', 2);
      expect(cache.size).toBe(2);

      cache.put('c', 3);
      expect(cache.size).toBe(2);
    });

    it('marks a read entry as most recently used', () => {
      const cache = new LRUCache<string, number>(3);
      cache.put('a', 1);
      cache.put('b', 2);
      cache.put('c', 3);

      cache.get('a');

      expect(cache.keys()).toEqual(['a', 'c', 'b']);
    });

    it('stores falsy values without confusing them with a miss', () => {
      const cache = new LRUCache<string, number | null>(3);
      cache.put('zero', 0);
      cache.put('null', null);

      expect(cache.get('zero')).toBe(0);
      expect(cache.get('null')).toBeNull();
      expect(cache.has('zero')).toBe(true);
    });

    it('distinguishes a stored undefined from a miss via has()', () => {
      const cache = new LRUCache<string, number | undefined>(2);
      cache.put('stored', undefined);

      expect(cache.get('stored')).toBeUndefined();
      expect(cache.has('stored')).toBe(true);
      expect(cache.has('never-stored')).toBe(false);
    });
  });

  describe('updating an existing key', () => {
    it('overwrites the value instead of adding a second entry', () => {
      const cache = new LRUCache<string, number>(2);
      cache.put('a', 1);

      cache.put('a', 99);

      expect(cache.get('a')).toBe(99);
      expect(cache.size).toBe(1);
    });

    it('does not evict anything even when the cache is full', () => {
      const cache = new LRUCache<string, number>(2);
      cache.put('a', 1);
      cache.put('b', 2);

      cache.put('a', 11);

      expect(cache.size).toBe(2);
      expect(cache.get('b')).toBe(2);
      expect(cache.get('a')).toBe(11);
    });

    it('marks the updated entry as most recently used', () => {
      const cache = new LRUCache<string, number>(3);
      cache.put('a', 1);
      cache.put('b', 2);
      cache.put('c', 3);

      cache.put('a', 11);

      expect(cache.keys()).toEqual(['a', 'c', 'b']);
    });

    it('protects the updated entry from the next eviction', () => {
      const cache = new LRUCache<string, number>(2);
      cache.put('a', 1);
      cache.put('b', 2);

      cache.put('a', 11); // 'a' is newest again, so 'b' becomes the victim
      cache.put('c', 3);

      expect(cache.has('a')).toBe(true);
      expect(cache.has('b')).toBe(false);
    });
  });

  describe('capacity overflow and eviction', () => {
    it('evicts the least recently used entry when a new key overflows the cache', () => {
      const cache = new LRUCache<string, number>(2);
      cache.put('a', 1);
      cache.put('b', 2);

      cache.put('c', 3);

      expect(cache.has('a')).toBe(false);
      expect(cache.keys()).toEqual(['c', 'b']);
    });

    it('evicts by recency of use, not by insertion order', () => {
      const cache = new LRUCache<string, number>(2);
      cache.put('a', 1);
      cache.put('b', 2);

      cache.get('a'); // 'a' is now newest, so 'b' is the eviction candidate
      cache.put('c', 3);

      expect(cache.get('a')).toBe(1);
      expect(cache.get('b')).toBeUndefined();
      expect(cache.get('c')).toBe(3);
    });

    it('never exceeds the capacity, however many keys are written', () => {
      const cache = new LRUCache<number, number>(3);

      for (let i = 0; i < 100; i++) {
        cache.put(i, i);
        expect(cache.size).toBeLessThanOrEqual(3);
      }

      expect(cache.size).toBe(3);
      expect(cache.keys()).toEqual([99, 98, 97]);
    });

    it('keeps only the newest entry when the capacity is 1', () => {
      const cache = new LRUCache<string, number>(1);

      cache.put('a', 1);
      cache.put('b', 2);

      expect(cache.size).toBe(1);
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBe(2);
    });

    it('lets an evicted key be inserted again as a fresh entry', () => {
      const cache = new LRUCache<string, number>(2);
      cache.put('a', 1);
      cache.put('b', 2);
      cache.put('c', 3); // evicts 'a'

      cache.put('a', 111); // evicts 'b'

      expect(cache.get('a')).toBe(111);
      expect(cache.has('b')).toBe(false);
      expect(cache.size).toBe(2);
    });

    it('follows the classic LRU walkthrough end to end', () => {
      const cache = new LRUCache<number, number>(2);

      cache.put(1, 1);
      cache.put(2, 2);
      expect(cache.get(1)).toBe(1);

      cache.put(3, 3); // evicts key 2
      expect(cache.get(2)).toBeUndefined();

      cache.put(4, 4); // evicts key 1
      expect(cache.get(1)).toBeUndefined();
      expect(cache.get(3)).toBe(3);
      expect(cache.get(4)).toBe(4);
    });
  });

  describe('peek', () => {
    it('reads a value without changing the recency order', () => {
      const cache = new LRUCache<string, number>(2);
      cache.put('a', 1);
      cache.put('b', 2);

      expect(cache.peek('a')).toBe(1);
      expect(cache.keys()).toEqual(['b', 'a']);
    });

    it('leaves the peeked entry as the next eviction candidate', () => {
      const cache = new LRUCache<string, number>(2);
      cache.put('a', 1);
      cache.put('b', 2);

      cache.peek('a');
      cache.put('c', 3);

      expect(cache.has('a')).toBe(false);
    });

    it('returns undefined on a miss', () => {
      const cache = new LRUCache<string, number>(2);

      expect(cache.peek('missing')).toBeUndefined();
    });
  });

  describe('has', () => {
    it('does not change the recency order', () => {
      const cache = new LRUCache<string, number>(2);
      cache.put('a', 1);
      cache.put('b', 2);

      cache.has('a');
      cache.put('c', 3);

      expect(cache.has('a')).toBe(false);
    });
  });

  describe('delete', () => {
    it('removes an entry and reports success', () => {
      const cache = new LRUCache<string, number>(2);
      cache.put('a', 1);

      expect(cache.delete('a')).toBe(true);
      expect(cache.get('a')).toBeUndefined();
      expect(cache.size).toBe(0);
    });

    it('reports failure for a key that was never cached', () => {
      const cache = new LRUCache<string, number>(2);

      expect(cache.delete('missing')).toBe(false);
      expect(cache.size).toBe(0);
    });

    it('frees a slot, so the next insert evicts nothing', () => {
      const cache = new LRUCache<string, number>(2);
      cache.put('a', 1);
      cache.put('b', 2);

      cache.delete('a');
      cache.put('c', 3);

      expect(cache.size).toBe(2);
      expect(cache.has('b')).toBe(true);
      expect(cache.has('c')).toBe(true);
    });

    it('keeps the Map and the list in sync', () => {
      const cache = new LRUCache<string, number>(3);
      cache.put('a', 1);
      cache.put('b', 2);
      cache.put('c', 3);

      cache.delete('b');

      expect(cache.keys()).toEqual(['c', 'a']);
      expect(cache.size).toBe(cache.keys().length);
    });

    it('is not fooled by deleting the same key twice', () => {
      const cache = new LRUCache<string, number>(2);
      cache.put('a', 1);

      expect(cache.delete('a')).toBe(true);
      expect(cache.delete('a')).toBe(false);
      expect(cache.size).toBe(0);
    });
  });

  describe('clear', () => {
    it('empties the cache', () => {
      const cache = new LRUCache<string, number>(3);
      cache.put('a', 1);
      cache.put('b', 2);

      cache.clear();

      expect(cache.size).toBe(0);
      expect(cache.keys()).toEqual([]);
      expect(cache.get('a')).toBeUndefined();
      expect(cache.has('b')).toBe(false);
    });

    it('leaves the cache fully usable, with its capacity intact', () => {
      const cache = new LRUCache<string, number>(2);
      cache.put('a', 1);
      cache.clear();

      cache.put('b', 2);
      cache.put('c', 3);
      cache.put('d', 4);

      expect(cache.capacity).toBe(2);
      expect(cache.size).toBe(2);
      expect(cache.keys()).toEqual(['d', 'c']);
    });

    it('is harmless on an empty cache', () => {
      const cache = new LRUCache<string, number>(2);

      expect(() => cache.clear()).not.toThrow();
      expect(cache.size).toBe(0);
    });
  });

  describe('generic key and value types', () => {
    it('supports numeric keys', () => {
      const cache = new LRUCache<number, string>(2);
      cache.put(1, 'one');

      expect(cache.get(1)).toBe('one');
    });

    it('supports object values', () => {
      const cache = new LRUCache<string, { id: number }>(2);
      const value = { id: 7 };
      cache.put('obj', value);

      expect(cache.get('obj')).toBe(value);
    });

    it('matches object keys by reference, following Map semantics', () => {
      const cache = new LRUCache<{ id: number }, string>(2);
      const key = { id: 1 };
      cache.put(key, 'value');

      expect(cache.get(key)).toBe('value');
      expect(cache.get({ id: 1 })).toBeUndefined(); // structurally equal, different object
    });
  });

  describe('invariants under load', () => {
    it('keeps the Map and the list in agreement across a mixed workload', () => {
      const capacity = 50;
      const cache = new LRUCache<number, number>(capacity);

      for (let i = 0; i < 5_000; i++) {
        cache.put(i % 200, i);

        if (i % 3 === 0) {
          cache.get(i % 90);
        }
        if (i % 7 === 0) {
          cache.delete(i % 150);
        }

        expect(cache.size).toBeLessThanOrEqual(capacity);
      }

      // The list length must never drift away from the Map size — drift here is the
      // signature of a leak or a phantom entry.
      expect(cache.keys()).toHaveLength(cache.size);
      expect(new Set(cache.keys()).size).toBe(cache.size); // no duplicated keys
    });

    it('always retains exactly the most recently used entries', () => {
      const cache = new LRUCache<number, number>(3);

      for (let i = 0; i < 10; i++) {
        cache.put(i, i);
      }

      expect(cache.keys()).toEqual([9, 8, 7]);
      expect(cache.get(6)).toBeUndefined();
    });
  });
});
