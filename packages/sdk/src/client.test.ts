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

describe('bookingPages.getSlots date param', () => {
  const originalTZ = process.env.TZ;

  afterEach(() => {
    if (originalTZ === undefined) delete process.env.TZ;
    else process.env.TZ = originalTZ;
  });

  async function sentDate(date: string | Date): Promise<string | null> {
    const { urls, fetchImpl } = recordingFetch();
    const client = new Clndr({ apiKey: 'clndr_pk_test', fetch: fetchImpl });
    await client.bookingPages.getSlots('30-min-intro', date);
    const url = new URL(urls[0]);
    expect(url.pathname).toBe('/api/v1/booking-pages/30-min-intro/slots');
    return url.searchParams.get('date');
  }

  it('passes a YYYY-MM-DD string through unchanged', async () => {
    expect(await sentDate('2026-10-14')).toBe('2026-10-14');
  });

  it('passes any other string (e.g. a full ISO timestamp) through unchanged', async () => {
    expect(await sentDate('2026-10-14T15:30:00.000Z')).toBe('2026-10-14T15:30:00.000Z');
  });

  it('sends a Date as YYYY-MM-DD from its local calendar fields', async () => {
    // Local-midnight Date: the same calendar day in every timezone.
    expect(await sentDate(new Date(2026, 9, 14))).toBe('2026-10-14');
    expect(await sentDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('uses the local day, not the UTC day, west of UTC', async () => {
    process.env.TZ = 'America/Los_Angeles';
    // 2026-10-14T03:00Z is 8pm on Oct 13 in Los Angeles. Guard against the
    // runtime ignoring the TZ change so this can't pass by accident.
    const evening = new Date('2026-10-14T03:00:00Z');
    expect(evening.getDate()).toBe(13);
    expect(await sentDate(evening)).toBe('2026-10-13');

    // 11:30pm local on Oct 14 is already Oct 15 in UTC; toISOString() would
    // have sent the 15th.
    const lateNight = new Date(2026, 9, 14, 23, 30);
    expect(lateNight.toISOString().slice(0, 10)).toBe('2026-10-15');
    expect(await sentDate(lateNight)).toBe('2026-10-14');
  });

  it('uses the local day, not the UTC day, east of UTC', async () => {
    process.env.TZ = 'Asia/Kolkata';
    // 00:30 on Oct 14 in India is still Oct 13 in UTC.
    const earlyMorning = new Date(2026, 9, 14, 0, 30);
    expect(earlyMorning.toISOString().slice(0, 10)).toBe('2026-10-13');
    expect(await sentDate(earlyMorning)).toBe('2026-10-14');
  });

  it('rejects an invalid Date instead of sending NaN', async () => {
    await expect(sentDate(new Date('not a date'))).rejects.toThrow(RangeError);
  });
});
