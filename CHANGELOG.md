# Changelog

All notable changes to `@clndr-pro/sdk` and `@clndr-pro/react`.

## 0.2.1 — 2026-10-10

`@clndr-pro/sdk` 0.1.5 and `@clndr-pro/react` 0.2.1 (which depends on
`@clndr-pro/sdk` 0.1.5 exactly).

### Fixed

- **@clndr-pro/sdk**: the default base URL is now `https://www.clndr.pro`.
  `https://clndr.pro` answers `307` to the `www` host, and `fetch` drops the
  `Authorization` header on that cross-host redirect, so every call made
  without an explicit `baseUrl` failed with `401 Missing API key`. If you pass
  `baseUrl: 'https://clndr.pro'` yourself, switch it to the `www` host too.
- **@clndr-pro/sdk**, **@clndr-pro/react**: `require()` works. `main` and
  `exports["."].require` pointed at `dist/index.cjs`, which the build never
  produced (tsup writes CommonJS to `dist/index.js`). Each `exports`
  condition now also has its own types: `import` uses `index.d.mts` and
  `require` uses `index.d.ts`.
- **@clndr-pro/react**: the built files start with `"use client"` again.
  esbuild drops module-level directives when it bundles, so the
  `'use client'` in the sources never reached `dist/`, and importing
  `<BookingInline>` or `<ClndrProvider>` into a Next.js App Router Server
  Component failed (`You're importing a component that needs useEffect`).
  They can now be imported straight into Server Components. One side effect:
  the `Clndr` / `ClndrError` re-exported from `@clndr-pro/react` are client
  references there too, so server code should import them from
  `@clndr-pro/sdk`.
- **@clndr-pro/sdk**: `bookingPages.getSlots(slug, date)` sends a `Date` as
  the `YYYY-MM-DD` of its **local** calendar day
  (`getFullYear()` / `getMonth()` / `getDate()`) rather than
  `date.toISOString()`. Strings are passed through unchanged. The API reads a
  bare `YYYY-MM-DD` as that day in the host's timezone.
- **@clndr-pro/react**: `<BookingForm>` parses the date input as a local date.
  It used `new Date('YYYY-MM-DD')`, which is UTC midnight, so guests west of
  UTC got the previous day's slots (and the input showed the previous day).
- **@clndr-pro/react**: `<BookingForm>` renders each question type properly.
  `phone` is an `<input type="tel">`. `select` is a native `<select>` with an
  empty placeholder option followed by the question's `options`. `checkbox` is
  a checkbox whose answer is `'Yes'` or `'No'` (an untouched one sends
  `'No'`; a required one must be ticked). Before, all of them were plain text
  inputs.
- **@clndr-pro/react**: on `booking_type: 'approval'` pages the success heading
  reads "Request sent" instead of "Booking confirmed". The sub-text is
  unchanged.

### Added

- **@clndr-pro/react**: `components.Select` slot (default `<select>`), and
  `classNames.select` (defaults to the `input` class) and
  `classNames.checkbox` (default `clndr-checkbox`).

### Docs

- The Next.js examples keep `<ClndrProvider>` in a separate
  `app/providers.tsx` client component, so the root layout stays a Server
  Component. Docs now live at <https://docs.clndr.pro>.

### Internal

- React build options moved to `packages/react/tsup.config.ts`, with the
  same `splitting` and externals as before plus the `"use client"` banner.
- New tests cover the default base URL, the `getSlots` date parameter, and a
  `<BookingForm>` run in `jsdom` (date input to slots request, question
  controls, answers, success copy).

## 0.2.0

### Added

- **@clndr-pro/react**: `<BookingForm>` / `<BookingInline>` / `<BookingModal>`
  now render `bookingPage.description` as full markdown out of the box —
  headings, lists, links, GFM tables, code blocks, blockquotes, images. No
  more "the description shows up as a paragraph of raw markdown source"; you
  drop the component in and it just works.

  The default renderer (`react-markdown` + `remark-gfm`) is **lazy-loaded in
  its own ESM chunk**. Booking pages without a description, or apps that
  override `components={{ MarkdownRenderer: MyOwn }}`, never pull the markdown
  libraries into their bundle (~50 KB saved). When the chunk is needed, it's
  fetched on demand and rendered through `<Suspense>`.

  Element styling uses semantic shadcn/Tailwind tokens (`text-primary`,
  `bg-muted`, `border-border`, `text-muted-foreground`), so the rendered
  description inherits the consumer's theme automatically — and degrades to
  plain HTML elsewhere.

  New slot: `ComponentSlots.MarkdownRenderer`. New className: `description`.
  See [packages/react/README.md](./packages/react/README.md#markdown-descriptions-rendered-for-you)
  for the slot API and override examples.

- **@clndr-pro/react**: vitest smoke tests for the default renderer covering
  headings/paragraphs, GFM tables, safe link attributes, and wrapper class
  overrides.

### Internal

- React package build now uses `tsup --splitting` for ESM so the
  default-markdown renderer becomes a separate chunk in the published
  package.

## 0.1.4

### Fixed

- **@clndr-pro/sdk**: bind fallback global fetch so the SDK works in standard
  browsers and runtimes (previously threw `Illegal invocation` on the first
  network call in any environment without a global fetch wrapper). Native
  browser/undici `fetch` is WebIDL-branded and requires `this` to be the
  global object; storing it on an instance property and invoking it as a
  method rebound `this` to the `Clndr` instance and tripped the WebIDL
  guard. Caller-supplied `opts.fetch` is left untouched.
- **@clndr-pro/react**: bumped the `@clndr-pro/sdk` dependency to `0.1.4`
  so consumers pick up the fix transitively.

## 0.1.3

Initial public release.
