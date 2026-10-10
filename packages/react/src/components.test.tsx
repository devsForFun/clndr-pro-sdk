// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Clndr } from '@clndr-pro/sdk';
import type { BookingPageDetail, BookingQuestion } from '@clndr-pro/sdk';
import { ClndrProvider } from './provider';
import { BookingForm, BookingFormProps } from './components';

// West of UTC is where `new Date('YYYY-MM-DD')` (UTC midnight) lands on the
// previous local day, so that's where the date-input bug showed up.
const originalTZ = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'America/Los_Angeles';
  // Guard: if the runtime ignored the TZ change, these tests prove nothing.
  expect(new Date('2026-10-14T03:00:00Z').getDate()).toBe(13);
});
afterAll(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});
afterEach(cleanup);

function question(partial: Partial<BookingQuestion> & Pick<BookingQuestion, 'id' | 'question_type'>): BookingQuestion {
  return {
    question_text: partial.id,
    options: null,
    is_required: false,
    order_index: 0,
    ...partial,
  };
}

function pageDetail(bookingType: 'direct' | 'approval', questions: BookingQuestion[]): BookingPageDetail {
  return {
    bookingPage: {
      id: 'bp_1',
      slug: 'intro',
      title: 'Intro call',
      description: null,
      duration_minutes: 30,
      booking_type: bookingType,
      max_days_ahead: 60,
      buffer_time_minutes: 0,
      visibility: 'public',
      auto_generate_meet_link: false,
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
    },
    userProfile: { username: 'ada', full_name: 'Ada Lovelace', bio: null, avatar_url: null, timezone: 'UTC' },
    questions,
  };
}

/** A real Clndr client backed by an in-memory fake of the v1 API. */
function fakeApi(detail: BookingPageDetail) {
  const slotDates: (string | null)[] = [];
  const bookingBodies: any[] = [];
  const json = (data: unknown, status = 200) =>
    Promise.resolve(new Response(JSON.stringify({ data }), { status, headers: { 'Content-Type': 'application/json' } }));
  const fetchImpl: typeof fetch = (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === '/api/v1/booking-pages/intro') return json(detail);
    if (url.pathname === '/api/v1/booking-pages/intro/slots') {
      slotDates.push(url.searchParams.get('date'));
      return json([{ start: '2026-10-14T17:00:00Z', end: '2026-10-14T17:30:00Z' }]);
    }
    if (url.pathname === '/api/v1/bookings' && init?.method === 'POST') {
      bookingBodies.push(JSON.parse(String(init.body)));
      return json({ id: 'bk_1' }, 201);
    }
    return json(null, 404);
  };
  const client = new Clndr({ apiKey: 'clndr_pk_test', fetch: fetchImpl });
  return { client, slotDates, bookingBodies };
}

/** Render the form, pick 2026-10-14 in the date input, and pick the first slot. */
async function renderAndPickSlot(detail: BookingPageDetail, props: Partial<BookingFormProps> = {}) {
  const api = fakeApi(detail);
  render(
    <ClndrProvider client={api.client}>
      <BookingForm slug="intro" {...props} />
    </ClndrProvider>,
  );
  await screen.findByText('Intro call');

  const dateInput = screen.getByLabelText('Date') as HTMLInputElement;
  fireEvent.change(dateInput, { target: { value: '2026-10-14' } });
  // The picked day is what's shown and what's asked for, not the day before.
  expect(dateInput.value).toBe('2026-10-14');
  await waitFor(() => expect(api.slotDates).toEqual(['2026-10-14']));

  const [slotButton] = await screen.findAllByRole('button');
  fireEvent.click(slotButton);
  await screen.findByRole('button', { name: 'Confirm' });

  fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Ada' } });
  fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'ada@example.com' } });
  return api;
}

describe('<BookingForm>', () => {
  it('asks for slots on the local day picked in the date input', async () => {
    await renderAndPickSlot(pageDetail('direct', []));
  });

  it('renders phone, select and checkbox questions with the right controls', async () => {
    const api = await renderAndPickSlot(
      pageDetail('approval', [
        question({ id: 'phone', question_text: 'Phone', question_type: 'phone', is_required: true }),
        question({ id: 'tool', question_text: 'Meeting tool', question_type: 'select', options: ['Zoom', 'Google Meet'], is_required: true }),
        question({ id: 'terms', question_text: 'I agree to the terms', question_type: 'checkbox', is_required: true }),
        question({ id: 'news', question_text: 'Send me news', question_type: 'checkbox' }),
        question({ id: 'notes', question_text: 'Notes', question_type: 'text' }),
      ]),
      { classNames: { input: 'my-input' } },
    );

    const phone = screen.getByLabelText(/Phone/) as HTMLInputElement;
    expect(phone.tagName).toBe('INPUT');
    expect(phone.type).toBe('tel');
    expect(phone.className).toBe('my-input');
    expect((screen.getByLabelText(/Notes/) as HTMLInputElement).type).toBe('text');

    const tool = screen.getByLabelText(/Meeting tool/) as HTMLSelectElement;
    expect(tool.tagName).toBe('SELECT');
    expect(tool.required).toBe(true);
    // An existing `classNames.input` override keeps styling select questions.
    expect(tool.className).toBe('my-input');
    expect(Array.from(tool.options).map((o) => o.value)).toEqual(['', 'Zoom', 'Google Meet']);
    expect(tool.value).toBe('');

    const terms = screen.getByLabelText(/I agree/) as HTMLInputElement;
    expect(terms.type).toBe('checkbox');
    expect(terms.required).toBe(true);
    expect(terms.checked).toBe(false);
    expect((screen.getByLabelText(/Send me news/) as HTMLInputElement).required).toBe(false);

    fireEvent.change(phone, { target: { value: '+1 555 0100' } });
    fireEvent.change(tool, { target: { value: 'Zoom' } });

    // Required checkbox not ticked: the browser blocks the submit.
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await new Promise((r) => setTimeout(r, 20));
    expect(api.bookingBodies).toHaveLength(0);

    fireEvent.click(terms);
    expect(terms.checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    // Approval pages get "Request sent", with the existing sub-text.
    await screen.findByText('Request sent');
    expect(screen.queryByText('Booking confirmed')).toBeNull();
    screen.getByText('Your request has been submitted. You will receive an email once it is approved.');

    expect(api.bookingBodies).toHaveLength(1);
    const body = api.bookingBodies[0];
    expect(body).toMatchObject({
      bookingPageId: 'bp_1',
      guestName: 'Ada',
      guestEmail: 'ada@example.com',
      startTime: '2026-10-14T17:00:00Z',
      endTime: '2026-10-14T17:30:00Z',
    });
    const answers = Object.fromEntries(body.responses.map((r: any) => [r.questionId, r.answer]));
    // Untouched optional checkbox answers "No"; untouched text is omitted as before.
    expect(answers).toEqual({ phone: '+1 555 0100', tool: 'Zoom', terms: 'Yes', news: 'No' });
  });

  it('shows "Booking confirmed" for direct pages and uses the Select slot / select class', async () => {
    const api = await renderAndPickSlot(
      pageDetail('direct', [
        question({ id: 'tool', question_text: 'Meeting tool', question_type: 'select', options: ['Zoom'] }),
      ]),
      {
        components: { Select: (p) => <select data-custom-select="" {...p} /> },
        classNames: { input: 'my-input', select: 'my-select' },
      },
    );

    const tool = screen.getByLabelText(/Meeting tool/) as HTMLSelectElement;
    expect(tool.hasAttribute('data-custom-select')).toBe(true);
    expect(tool.className).toBe('my-select');
    expect(tool.required).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await screen.findByText('Booking confirmed');
    screen.getByText('You will receive a confirmation email shortly.');
    // Optional select left on the placeholder: not answered.
    expect(api.bookingBodies[0].responses).toEqual([]);
  });

  it('defaults the select class to clndr-input and the checkbox class to clndr-checkbox', async () => {
    await renderAndPickSlot(
      pageDetail('direct', [
        question({ id: 'tool', question_text: 'Meeting tool', question_type: 'select', options: ['Zoom'] }),
        question({ id: 'terms', question_text: 'I agree', question_type: 'checkbox' }),
      ]),
    );
    expect(screen.getByLabelText(/Meeting tool/).className).toBe('clndr-input');
    expect(screen.getByLabelText(/I agree/).className).toBe('clndr-checkbox');
  });
});
