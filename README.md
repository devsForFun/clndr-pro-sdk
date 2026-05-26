# clndr-sdk

Official TypeScript SDK and React components for [clndr.pro](https://clndr.pro).

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
const slots = await clndr.bookingPages.getSlots('30-min-intro', new Date());

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

### 3. React components (`@clndr-pro/react`)

```tsx
// app/layout.tsx
'use client';
import { ClndrProvider } from '@clndr-pro/react';

export default function Layout({ children }) {
  return (
    <ClndrProvider publishableKey={process.env.NEXT_PUBLIC_CLNDR_PUBLISHABLE_KEY!}>
      {children}
    </ClndrProvider>
  );
}
```

```tsx
// app/book/page.tsx
import { BookingInline } from '@clndr-pro/react';
export default function Page() {
  return <BookingInline slug="30-min-intro" />;
}
```

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
const { slots } = useAvailableSlots(slug, date);
const { create, isLoading } = useCreateBooking();
```

## API reference

- `Clndr.bookingPages.list()` → `BookingPage[]`
- `Clndr.bookingPages.get(slug)` → `{ bookingPage, userProfile, questions }`
- `Clndr.bookingPages.getSlots(slug, date)` → `TimeSlot[]`
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
