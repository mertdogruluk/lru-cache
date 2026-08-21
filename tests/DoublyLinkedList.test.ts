import { beforeEach, describe, expect, it } from 'vitest';

import { DoublyLinkedList } from '../src/core/DoublyLinkedList.js';
import { Node } from '../src/core/Node.js';

/** Helper: builds a detached node with a string key and numeric value. */
const node = (key: string, value = 0): Node<string, number> => new Node(key, value);

describe('DoublyLinkedList', () => {
  let list: DoublyLinkedList<string, number>;

  beforeEach(() => {
    list = new DoublyLinkedList<string, number>();
  });

  describe('empty list', () => {
    it('reports itself as empty', () => {
      expect(list.isEmpty()).toBe(true);
      expect(list.size).toBe(0);
      expect(list.keysFromMostRecent()).toEqual([]);
    });

    it('returns null instead of throwing when asked for the last node', () => {
      expect(list.removeLast()).toBeNull();
    });

    it('survives repeated removeLast calls on an empty list', () => {
      expect(list.removeLast()).toBeNull();
      expect(list.removeLast()).toBeNull();
      expect(list.size).toBe(0);
    });
  });

  describe('addToFront', () => {
    it('makes the first inserted node both newest and oldest', () => {
      list.addToFront(node('a'));

      expect(list.size).toBe(1);
      expect(list.isEmpty()).toBe(false);
      expect(list.keysFromMostRecent()).toEqual(['a']);
    });

    it('keeps later insertions in front of earlier ones', () => {
      list.addToFront(node('a'));
      list.addToFront(node('b'));
      list.addToFront(node('c'));

      expect(list.keysFromMostRecent()).toEqual(['c', 'b', 'a']);
      expect(list.size).toBe(3);
    });
  });

  describe('remove', () => {
    it('stitches the neighbours together when removing from the middle', () => {
      const [a, b, c] = [node('a'), node('b'), node('c')];
      list.addToFront(a);
      list.addToFront(b);
      list.addToFront(c);

      list.remove(b);

      expect(list.keysFromMostRecent()).toEqual(['c', 'a']);
      expect(list.size).toBe(2);
    });

    it('handles removal of the newest node', () => {
      const [a, b] = [node('a'), node('b')];
      list.addToFront(a);
      list.addToFront(b);

      list.remove(b);

      expect(list.keysFromMostRecent()).toEqual(['a']);
    });

    it('handles removal of the oldest node', () => {
      const [a, b] = [node('a'), node('b')];
      list.addToFront(a);
      list.addToFront(b);

      list.remove(a);

      expect(list.keysFromMostRecent()).toEqual(['b']);
    });

    it('empties the list when the only node is removed', () => {
      const a = node('a');
      list.addToFront(a);

      list.remove(a);

      expect(list.isEmpty()).toBe(true);
      expect(list.keysFromMostRecent()).toEqual([]);
    });

    it('detaches the removed node from its former neighbours', () => {
      const [a, b, c] = [node('a'), node('b'), node('c')];
      list.addToFront(a);
      list.addToFront(b);
      list.addToFront(c);

      list.remove(b);

      expect(b.prev).toBeNull();
      expect(b.next).toBeNull();
    });

    it('is a no-op for a node that is not linked in, leaving size untouched', () => {
      list.addToFront(node('a'));
      const stranger = node('stranger');

      list.remove(stranger);

      expect(list.size).toBe(1);
      expect(list.keysFromMostRecent()).toEqual(['a']);
    });

    it('does not double-decrement when the same node is removed twice', () => {
      const a = node('a');
      list.addToFront(a);
      list.addToFront(node('b'));

      list.remove(a);
      list.remove(a);

      expect(list.size).toBe(1);
    });
  });

  describe('moveToFront', () => {
    it('promotes a node from the middle without changing the size', () => {
      const [a, b, c] = [node('a'), node('b'), node('c')];
      list.addToFront(a);
      list.addToFront(b);
      list.addToFront(c);

      list.moveToFront(b);

      expect(list.keysFromMostRecent()).toEqual(['b', 'c', 'a']);
      expect(list.size).toBe(3);
    });

    it('promotes the oldest node to the front', () => {
      const [a, b, c] = [node('a'), node('b'), node('c')];
      list.addToFront(a);
      list.addToFront(b);
      list.addToFront(c);

      list.moveToFront(a);

      expect(list.keysFromMostRecent()).toEqual(['a', 'c', 'b']);
    });

    it('leaves the order unchanged when the node is already at the front', () => {
      const [a, b] = [node('a'), node('b')];
      list.addToFront(a);
      list.addToFront(b);

      list.moveToFront(b);

      expect(list.keysFromMostRecent()).toEqual(['b', 'a']);
      expect(list.size).toBe(2);
    });
  });

  describe('removeLast', () => {
    it('returns the least recently added node', () => {
      const [a, b] = [node('a', 1), node('b', 2)];
      list.addToFront(a);
      list.addToFront(b);

      const evicted = list.removeLast();

      expect(evicted).toBe(a);
      expect(list.keysFromMostRecent()).toEqual(['b']);
    });

    it('returns a node that still carries its key, so the Map entry can be dropped', () => {
      list.addToFront(node('a', 1));

      const evicted = list.removeLast();

      expect(evicted?.key).toBe('a');
      expect(evicted?.value).toBe(1);
    });

    it('respects promotions: a promoted node is no longer the eviction candidate', () => {
      const [a, b] = [node('a'), node('b')];
      list.addToFront(a);
      list.addToFront(b);

      list.moveToFront(a);

      expect(list.removeLast()).toBe(b);
    });

    it('drains the list one node at a time', () => {
      list.addToFront(node('a'));
      list.addToFront(node('b'));

      expect(list.removeLast()?.key).toBe('a');
      expect(list.removeLast()?.key).toBe('b');
      expect(list.removeLast()).toBeNull();
      expect(list.isEmpty()).toBe(true);
    });
  });

  describe('reset', () => {
    it('empties a populated list', () => {
      list.addToFront(node('a'));
      list.addToFront(node('b'));

      list.reset();

      expect(list.size).toBe(0);
      expect(list.isEmpty()).toBe(true);
      expect(list.keysFromMostRecent()).toEqual([]);
    });

    it('leaves the list usable afterwards', () => {
      list.addToFront(node('a'));
      list.reset();

      list.addToFront(node('b'));

      expect(list.keysFromMostRecent()).toEqual(['b']);
      expect(list.size).toBe(1);
    });

    it('is harmless on an already empty list', () => {
      expect(() => list.reset()).not.toThrow();
      expect(list.removeLast()).toBeNull();
    });
  });

  it('keeps size and order consistent through a long mixed workload', () => {
    const nodes = Array.from({ length: 100 }, (_, i) => node(`k${i}`, i));
    nodes.forEach((n) => list.addToFront(n));

    // Promote every tenth node, then evict half of the list.
    for (let i = 0; i < 100; i += 10) {
      list.moveToFront(nodes[i]!);
    }
    for (let i = 0; i < 50; i++) {
      list.removeLast();
    }

    expect(list.size).toBe(50);
    expect(list.keysFromMostRecent()).toHaveLength(50);
  });
});
