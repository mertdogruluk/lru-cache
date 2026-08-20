import { Node } from '../src/core/Node';

describe('Node', () => {
  it('stores the key and value it was constructed with', () => {
    const node = new Node<string, number>('answer', 42);

    expect(node.key).toBe('answer');
    expect(node.value).toBe(42);
  });

  it('starts detached, with no neighbours', () => {
    const node = new Node<string, number>('a', 1);

    expect(node.prev).toBeNull();
    expect(node.next).toBeNull();
  });

  it('allows the value to change while the key stays fixed', () => {
    const node = new Node<string, number>('a', 1);

    node.value = 2;

    expect(node.value).toBe(2);
    expect(node.key).toBe('a');
  });

  it('is generic over key and value types', () => {
    const objectKey = { id: 1 };
    const node = new Node<{ id: number }, string[]>(objectKey, ['x']);

    expect(node.key).toBe(objectKey);
    expect(node.value).toEqual(['x']);
  });

  describe('unlink', () => {
    it('clears both pointers so a dropped node cannot keep neighbours reachable', () => {
      const node = new Node<string, number>('b', 2);
      node.prev = new Node<string, number>('a', 1);
      node.next = new Node<string, number>('c', 3);

      node.unlink();

      expect(node.prev).toBeNull();
      expect(node.next).toBeNull();
    });

    it('is safe to call on an already detached node', () => {
      const node = new Node<string, number>('a', 1);

      expect(() => node.unlink()).not.toThrow();
      expect(node.prev).toBeNull();
    });
  });

  describe('createSentinel', () => {
    it('produces a detached placeholder node', () => {
      const sentinel = Node.createSentinel<string, number>();

      expect(sentinel.prev).toBeNull();
      expect(sentinel.next).toBeNull();
    });

    it('produces a distinct instance on every call', () => {
      expect(Node.createSentinel()).not.toBe(Node.createSentinel());
    });
  });
});
