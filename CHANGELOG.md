# Changelog

All notable changes to `@clndr-pro/sdk` and `@clndr-pro/react`.

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
