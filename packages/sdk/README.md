# @clndr-pro/sdk

TypeScript SDK for [clndr.pro](https://www.clndr.pro). Full docs:
<https://docs.clndr.pro>. See also the [repo README](../../README.md).

```ts
import { Clndr } from '@clndr-pro/sdk';
const clndr = new Clndr(process.env.CLNDR_SECRET_KEY!);
const pages = await clndr.bookingPages.list();
const slots = await clndr.bookingPages.getSlots('30-min-intro', '2026-10-14');
```

- **Base URL.** Requests go to `https://www.clndr.pro` by default. Pass
  `baseUrl` for a local or self-hosted instance:
  `new Clndr({ apiKey, baseUrl: 'http://localhost:3000' })`. If you set it to
  the production host, use `www`: `https://clndr.pro` redirects there and
  `fetch` drops the `Authorization` header on the redirect, which gives
  `401 Missing API key`.
- **Slot dates.** `getSlots(slug, date)` takes a `YYYY-MM-DD` string, read as
  that day in the host's timezone, or a `Date`, sent as the `YYYY-MM-DD` of
  its local calendar day (`getFullYear()` / `getMonth()` / `getDate()`).
- Works from both `import` and `require()`.
