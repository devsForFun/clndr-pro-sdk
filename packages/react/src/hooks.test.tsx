// @vitest-environment jsdom
import React, { StrictMode } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Clndr } from '@clndr-pro/sdk';
import { ClndrProvider } from './provider';
import { useAvailableSlots, useBookingPage } from './hooks';

afterEach(cleanup);

function fakeClient() {
  const slotRequests: string[] = [];
  const fetchImpl: typeof fetch = (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/slots')) slotRequests.push(url.searchParams.get('date') ?? '');
    const data = url.pathname.endsWith('/slots')
      ? [{ start: '2026-10-14T17:00:00.000Z', end: '2026-10-14T17:30:00.000Z' }]
      : { bookingPage: { id: 'p1', slug: 'intro' }, userProfile: {}, questions: [] };
    return Promise.resolve(new Response(JSON.stringify({ data }), { status: 200 }));
  };
  return { client: new Clndr({ apiKey: 'clndr_pk_test', fetch: fetchImpl }), slotRequests };
}

let refetchSlots: () => void = () => {};

/** Mounts with a date already set, like a slot list shown after a day is picked. */
function Slots({ date }: { date: Date }) {
  const { status, slots, refetch } = useAvailableSlots('intro', date);
  refetchSlots = refetch;
  return <p data-testid="slots">{`${status}:${slots.length}`}</p>;
}

function Page() {
  const { status } = useBookingPage('intro');
  return <p data-testid="page">{status}</p>;
}

describe('useAvailableSlots', () => {
  it('loads under React Strict Mode when it mounts with a date', async () => {
    const { client } = fakeClient();
    render(
      <StrictMode>
        <ClndrProvider client={client}>
          <Slots date={new Date(2026, 9, 14)} />
        </ClndrProvider>
      </StrictMode>,
    );
    await waitFor(() => expect(screen.getByTestId('slots').textContent).toBe('success:1'));
  });

  it("doesn't refetch for a new Date object on the same day, and does on refetch()", async () => {
    const { client, slotRequests } = fakeClient();
    const view = render(
      <ClndrProvider client={client}>
        <Slots date={new Date(2026, 9, 14)} />
      </ClndrProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('slots').textContent).toBe('success:1'));
    view.rerender(
      <ClndrProvider client={client}>
        <Slots date={new Date(2026, 9, 14)} />
      </ClndrProvider>,
    );
    expect(slotRequests).toEqual(['2026-10-14']);

    act(() => refetchSlots());
    await waitFor(() => expect(slotRequests).toEqual(['2026-10-14', '2026-10-14']));
    await waitFor(() => expect(screen.getByTestId('slots').textContent).toBe('success:1'));
  });
});

describe('useBookingPage', () => {
  it('starts in loading when given a slug', () => {
    const { client } = fakeClient();
    render(
      <ClndrProvider client={client}>
        <Page />
      </ClndrProvider>,
    );
    expect(screen.getByTestId('page').textContent).toBe('loading');
  });
});
