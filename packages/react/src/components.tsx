'use client';

import React, { ComponentType, FormEvent, Suspense, lazy, useMemo, useState } from 'react';
import type { BookingQuestion, TimeSlot } from '@clndr-pro/sdk';
import { useAvailableSlots, useBookingPage, useCreateBooking } from './hooks';

/**
 * Design goals:
 *  - Ship real working UI (not headless-only) so `npm i @clndr-pro/react` gets
 *    you a booking page immediately.
 *  - Let every piece be swapped. Pass `components={{ Button: MyButton }}` to
 *    use your Shadcn / MUI / Chakra primitives instead of the defaults.
 *  - Let every piece be restyled. Pass `classNames={{ root: '...' }}` to
 *    override a class without re-implementing the component.
 *  - No hard dep on a styling library. Defaults are plain HTML + a handful
 *    of minimal Tailwind-friendly class names that are easy to override.
 */

// -- slots --------------------------------------------------------------

type DivProps = React.HTMLAttributes<HTMLDivElement>;
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;
type InputProps = React.InputHTMLAttributes<HTMLInputElement>;
type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;
type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;
type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export interface ComponentSlots {
  Root?: ComponentType<DivProps>;
  Card?: ComponentType<DivProps>;
  Button?: ComponentType<ButtonProps>;
  Input?: ComponentType<InputProps>;
  Textarea?: ComponentType<TextareaProps>;
  /**
   * Renders `select` questions. Receives native `<select>` props, with the
   * question's options passed as `<option>` children (the first one is an
   * empty-value placeholder).
   */
  Select?: ComponentType<SelectProps>;
  Label?: ComponentType<LabelProps>;
  Heading?: ComponentType<React.HTMLAttributes<HTMLHeadingElement>>;
  Muted?: ComponentType<DivProps>;
  Error?: ComponentType<DivProps>;
  /**
   * Renders the booking page's markdown description. If you don't pass one,
   * the SDK lazy-loads a built-in `react-markdown` + `remark-gfm` default
   * (only fetched when a description is actually rendered). Pass your own to
   * use a different renderer — your code is bundled normally and the default
   * chunk is never requested.
   */
  MarkdownRenderer?: ComponentType<MarkdownRendererProps>;
}

const LazyDefaultMarkdownRenderer = lazy(() => import('./default-markdown-renderer'));

function SuspendedDefaultMarkdownRenderer(props: MarkdownRendererProps) {
  return (
    <Suspense fallback={null}>
      <LazyDefaultMarkdownRenderer {...props} />
    </Suspense>
  );
}

const defaultComponents: Required<ComponentSlots> = {
  Root: (p) => <div {...p} />,
  Card: (p) => <div {...p} />,
  Button: (p) => <button {...p} />,
  Input: (p) => <input {...p} />,
  Textarea: (p) => <textarea {...p} />,
  Select: (p) => <select {...p} />,
  Label: (p) => <label {...p} />,
  Heading: (p) => <h2 {...p} />,
  Muted: (p) => <div {...p} />,
  Error: (p) => <div {...p} />,
  MarkdownRenderer: SuspendedDefaultMarkdownRenderer,
};

export interface ClassNameMap {
  root?: string;
  card?: string;
  heading?: string;
  muted?: string;
  error?: string;
  label?: string;
  input?: string;
  textarea?: string;
  /** Class for `select` questions. Defaults to the `input` class. */
  select?: string;
  /** Class for `checkbox` question inputs. */
  checkbox?: string;
  buttonPrimary?: string;
  buttonSecondary?: string;
  slotGrid?: string;
  slotButton?: string;
  slotButtonSelected?: string;
  dateInput?: string;
  /**
   * Wrapper class for the markdown description block. Defaults to
   * `clndr-description` for consumers using class-name selectors; pass any
   * Tailwind utility (e.g. `'prose dark:prose-invert max-w-none'`) to opt
   * into a different layout.
   */
  description?: string;
}

const defaultClasses: Required<ClassNameMap> = {
  root: 'clndr-root',
  card: 'clndr-card',
  heading: 'clndr-heading',
  muted: 'clndr-muted',
  error: 'clndr-error',
  label: 'clndr-label',
  input: 'clndr-input',
  textarea: 'clndr-textarea',
  select: 'clndr-input',
  checkbox: 'clndr-checkbox',
  buttonPrimary: 'clndr-btn clndr-btn-primary',
  buttonSecondary: 'clndr-btn clndr-btn-secondary',
  slotGrid: 'clndr-slot-grid',
  slotButton: 'clndr-slot-btn',
  slotButtonSelected: 'clndr-slot-btn--selected',
  dateInput: 'clndr-date-input',
  description: 'clndr-description',
};

function mergeSlots(user?: ComponentSlots): Required<ComponentSlots> {
  return { ...defaultComponents, ...(user ?? {}) };
}

function mergeClasses(user?: ClassNameMap): Required<ClassNameMap> {
  const merged = { ...defaultClasses, ...(user ?? {}) };
  // Select questions used to render as text inputs, so an existing
  // `classNames.input` override should keep styling them.
  if (user?.select === undefined) merged.select = merged.input;
  return merged;
}

// -- BookingForm --------------------------------------------------------

export interface BookingFormProps {
  slug: string;
  /** Prefill the guest name / email fields. */
  prefill?: { name?: string; email?: string };
  classNames?: ClassNameMap;
  components?: ComponentSlots;
  onBooked?: (bookingId: string) => void;
}

/**
 * Full booking flow: pick a date → pick a slot → enter details → confirm.
 * This reads a `<ClndrProvider>` from context, fetches booking-page data
 * with a publishable key, and submits through the SDK.
 */
export function BookingForm({ slug, prefill, classNames, components, onBooked }: BookingFormProps) {
  const C = mergeSlots(components);
  const cls = mergeClasses(classNames);

  const { data: page, isLoading: loadingPage, error: pageError } = useBookingPage(slug);
  const [date, setDate] = useState<Date | null>(null);
  const { slots, isLoading: loadingSlots } = useAvailableSlots(slug, date);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const { create, isLoading: submitting, error: submitError, status } = useCreateBooking();

  const [form, setForm] = useState<{ name: string; email: string; responses: Record<string, string> }>({
    name: prefill?.name ?? '',
    email: prefill?.email ?? '',
    responses: {},
  });

  const minDate = useMemo(() => toYMD(new Date()), []);
  const maxDate = useMemo(
    () => (page ? toYMD(new Date(Date.now() + page.bookingPage.max_days_ahead * 86400000)) : undefined),
    [page],
  );

  if (loadingPage) {
    return (
      <C.Root className={cls.root}>
        <C.Muted className={cls.muted}>Loading…</C.Muted>
      </C.Root>
    );
  }

  if (pageError || !page) {
    return (
      <C.Root className={cls.root}>
        <C.Error className={cls.error}>{pageError?.message ?? 'Booking page not found.'}</C.Error>
      </C.Root>
    );
  }

  if (status === 'success') {
    const isApproval = page.bookingPage.booking_type === 'approval';
    return (
      <C.Root className={cls.root}>
        <C.Card className={cls.card}>
          <C.Heading className={cls.heading}>{isApproval ? 'Request sent' : 'Booking confirmed'}</C.Heading>
          <C.Muted className={cls.muted}>
            {isApproval
              ? 'Your request has been submitted. You will receive an email once it is approved.'
              : 'You will receive a confirmation email shortly.'}
          </C.Muted>
        </C.Card>
      </C.Root>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedSlot || !page) return;
    const answers = { ...form.responses };
    // A checkbox the guest never touched is still an answer: "No".
    for (const q of page.questions) {
      if (q.question_type === 'checkbox' && answers[q.id] === undefined) answers[q.id] = 'No';
    }
    const responses = Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer }));
    const res = await create({
      bookingPageId: page.bookingPage.id,
      guestName: form.name,
      guestEmail: form.email,
      startTime: selectedSlot.start,
      endTime: selectedSlot.end,
      responses,
    });
    onBooked?.(res.id);
  }

  const description = page.bookingPage.description?.trim();

  return (
    <C.Root className={cls.root}>
      <div>
        <C.Heading className={cls.heading}>{page.bookingPage.title}</C.Heading>
        <C.Muted className={cls.muted}>
          {page.userProfile.full_name ?? page.userProfile.username} · {page.bookingPage.duration_minutes} min
        </C.Muted>
      </div>

      {description ? <C.MarkdownRenderer content={description} className={cls.description} /> : null}

      {!selectedSlot ? (
        <div>
          <C.Label className={cls.label} htmlFor="clndr-date">
            Date
          </C.Label>
          <C.Input
            id="clndr-date"
            className={cls.dateInput}
            type="date"
            min={minDate}
            max={maxDate}
            value={date ? toYMD(date) : ''}
            onChange={(e) => setDate(parseLocalYMD(e.target.value))}
          />

          {date &&
            (loadingSlots ? (
              <C.Muted className={cls.muted}>Loading available times…</C.Muted>
            ) : slots.length === 0 ? (
              <C.Muted className={cls.muted}>No available slots for this date.</C.Muted>
            ) : (
              <div className={cls.slotGrid}>
                {slots.map((slot) => (
                  <C.Button
                    key={slot.start}
                    type="button"
                    className={cls.slotButton}
                    onClick={() => setSelectedSlot(slot)}
                  >
                    {formatTime(slot.start)}
                  </C.Button>
                ))}
              </div>
            ))}
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <C.Card className={cls.card}>
            <C.Muted className={cls.muted}>
              {formatDate(selectedSlot.start)} · {formatTime(selectedSlot.start)}
            </C.Muted>

            <div>
              <C.Label className={cls.label} htmlFor="clndr-name">
                Name *
              </C.Label>
              <C.Input
                id="clndr-name"
                className={cls.input}
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div>
              <C.Label className={cls.label} htmlFor="clndr-email">
                Email *
              </C.Label>
              <C.Input
                id="clndr-email"
                className={cls.input}
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            {page.questions.map((q: BookingQuestion) => (
              <QuestionField
                key={q.id}
                question={q}
                value={form.responses[q.id] ?? ''}
                onChange={(v) => setForm({ ...form, responses: { ...form.responses, [q.id]: v } })}
                C={C}
                cls={cls}
              />
            ))}

            {submitError && <C.Error className={cls.error}>{submitError.message}</C.Error>}

            <div style={{ display: 'flex', gap: 8 }}>
              <C.Button
                type="button"
                className={cls.buttonSecondary}
                onClick={() => setSelectedSlot(null)}
                disabled={submitting}
              >
                Back
              </C.Button>
              <C.Button type="submit" className={cls.buttonPrimary} disabled={submitting}>
                {submitting ? 'Booking…' : 'Confirm'}
              </C.Button>
            </div>
          </C.Card>
        </form>
      )}
    </C.Root>
  );
}

function QuestionField({
  question,
  value,
  onChange,
  C,
  cls,
}: {
  question: BookingQuestion;
  value: string;
  onChange: (v: string) => void;
  C: Required<ComponentSlots>;
  cls: Required<ClassNameMap>;
}) {
  const id = `clndr-q-${question.id}`;
  const required = question.is_required;
  let field: React.ReactNode;
  switch (question.question_type) {
    case 'textarea':
      field = (
        <C.Textarea
          id={id}
          className={cls.textarea}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    case 'select':
      field = (
        <C.Select
          id={id}
          className={cls.select}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select…</option>
          {(question.options ?? []).map((option, i) => (
            <option key={`${i}:${option}`} value={option}>
              {option}
            </option>
          ))}
        </C.Select>
      );
      break;
    case 'checkbox':
      // Answer is 'Yes' / 'No'; a required checkbox must be ticked. A native
      // input rather than the `Input` slot: design-system Input components
      // are text fields and render a checkbox as a full-width box.
      field = (
        <input
          id={id}
          type="checkbox"
          className={cls.checkbox}
          required={required}
          checked={value === 'Yes'}
          onChange={(e) => onChange(e.target.checked ? 'Yes' : 'No')}
        />
      );
      break;
    default:
      field = (
        <C.Input
          id={id}
          className={cls.input}
          type={inputType(question.question_type)}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
  return (
    <div>
      <C.Label className={cls.label} htmlFor={id}>
        {question.question_text} {required && '*'}
      </C.Label>
      {field}
    </div>
  );
}

function inputType(type: BookingQuestion['question_type']): string {
  if (type === 'email') return 'email';
  if (type === 'phone') return 'tel';
  return 'text';
}

/**
 * Parse an `<input type="date">` value (`YYYY-MM-DD`) as a *local* date.
 * `new Date('2026-10-14')` would be UTC midnight, which is still Oct 13 for
 * anyone west of UTC — and that's the day the slots request would ask for.
 */
function parseLocalYMD(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}
