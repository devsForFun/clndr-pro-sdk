# @clndr-pro/react

React components + hooks for [clndr.pro](https://www.clndr.pro). Full docs:
<https://docs.clndr.pro>. See also the [repo README](../../README.md).

## Next.js App Router

Put `<ClndrProvider>` in its own client component, so your root layout stays a
Server Component:

```tsx
// app/providers.tsx
'use client';
import { ClndrProvider } from '@clndr-pro/react';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClndrProvider publishableKey={process.env.NEXT_PUBLIC_CLNDR_PUBLISHABLE_KEY!}>
      {children}
    </ClndrProvider>
  );
}
```

```tsx
// app/layout.tsx (a Server Component)
import { Providers } from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

```tsx
// app/book/page.tsx (a Server Component)
import { BookingInline } from '@clndr-pro/react';

export default function Page() {
  return <BookingInline slug="30-min-intro" />;
}
```

Since 0.2.1 the built package starts with `"use client"`, so the components
can be imported straight into Server Components as above. On 0.2.0 and earlier,
import them from a `'use client'` file instead. For server-side API calls,
import `Clndr` from `@clndr-pro/sdk`; the copy re-exported here is a client
module.

Outside Next.js, wrap your app in the provider as usual:

```tsx
import { ClndrProvider, BookingInline } from '@clndr-pro/react';

<ClndrProvider publishableKey="clndr_pk_...">
  <BookingInline slug="30-min-intro" />
</ClndrProvider>;
```

`ClndrProvider` talks to `https://www.clndr.pro` by default; pass `baseUrl`
for a local or self-hosted instance.

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
| `Input`            | `<input>`                        | Text / email / phone (`type="tel"`) / date inputs           |
| `Textarea`         | `<textarea>`                     | Multi-line responses                                        |
| `Select`           | `<select>`                       | `select` questions; gets native `<select>` props with `<option>` children |
| `Label`            | `<label>`                        | Form labels                                                 |
| `MarkdownRenderer` | lazy-loaded `react-markdown` + `remark-gfm` | Renders `bookingPage.description` (see above)   |

## Booking questions

Each booking-page question renders by its `question_type`:

| `question_type` | Rendered as                                                         | Answer sent                |
| --------------- | ------------------------------------------------------------------- | -------------------------- |
| `text`          | `Input` (`type="text"`)                                             | the text                   |
| `email`         | `Input` (`type="email"`)                                            | the text                   |
| `phone`         | `Input` (`type="tel"`)                                              | the text                   |
| `textarea`      | `Textarea`                                                          | the text                   |
| `select`        | `Select`, with an empty placeholder option and then `options`       | the chosen option          |
| `checkbox`      | a native `<input type="checkbox">`; a required one must be ticked   | `'Yes'` or `'No'`          |

## Class name reference

`classNames` keys (all optional): `root`, `card`, `heading`, `muted`, `error`,
`label`, `input`, `textarea`, `select`, `checkbox`, `buttonPrimary`,
`buttonSecondary`, `slotGrid`, `slotButton`, `slotButtonSelected`,
`dateInput`, `description`.

- `select` defaults to whatever `input` resolves to, so an existing
  `classNames.input` override also styles select questions.
- `checkbox` defaults to `clndr-checkbox`.
