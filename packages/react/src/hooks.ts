'use client';

import { useCallback, useEffect, useState } from 'react';
import type { BookingPageDetail, TimeSlot, CreateBookingInput, Booking } from '@clndr-pro/sdk';
import { ClndrError } from '@clndr-pro/sdk';
import { useClndr } from './provider';

type Status = 'idle' | 'loading' | 'success' | 'error';

/**
 * Fetch a booking page by slug.
 *
 * Starts in `loading` when a slug is given, so a first render never looks
 * like "not found" before the request has even gone out.
 */
export function useBookingPage(slug: string | null) {
  const client = useClndr();
  const [data, setData] = useState<BookingPageDetail | null>(null);
  const [status, setStatus] = useState<Status>(slug ? 'loading' : 'idle');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!slug) return;
    let alive = true;
    setStatus('loading');
    setError(null);
    client.bookingPages
      .get(slug)
      .then((res: BookingPageDetail) => {
        if (!alive) return;
        setData(res);
        setStatus('success');
      })
      .catch((err: Error) => {
        if (!alive) return;
        setError(err);
        setStatus('error');
      });
    return () => {
      alive = false;
    };
  }, [client, slug]);

  return { data, status, error, isLoading: status === 'loading' };
}

/**
 * Fetch the open slots for a booking page on one day. Refetches when the
 * slug or the day changes, and when you call `refetch()` (after a booking
 * failed because someone else took the slot, say).
 *
 * The effect is keyed on the date's timestamp, not the Date object, so a
 * `new Date(...)` built during render doesn't loop. Earlier versions also
 * skipped a request whose slug and day matched the previous one; under
 * React Strict Mode that skip swallowed the only real request and left the
 * hook on `loading` forever.
 */
export function useAvailableSlots(slug: string | null, date: Date | null) {
  const client = useClndr();
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [status, setStatus] = useState<Status>(slug && date ? 'loading' : 'idle');
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);
  const time = date ? date.getTime() : null;

  useEffect(() => {
    if (!slug || time === null) return;
    let alive = true;
    setStatus('loading');
    setError(null);
    client.bookingPages
      .getSlots(slug, new Date(time))
      .then((res: TimeSlot[]) => {
        if (!alive) return;
        setSlots(res);
        setStatus('success');
      })
      .catch((err: Error) => {
        if (!alive) return;
        setError(err);
        setStatus('error');
      });
    return () => {
      alive = false;
    };
  }, [client, slug, time, nonce]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  return { slots, status, error, isLoading: status === 'loading', refetch };
}

/**
 * Imperative hook for creating a booking. Returns `{ create, data, status,
 * error }`. Call `create({...})` from a submit handler.
 */
export function useCreateBooking() {
  const client = useClndr();
  const [data, setData] = useState<Booking | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<Error | null>(null);

  const create = useCallback(
    async (input: CreateBookingInput) => {
      setStatus('loading');
      setError(null);
      try {
        const res = await client.bookings.create(input);
        setData(res);
        setStatus('success');
        return res;
      } catch (err) {
        const e = err as Error;
        setError(e);
        setStatus('error');
        throw e;
      }
    },
    [client],
  );

  return {
    create,
    data,
    status,
    error: error as ClndrError | Error | null,
    isLoading: status === 'loading',
  };
}
