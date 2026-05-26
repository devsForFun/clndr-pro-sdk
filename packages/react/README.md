# @clndr-pro/react

React components + hooks for clndr.pro. See the [repo README](../../README.md)
for full docs.

```tsx
'use client';
import { ClndrProvider, BookingInline } from '@clndr-pro/react';

<ClndrProvider publishableKey={process.env.NEXT_PUBLIC_CLNDR_PUBLISHABLE_KEY!}>
  <BookingInline slug="30-min-intro" />
</ClndrProvider>;
```

## Markdown descriptions, rendered for you

Booking pages on clndr.pro author their descriptions in markdown. `@clndr-pro/react` renders them out of the box — headings, lists, links, GFM tables, code blocks, the lot — so you don't have to wire up `react-markdown` yourself. The default uses semantic shadcn/Tailwind tokens (`text-primary`, `bg-muted`, `border-border`, `text-muted-foreground`), so the description picks up your theme automatically.

The renderer is **lazy-loaded** via a separate ESM chunk. If your booking pages don't carry a description, or you pass your own renderer, your consumers never download `react-markdown` + `remark-gfm` (~50 KB).

### Use the default

Nothing to do — `<BookingForm>`, `<BookingInline>`, and `<BookingModal>` all render `bookingPage.description` automatically when present.

### Override with your own renderer

If you already ship a `<Markdown>` (MDX, content collection, custom prose component, whatever), pass it through `components`:

```tsx
import { BookingInline } from '@clndr-pro/react';
import { MyMarkdown } from '@/components/markdown';

<BookingInline
  slug="30-min-intro"
  components={{
    MarkdownRenderer: ({ content, className }) => (
      <MyMarkdown source={content} className={className} />
    ),
  }}
/>;
```

Your renderer's chunk is bundled normally; the default chunk is never requested.

### Customize the wrapper

The wrapper around the rendered markdown takes a class via `classNames.description`. Default is `clndr-description`. Drop a Tailwind `prose` class for a different layout:

```tsx
<BookingInline
  slug="30-min-intro"
  classNames={{ description: 'prose prose-zinc dark:prose-invert max-w-none mb-4' }}
/>;
```

## Customization

The React components ship with minimal default markup. Every element can be
replaced via the `components` prop, and every class name overridden via
`classNames`. This makes them drop-in compatible with Shadcn UI, MUI, Chakra,
or any other design system.

```tsx
import { BookingForm } from '@clndr-pro/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

<BookingForm
  slug="30-min-intro"
  components={{
    Button,
    Input,
    Label,
    Card: (props) => <div className="rounded-lg border p-4" {...props} />,
  }}
  classNames={{
    buttonPrimary: 'w-full',
    slotGrid: 'grid grid-cols-3 gap-2',
  }}
/>;
```

Or go even lower-level with hooks:

```tsx
import { useBookingPage, useAvailableSlots, useCreateBooking } from '@clndr-pro/react';

const { data: page } = useBookingPage(slug);
const { slots } = useAvailableSlots(slug, date);
const { create, isLoading } = useCreateBooking();
```

## Slot reference

`<BookingForm>` accepts a `components` prop with these slots — each one is optional and falls back to a minimal default:

| Slot               | Default                          | Purpose                                                     |
| ------------------ | -------------------------------- | ----------------------------------------------------------- |
| `Root`             | `<div>`                          | Outer container                                             |
| `Card`             | `<div>`                          | Form / confirmation card                                    |
| `Heading`          | `<h2>`                           | Booking page title                                          |
| `Muted`            | `<div>`                          | Secondary text (meta, loading, empty states)                |
| `Error`            | `<div>`                          | Error messages                                              |
| `Button`           | `<button>`                       | Primary, secondary, and slot buttons                        |
| `Input`            | `<input>`                        | Text / email / date inputs                                  |
| `Textarea`         | `<textarea>`                     | Multi-line responses                                        |
| `Label`            | `<label>`                        | Form labels                                                 |
| `MarkdownRenderer` | lazy-loaded `react-markdown` + `remark-gfm` | Renders `bookingPage.description` (see above)   |
