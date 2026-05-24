# Testing the SDK on a Next.js project

This guide walks through a complete local loop: run the dfid hub and
clndr.pro locally, wire up the SDK in a brand-new Next.js app, exercise
every public surface, and verify the database.

---

## 0. Prerequisites

- Node.js 20+
- Docker Desktop (for local Supabase)
- Supabase CLI (`brew install supabase/tap/supabase` or see
  <https://supabase.com/docs/guides/local-development>)
- The **devsforfun ID** repo cloned alongside (`../id` relative to this
  one). clndr.pro authenticates via dfid and all Google API access
  (Calendar sync, Meet link generation) is proxied through the hub.
- A Google Cloud OAuth client registered on the **dfid hub side** with
  the `/api/integrations/google/link/callback` redirect URI added — set
  up once per machine. See `../id/docs/SETUP_GOOGLE_AUTH.md`. clndr.pro
  itself has no Google OAuth client; the hub owns it.

---

## 1. Boot the dfid hub locally

Open a terminal for the hub. Its dev server runs on `:3001` and its
Supabase stack uses offset ports (`:54331/54332/...`) so it doesn't
collide with the clndr.pro stack on the defaults.

```bash
cd ../id
supabase start                         # offset-port Supabase
supabase db reset                      # apply all migrations
npm install
npm run dev                            # http://localhost:3001
```

Sign in (or create an account via `/register`), then visit
`/gotham/projects/new`. Create a project — the success panel shows
**5 credentials shown once**: project_id, signing_secret, oauth
client_id, oauth client_secret, and a connect-Google note. Copy them.
Register `http://localhost:3000/auth/callback` as a redirect URI on the
OAuth client.

Also visit `/settings/connected-accounts/google` and click "Link Google
account" — this is what enables Meet link creation later. The link
needs the `https://www.googleapis.com/auth/calendar` and
`https://www.googleapis.com/auth/meetings.space.created` scopes.

---

## 2. Run clndr.pro locally

Open a second terminal. clndr.pro's dev server runs on `:3000` and its
own Supabase stack uses the default ports (`:54321/54322/...`) — they
don't collide with the hub's stack because we offset the hub.

```bash
cd ../clndr-pro
cp .env.example .env.local
# Fill in: DEVSFORFUN_ID_URL (http://localhost:3001), the 5 dfid creds
# from §1, the satellite's own Supabase URL/keys after `supabase start`,
# and Resend creds if you want email confirmations.

# IMPORTANT: clndr.pro uses TOKEN RE-MINTING, NOT the hub's signing key.
# Generate the satellite's OWN signing key and point the app at it:
supabase gen signing-key --algorithm ES256   # writes ./supabase/signing_keys.json
# Set SUPABASE_JWT_SIGNING_KEY in clndr-pro/.env.local to that file's contents
# (config.toml already loads it for local PostgREST via signing_keys_path).
# See clndr-pro/README.md + INTEGRATION_HANDOFF.md §2.7(b).

supabase start                         # default-port Supabase
supabase db reset                      # apply all migrations

# Make sure GITHUB_TOKEN is exported so npm install can fetch
# @devsforfun/id-sdk from GitHub Packages. PAT scope: read:packages.
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx
npm install
npm run dev                            # http://localhost:3000
```

Sign in (you'll be bounced through the dfid hub OAuth flow), then visit
**Settings → API Keys**. Create two keys:

- `clndr_sk_...` — **secret**, check all scopes. Copy to a scratch file.
- `clndr_pk_...` — **publishable**. Scopes are auto-limited to
  `booking_pages:read`, `booking_pages:slots`, `bookings:create`.

Create at least one active booking page (e.g. slug `30-min-intro`) so the
SDK has something to call. Note the **slug**. If you want to exercise
the Meet-link flow, toggle `auto_generate_meet_link = true` on the
booking page — this requires Google to be linked at the hub (step 1).

---

## 3. Build the SDK packages

```bash
cd /path/to/clndr-pro-sdk         # this repo's root
npm install
npm run build --workspace @clndr-pro/sdk --workspace @clndr-pro/react
```

The workspace setup makes `@clndr-pro/sdk` and `@clndr-pro/react`
resolvable by any app inside this repo. For a project **outside** this
repo, see § 4b (link) or § 4c (tarball).

---

## 4. Hook the SDK into a Next.js app

### 4a. Inside this repo — use the bundled example

```bash
cd examples/nextjs
cp .env.example .env.local
# CLNDR_SECRET_KEY=clndr_sk_...
# NEXT_PUBLIC_CLNDR_PUBLISHABLE_KEY=clndr_pk_...
# NEXT_PUBLIC_CLNDR_BASE_URL=http://localhost:3000
npm run dev -- -p 3002                 # different port from clndr.pro AND the hub
```

Open <http://localhost:3002/book>.

### 4b. In a separate Next.js app — npm link

From a fresh project:

```bash
npx create-next-app@latest my-app --ts --app --no-tailwind
cd my-app

# link the built packages
npm link /path/to/clndr-pro-sdk/packages/sdk \
         /path/to/clndr-pro-sdk/packages/react

# Next.js needs to transpile the linked workspace packages
# (edit next.config.ts)
```

Add to `next.config.ts`:

```ts
const nextConfig = { transpilePackages: ['@clndr-pro/sdk', '@clndr-pro/react'] };
export default nextConfig;
```

Then follow the same env + provider setup as § 4a.

### 4c. Any project — pack tarballs

```bash
cd /path/to/clndr-pro-sdk/packages/sdk   && npm pack
cd /path/to/clndr-pro-sdk/packages/react && npm pack
# produces clndr-pro-sdk-0.1.3.tgz and clndr-pro-react-0.1.3.tgz
# install in the target app:
npm i /path/to/clndr-pro-sdk-0.1.3.tgz /path/to/clndr-pro-react-0.1.3.tgz
```

---

## 5. Wire the provider

```tsx
// app/provider.tsx
'use client';
import { ClndrProvider } from '@clndr-pro/react';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClndrProvider
      publishableKey={process.env.NEXT_PUBLIC_CLNDR_PUBLISHABLE_KEY!}
      baseUrl={process.env.NEXT_PUBLIC_CLNDR_BASE_URL /* omit for prod */}
    >
      {children}
    </ClndrProvider>
  );
}
```

```tsx
// app/layout.tsx
import { Providers } from './provider';
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html><body><Providers>{children}</Providers></body></html>;
}
```

---

## 6. Test every surface

### 6.1 `<BookingInline>` — the one-liner

```tsx
// app/book/page.tsx
import { BookingInline } from '@clndr-pro/react';
export default function Page() {
  return <BookingInline slug="30-min-intro" />;
}
```

**Verify:**
- Page renders with title + duration.
- Picking a date loads slots (watch Network tab: `GET /api/v1/booking-pages/30-min-intro/slots?date=...` returns `200`).
- Picking a slot shows the name/email form.
- Submitting creates a booking (watch `POST /api/v1/bookings` → `201`).
- Back in clndr.pro, `/meetings` lists the new booking.

### 6.2 `<BookingModal>` — modal overlay

```tsx
'use client';
import { useState } from 'react';
import { BookingModal } from '@clndr-pro/react';

export default function Page() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Book</button>
      <BookingModal open={open} onOpenChange={setOpen} slug="30-min-intro" />
    </>
  );
}
```

**Verify:** Esc closes, click outside closes, successful booking auto-closes after ~2.5s.

### 6.3 Customization — Shadcn primitives

```tsx
import { BookingForm } from '@clndr-pro/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';

<BookingForm
  slug="30-min-intro"
  components={{ Button, Input, Label, Card: Card as any }}
  classNames={{
    root: 'space-y-4',
    slotGrid: 'grid grid-cols-3 gap-2',
    buttonPrimary: 'w-full',
    buttonSecondary: 'w-full',
  }}
/>;
```

**Verify:** visible elements are your Shadcn components; Tailwind classes apply.

### 6.4 Hooks — build your own UI

```tsx
'use client';
import { useBookingPage, useAvailableSlots, useCreateBooking } from '@clndr-pro/react';
import { useState } from 'react';

export default function Custom() {
  const [date, setDate] = useState<Date | null>(null);
  const { data } = useBookingPage('30-min-intro');
  const { slots } = useAvailableSlots('30-min-intro', date);
  const { create, isLoading } = useCreateBooking();
  // ...
}
```

**Verify:** `useBookingPage` resolves, `useAvailableSlots` refetches on date change, `create()` throws a `ClndrError` on validation failure and includes `.status` + `.data`.

### 6.5 Server-side SDK — the admin surface

```ts
// app/api/bookings/route.ts
import { NextResponse } from 'next/server';
import { Clndr } from '@clndr-pro/sdk';

export async function GET() {
  const clndr = new Clndr({
    apiKey: process.env.CLNDR_SECRET_KEY!,
    baseUrl: process.env.CLNDR_BASE_URL /* omit for prod */,
  });
  return NextResponse.json(await clndr.bookings.list());
}
```

**Verify from terminal:**

```bash
curl http://localhost:3002/api/bookings | jq
# and directly:
curl -H "Authorization: Bearer clndr_sk_..." http://localhost:3000/api/v1/bookings | jq
```

### 6.6 Scope enforcement (negative tests)

- Use the **publishable** key to hit `GET /api/v1/bookings` → expect `403` with `"missing required scope(s): bookings:read"`.
- Use any key to POST a booking with a `bookingPageId` you don't own → expect `403`.
- Use a revoked or deleted key → expect `401 Invalid API key`.

### 6.7 Race condition / double booking

Open two terminals:

```bash
BODY='{"bookingPageId":"...","guestName":"A","guestEmail":"a@x.com","startTime":"...","endTime":"..."}'
# Tab 1
curl -X POST -H "Authorization: Bearer $KEY" -H "content-type: application/json" -d "$BODY" http://localhost:3000/api/v1/bookings &
# Tab 2
curl -X POST -H "Authorization: Bearer $KEY" -H "content-type: application/json" -d "$BODY" http://localhost:3000/api/v1/bookings &
```

Exactly one should return `201`; the other returns `400 This time slot is no longer available.`

### 6.8 Google Meet link end-to-end (via dfid hub)

Preconditions:
- The booking page has `auto_generate_meet_link = true`.
- The owner has linked Google at the dfid hub (step 1) — NOT at clndr.pro
  itself (clndr.pro has no Google OAuth flow anymore; the hub owns it).

Create a booking via the SDK. In clndr.pro's DB:

```sql
SELECT id, google_meet_link, google_calendar_event_id, google_calendar_id
FROM meetings ORDER BY created_at DESC LIMIT 1;
```

All three columns should be populated. The Meet link should appear in
the guest confirmation email (check the Resend dashboard or Mailpit).

Behind the scenes, clndr.pro's booking handler called
`dfid.google.calendar.createEvent(userId, ..., { query: { conferenceDataVersion: 1 } })`
through the hub's `/api/proxy/google/calendar/events/insert` endpoint.
The hub holds the owner's Google access_token + refresh_token; clndr.pro
never sees them.

### 6.9 CORS sanity check

From any browser console on a third-party origin:

```js
fetch('http://localhost:3000/api/v1/booking-pages/30-min-intro', {
  headers: { Authorization: 'Bearer clndr_pk_...' }
}).then(r => r.json()).then(console.log);
```

Expect `200` with the booking-page payload and no CORS error.

---

## 7. Troubleshooting

| Symptom                                         | Likely cause / fix                                                                                                                                    |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ClndrError: Missing API key`                   | Provider missing `publishableKey`, or `.env.local` not loaded (restart `next dev`).                                                                   |
| `ClndrError: API key is missing required scope` | You're using a publishable key for an owner-only action. Either use the secret key on the server or add the scope (if it's allowed on the key type). |
| `TypeError: useClndr must be used inside <ClndrProvider>` | Component rendered server-side; add `'use client'` to the page/component. |
| CORS error in the browser                       | Base URL is incorrect (pointing to a different origin than you're calling). Check `NEXT_PUBLIC_CLNDR_BASE_URL`.                                       |
| Slot list empty                                 | Owner has no availability set, or the date is outside `max_days_ahead`.                                                                               |
| "Google Calendar not connected"                 | Owner hasn't linked Google **at the dfid hub**. Visit `http://localhost:3001/settings/connected-accounts/google` and link there — not via clndr.pro.  |
| `npm install` errors `401` on `@devsforfun/id-sdk` | `$GITHUB_TOKEN` not exported in the shell running clndr.pro's install. PAT needs `read:packages`. |
| RLS-empty results in clndr.pro                  | clndr.pro re-mints Data API tokens with its OWN key. Ensure `SUPABASE_JWT_SIGNING_KEY` (in clndr-pro's env) matches the key in `supabase/signing_keys.json`, then `supabase stop && supabase start`. Do NOT copy the hub's key. See clndr-pro/TESTING.md. |
