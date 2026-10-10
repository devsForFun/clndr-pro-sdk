import { BookingInline } from '@clndr-pro/react';

/**
 * Booking page. This file is a Server Component; `<BookingInline>` is a
 * client component (the @clndr-pro/react build is marked "use client" from
 * 0.2.1), and it uses the publishable key from the ClndrProvider in
 * app/provider.tsx. Change `slug` to match one of your booking pages.
 */
export default function BookPage() {
  return (
    <main style={{ maxWidth: 640, margin: '40px auto', padding: 16 }}>
      <BookingInline slug="30-min-intro" />
    </main>
  );
}
