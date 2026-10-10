import { afterEach, describe, expect, it } from 'vitest';
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

/** A fetch that records every URL it is called with and returns `{ data: [] }`. */
function recordingFetch() {
  const urls: string[] = [];
  const fetchImpl: typeof fetch = (input) => {
    urls.push(String(input));
    return Promise.resolve(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  };
  return { urls, fetchImpl };
}

describe('Clndr base URL', () => {
  it('defaults to the canonical www host', async () => {
    // The apex https://clndr.pro answers 307 -> https://www.clndr.pro, and
    // fetch drops `Authorization` on that cross-host hop, so the default has
    // to be the www host or every call 401s with "Missing API key".
    const { urls, fetchImpl } = recordingFetch();
    const client = new Clndr({ apiKey: 'clndr_sk_test', fetch: fetchImpl });
    await client.bookingPages.list();
    expect(urls).toHaveLength(1);
    expect(urls[0].startsWith('https://www.clndr.pro/api/v1/')).toBe(true);
    expect(urls[0]).toBe('https://www.clndr.pro/api/v1/booking-pages');
  });

  it('honours an explicit baseUrl (trailing slash stripped)', async () => {
    const { urls, fetchImpl } = recordingFetch();
    const client = new Clndr({ apiKey: 'clndr_sk_test', baseUrl: 'http://localhost:3000/', fetch: fetchImpl });
    await client.bookingPages.list();
    expect(urls[0]).toBe('http://localhost:3000/api/v1/booking-pages');
  });
});
