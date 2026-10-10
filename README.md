# clndr-sdk

Official TypeScript SDK and React components for [clndr.pro](https://www.clndr.pro).

**Docs:** <https://docs.clndr.pro>

This monorepo contains two packages:

| Package        | Description                                                              |
| -------------- | ------------------------------------------------------------------------ |
| `@clndr-pro/sdk`   | Server-first TypeScript client. Node, Edge, Bun, Deno.                   |
| `@clndr-pro/react` | Drop-in React components + hooks with full styling / primitive overrides |

## Quick start

### 1. Create API keys

In your clndr.pro dashboard (`/api-keys`), create:

- A **secret key** (`clndr_sk_...`) for server use — never ship to the browser.
- A **publishable key** (`clndr_pk_...`) for the browser — scoped to read
  booking pages, read slots, and create guest bookings.

### 2. Server-side usage (`@clndr-pro/sdk`)

```ts
import { Clndr } from '@clndr-pro/sdk';

const clndr = new Clndr(process.env.CLNDR_SECRET_KEY!);

const pages = await clndr.bookingPages.list();
const page = await clndr.bookingPages.get('30-min-intro');
// A `YYYY-MM-DD` day on the host's calendar, or a Date (its local calendar day).
const slots = await clndr.bookingPages.getSlots('30-min-intro', '2026-10-14');

const booking = await clndr.bookings.create({
  bookingPageId: page.bookingPage.id,
  guestName: 'Ada Lovelace',
  guestEmail: 'ada@example.com',
  startTime: slots[0].start,
  endTime: slots[0].end,
});

await clndr.bookings.update(booking.id, { status: 'confirmed' });
await clndr.bookings.cancel(booking.id);
```

Requests go to `https://www.clndr.pro` by default. Pass `baseUrl` to point
at a local or self-hosted instance:

```ts
const clndr = new Clndr({ apiKey: process.env.CLNDR_SECRET_KEY!, baseUrl: 'http://localhost:3000' });
```

> Use the `www` host if you set `baseUrl` yourself. `https://clndr.pro`
> redirects to `https://www.clndr.pro`, and `fetch` drops the
> `Authorization` header on that cross-host redirect, so every call fails
> with `401 Missing API key`. SDK versions up to 0.1.4 defaulted to the
> apex host and hit this; 0.1.5 defaults to `www`.

### 3. React components (`@clndr-pro/react`)

Put the provider in its own client component, so the root layout stays a
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
// app/layout.tsx (a Server Component; no 'use client')
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

From `@clndr-pro/react` 0.2.1 on, the package's built entry starts with
`"use client"`, so you can import `<BookingInline>`, `<BookingForm>`,
`<BookingModal>` and `<ClndrProvider>` straight into Server Components like
the page above. On 0.2.0 and earlier, render them from a file that starts
with `'use client'`. Server code that needs the API client itself should
import `Clndr` from `@clndr-pro/sdk`, not from `@clndr-pro/react`.

## Customization

The React components ship with minimal default markup. Every element can be
replaced via the `components` prop, and every class name overridden via
`classNames`. This makes them drop-in compatible with Shadcn UI, MUI, Chakra,
or any other design system.

Booking-page descriptions written in markdown are **rendered out of the box** —
headings, lists, links, GFM tables, code blocks — using semantic shadcn/Tailwind
tokens so they inherit your theme. The renderer is lazy-loaded in a separate
chunk: pages without a description, or apps that pass their own
`MarkdownRenderer` slot, never download `react-markdown` + `remark-gfm`. See the
[react package README](./packages/react/README.md#markdown-descriptions-rendered-for-you)
for the slot API.

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
const { slots, refetch } = useAvailableSlots(slug, date); // refetch() after a taken slot
const { create, isLoading } = useCreateBooking();
```

## API reference

- `Clndr.bookingPages.list()` → `BookingPage[]`
- `Clndr.bookingPages.get(slug)` → `{ bookingPage, userProfile, questions }`
- `Clndr.bookingPages.getSlots(slug, date)` → `TimeSlot[]`. `date` is a
  `YYYY-MM-DD` string, read as that day in the host's timezone (sent
  unchanged), or a `Date`, sent as the `YYYY-MM-DD` of its **local** calendar
  day. Slots come back as UTC ISO timestamps.
- `Clndr.bookings.create({ bookingPageId, guestName, guestEmail, startTime, endTime, responses? })`
- `Clndr.bookings.list({ status?, limit? })`
- `Clndr.bookings.get(id)`
- `Clndr.bookings.update(id, { status, reason? })`
- `Clndr.bookings.cancel(id)`

## Key types and scopes

| Key type       | Prefix       | Safe in browser | Default scopes                                                        |
| -------------- | ------------ | --------------- | --------------------------------------------------------------------- |
| `secret`       | `clndr_sk_*` | ❌              | `booking_pages:read booking_pages:slots bookings:create bookings:read bookings:write` |
| `publishable`  | `clndr_pk_*` | ✅              | `booking_pages:read booking_pages:slots bookings:create`              |

The API enforces that any booking created with either key type can only be
scheduled on booking pages owned by that key's user. Publishable keys cannot
be used to read or modify existing bookings.

## Guides

- **[TESTING.md](./TESTING.md)** — end-to-end Next.js testing loop (local
  clndr.pro + SDK + every surface).
- **[PUBLISHING.md](./PUBLISHING.md)** — pushing to the `clndr-pro` GitHub
  org, publishing to npm, deploying the clndr.pro API.
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** — dev setup and release flow.

## License

MIT
