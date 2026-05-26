import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Clndr } from './client';

describe('Clndr fetch binding', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('does not lose `this` binding on native fetch', async () => {
    // Simulate native fetch's WebIDL `this`-check: throw "Illegal invocation"
    // unless `this` is the global object. This is the same guard that real
    // browser/undici fetch enforces — and the bug that 0.1.3 hit in
    // production builds and plain Node.
    globalThis.fetch = function mockFetch(this: unknown, _input, _init) {
      if (this !== globalThis) {
        throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
      }
      return Promise.resolve(
        new Response(JSON.stringify({ data: { slug: 'some-slug' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    } as typeof fetch;

    const client = new Clndr({ apiKey: 'clndr_pk_test' });
    await expect(client.bookingPages.get('some-slug')).resolves.toBeDefined();
  });

  it('uses caller-supplied fetch untouched', async () => {
    let called = false;
    const customFetch: typeof fetch = (_input, _init) => {
      called = true;
      return Promise.resolve(
        new Response(JSON.stringify({ data: { slug: 'some-slug' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    };

    const client = new Clndr({ apiKey: 'clndr_pk_test', fetch: customFetch });
    await client.bookingPages.get('some-slug');
    expect(called).toBe(true);
  });
});
