import {
  BookingPage,
  BookingPageDetail,
  Booking,
  CreateBookingInput,
  TimeSlot,
  ClndrError,
  KeyType,
} from './types';

export interface ClndrOptions {
  /** API key — `clndr_sk_...` (server) or `clndr_pk_...` (browser). */
  apiKey: string;
  /**
   * Base URL of the clndr.pro deployment. Defaults to https://www.clndr.pro
   * (the canonical host — the apex `https://clndr.pro` redirects there, and
   * fetch drops the `Authorization` header on that cross-host redirect).
   */
  baseUrl?: string;
  /** Optional custom fetch (for Node 16, testing, etc.). Defaults to global fetch. */
  fetch?: typeof fetch;
}

const DEFAULT_BASE = 'https://www.clndr.pro';

export class Clndr {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  public readonly keyType: KeyType;

  public readonly bookingPages: BookingPagesResource;
  public readonly bookings: BookingsResource;

  constructor(options: ClndrOptions | string) {
    const opts = typeof options === 'string' ? { apiKey: options } : options;
    if (!opts.apiKey) throw new Error('Clndr: `apiKey` is required');
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE).replace(/\/+$/, '');
    this.fetchImpl = opts.fetch ?? (globalThis.fetch.bind(globalThis) as typeof fetch);
    this.keyType = this.apiKey.startsWith('clndr_pk_') ? 'publishable' : 'secret';

    this.bookingPages = new BookingPagesResource(this);
    this.bookings = new BookingsResource(this);
  }

  /** Internal — makes an authenticated request to the API. */
  async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
    query?: Record<string, string | number | undefined>,
  ): Promise<T> {
    const url = new URL(this.baseUrl + path);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }
    const res = await this.fetchImpl(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    const json = text ? safeParse(text) : null;
    if (!res.ok) {
      const message = apiErrorMessage(json, res.status);
      throw new ClndrError(message, res.status, json);
    }
    return (json as T) ?? (undefined as unknown as T);
  }
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

function apiErrorMessage(json: unknown, status: number): string {
  if (!json || typeof json !== 'object' || json === null || !('error' in json)) {
    return `HTTP ${status}`;
  }
  const msg = String((json as Record<string, unknown>).error);
  return msg || `HTTP ${status}`;
}

/** `YYYY-MM-DD` from a Date's local calendar fields (not its UTC ones). */
function toLocalYMD(d: Date): string {
  if (Number.isNaN(d.getTime())) throw new RangeError('Clndr: getSlots() was given an invalid Date');
  const y = String(d.getFullYear()).padStart(4, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

class BookingPagesResource {
  constructor(private readonly client: Clndr) {}

  async list(): Promise<BookingPage[]> {
    const res = await this.client.request<{ data: BookingPage[] }>('GET', '/api/v1/booking-pages');
    return res.data;
  }

  async get(slug: string): Promise<BookingPageDetail> {
    const res = await this.client.request<{ data: BookingPageDetail }>(
      'GET',
      `/api/v1/booking-pages/${encodeURIComponent(slug)}`,
    );
    return res.data;
  }

  /**
   * Get the open slots for one day of the host's calendar. Slots come back
   * as UTC ISO timestamps.
   *
   * @param slug booking page slug
   * @param date the day to fetch:
   *  - a `YYYY-MM-DD` string (recommended) is sent unchanged, and the API reads
   *    it as that calendar day in the **host's** timezone. Any other string,
   *    such as a full ISO timestamp, is also sent unchanged; the API then picks
   *    the host-timezone day that contains that instant.
   *  - a `Date` is converted to `YYYY-MM-DD` from its **local** calendar fields
   *    (`getFullYear()` / `getMonth()` / `getDate()`), i.e. the day it falls on
   *    in the timezone this code runs in. `new Date(2026, 9, 14)` always sends
   *    `2026-10-14`. Beware `new Date('2026-10-14')`: that is UTC midnight,
   *    which is still the 13th locally anywhere west of UTC — pass the string
   *    instead.
   */
  async getSlots(slug: string, date: string | Date): Promise<TimeSlot[]> {
    const dateStr = typeof date === 'string' ? date : toLocalYMD(date);
    const res = await this.client.request<{ data: TimeSlot[] }>(
      'GET',
      `/api/v1/booking-pages/${encodeURIComponent(slug)}/slots`,
      undefined,
      { date: dateStr },
    );
    return res.data;
  }
}

class BookingsResource {
  constructor(private readonly client: Clndr) {}

  async create(input: CreateBookingInput): Promise<Booking> {
    const res = await this.client.request<{ data: Booking }>('POST', '/api/v1/bookings', input);
    return res.data;
  }

  async list(params?: { status?: 'pending' | 'confirmed' | 'cancelled'; limit?: number }): Promise<Booking[]> {
    const res = await this.client.request<{ data: Booking[] }>('GET', '/api/v1/bookings', undefined, {
      status: params?.status,
      limit: params?.limit,
    });
    return res.data;
  }

  async get(id: string): Promise<Booking> {
    const res = await this.client.request<{ data: Booking }>(
      'GET',
      `/api/v1/bookings/${encodeURIComponent(id)}`,
    );
    return res.data;
  }

  async update(id: string, patch: { status: 'confirmed' | 'cancelled'; reason?: string }): Promise<Booking> {
    const res = await this.client.request<{ data: Booking }>(
      'PATCH',
      `/api/v1/bookings/${encodeURIComponent(id)}`,
      patch,
    );
    return res.data;
  }

  async cancel(id: string): Promise<{ success: true }> {
    return this.client.request<{ success: true }>('DELETE', `/api/v1/bookings/${encodeURIComponent(id)}`);
  }
}
